"use client";
import {
  channels,
  channelNames as channelLabels,
  recipientColumns,
  variables,
  render,
  demoRates,
} from "../../../packages/domain/src/rules";
import { Select } from "./components/select";
import { t as tr, localeTag } from "./components/i18n";
import {
  useEffect,
  useState,
  cloneElement,
  isValidElement,
  type ReactElement,
} from "react";
import { mapRequest } from "../../../packages/domain/src/provider-contract";
import { Plug, Plus, ShieldCheck, Wallet } from "lucide-react";
type Row = Record<string, any>;
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
const example = {
  endpoint: "https://api.example.test/messages",
  allowedHosts: ["api.example.test"],
  auth: "bearer",
  requestBody: {
    to: "{{recipient}}",
    text: "{{body}}",
    channel: "{{channel}}",
    external_id: "{{message_id}}",
  },
  messageIdPath: "data.id",
  timeoutMs: 10000,
  requestsPerSecond: 5,
};
export function ProviderPanel({
  request,
  perform,
  templates = [],
}: {
  request: Api;
  templates?: Row[];
  perform: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const [data, setData] = useState<Row | null>(null);
  const [tab, setTab] = useState("definitions");
  const [show, setShow] = useState(false);
  const [adapter, setAdapter] = useState("SIMULATOR");
  const [definitionEdit, setDefinitionEdit] = useState<Row | null>(null),
    [requestMapping, setRequestMapping] = useState(
      JSON.stringify(example.requestBody, null, 2),
    ),
    [headerMapping, setHeaderMapping] = useState("{}"),
    [sampleTemplate, setSampleTemplate] = useState(""),
    [sampleValues, setSampleValues] = useState(
      '{"name":"Demo","customer_name":"Demo","reference":"REF-001"}',
    ),
    [accountDefinition, setAccountDefinition] = useState(""),
    [rateAccount, setRateAccount] = useState(""),
    [currency, setCurrency] = useState("IDR");
  const [result, setResult] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const refresh = async () => setData(await request("providers"));
  useEffect(() => {
    void perform(refresh, tr("Penyedia siap."));
  }, []);
  if (!data)
    return (
      <section className="panel settings-panel">
        <p>{tr("Memuat konfigurasi penyedia\u2026")}</p>
      </section>
    );
  const field = (label: string, input: React.ReactNode) => (
    <label className="field" key={label}>
      <span>{label}</span>
      {isValidElement(input)
        ? cloneElement(input as ReactElement<any>, {
            "aria-label": (input.props as any)["aria-label"] ?? label,
          })
        : input}
    </label>
  );
  return (
    <section className="panel administration provider-panel">
      <div className="panel-heading">
        <h3>
          <Plug size={18} />
          {tr("Penyedia dan tarif")}
        </h3>
        <button
          className="secondary"
          onClick={() => {
            setShow(!show);
            setEditing(null);
            setDefinitionEdit(null);
            setAdapter("SIMULATOR");
            setRequestMapping(JSON.stringify(example.requestBody, null, 2));
            setHeaderMapping("{}");
            setAccountDefinition("");
          }}
        >
          <Plus size={15} />
          {tr("Tambah")}{" "}
          {tab === "definitions"
            ? tr("penyedia")
            : tab === "accounts"
              ? tr("akun")
              : tr("tarif")}
        </button>
      </div>
      <div className="info-strip">
        <ShieldCheck size={18} />
        <span>
          {tr(
            "Penyedia uji mensimulasikan hasil. Konfigurasi HTTP dapat disimpan dan divalidasi; pengiriman nyata memerlukan adapter serta pengujian API. Validasi mapping tidak menghubungi vendor.",
          )}
        </span>
      </div>
      <div className="admin-tabs">
        {[
          ["definitions", tr("Definisi penyedia")],
          ["accounts", tr("Akun dan pengirim")],
          ["rates", tr("Riwayat tarif")],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setShow(false);
              setEditing(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {show && tab === "definitions" && (
        <form
          className="admin-form"
          key={definitionEdit?.id ?? "new-definition"}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void perform(async () => {
              let config = {};
              if (adapter === "GENERIC_HTTP") {
                const endpoint = String(f.get("endpoint"));
                const host = new URL(endpoint).hostname;
                config = {
                  endpoint,
                  allowedHosts: [host],
                  method: f.get("method"),
                  auth: f.get("auth"),
                  apiKeyHeader: f.get("apiKeyHeader"),
                  headers: JSON.parse(headerMapping),
                  requestBody: JSON.parse(requestMapping),
                  messageIdPath: f.get("messageIdPath"),
                  timeoutMs: Number(f.get("timeoutMs")),
                  requestsPerSecond: Number(f.get("requestsPerSecond")),
                };
              }
              await request("providers/definitions", "POST", {
                name: f.get("name"),
                adapter,
                channels: f.getAll("channels"),
                config,
                ...(definitionEdit ? { parentId: definitionEdit.id } : {}),
              });
              setShow(false);
              await refresh();
            }, tr("Draf penyedia tersimpan."));
          }}
        >
          <h3>{tr("Definisi penyedia baru")}</h3>
          <div className="form-grid">
            {field(
              tr("Nama penyedia"),
              <input
                name="name"
                defaultValue={definitionEdit?.name ?? ""}
                aria-label={tr("Nama penyedia")}
                required
                minLength={3}
              />,
            )}
            {field(
              "Adapter",
              <Select
                aria-label={tr("Adapter penyedia")}
                value={adapter}
                onChange={(e) => setAdapter(e.target.value)}
              >
                <option value="SIMULATOR">{tr("Penyedia uji")}</option>
                <option value="GENERIC_HTTP">
                  {tr("Generic HTTP (konfigurasi)")}
                </option>
              </Select>,
            )}
          </div>
          <div className="permission-grid">
            {channels.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  name="channels"
                  value={c}
                  defaultChecked={
                    definitionEdit
                      ? definitionEdit.channels.includes(c)
                      : ["email", "sms", "whatsapp"].includes(c)
                  }
                />
                {c}
              </label>
            ))}
          </div>
          {adapter === "GENERIC_HTTP" && (
            <>
              <div className="form-grid">
                {field(
                  "API endpoint",
                  <input
                    name="endpoint"
                    type="url"
                    required
                    defaultValue={
                      definitionEdit?.config.endpoint ?? example.endpoint
                    }
                  />,
                )}
                {field(
                  "HTTP method",
                  <Select
                    name="method"
                    defaultValue={definitionEdit?.config.method ?? "POST"}
                  >
                    <option>POST</option>
                    <option>PUT</option>
                  </Select>,
                )}
                {field(
                  "Authentication",
                  <Select
                    name="auth"
                    defaultValue={definitionEdit?.config.auth ?? "bearer"}
                  >
                    <option value="bearer">Bearer token</option>
                    <option value="api-key">API key</option>
                    <option value="none">None</option>
                  </Select>,
                )}
                {field(
                  "API key header",
                  <input
                    name="apiKeyHeader"
                    defaultValue={
                      definitionEdit?.config.apiKeyHeader ?? "X-API-Key"
                    }
                    required
                  />,
                )}
                {field(
                  "Response message ID path",
                  <input
                    name="messageIdPath"
                    defaultValue={
                      definitionEdit?.config.messageIdPath ?? "data.id"
                    }
                    required
                  />,
                )}
                {field(
                  "Timeout (ms)",
                  <input
                    name="timeoutMs"
                    type="number"
                    min="1000"
                    max="30000"
                    defaultValue={definitionEdit?.config.timeoutMs ?? 10000}
                  />,
                )}
                {field(
                  "Requests / second",
                  <input
                    name="requestsPerSecond"
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    defaultValue={definitionEdit?.config.requestsPerSecond ?? 5}
                  />,
                )}
              </div>
              {field(
                "Request headers (JSON)",
                <textarea
                  rows={4}
                  spellCheck={false}
                  value={headerMapping}
                  onChange={(e) => setHeaderMapping(e.target.value)}
                />,
              )}
              {field(
                "Request body / template mapping (JSON)",
                <textarea
                  rows={9}
                  spellCheck={false}
                  value={requestMapping}
                  onChange={(e) => setRequestMapping(e.target.value)}
                />,
              )}
              <p className="hint">
                {tr(
                  "Mapping tersedia: {{recipient}}, {{body}}, {{channel}}, {{message_id}}, {{sender}}, {{template_name}}, {{template_language}}, {{parameters}}. Header rahasia memakai {{credential.key}}; nilai disimpan di account.",
                )}
              </p>
              <details className="mapping-preview">
                <summary>{tr("Preview request dari template")}</summary>
                {field(
                  "Template preview",
                  <Select
                    value={sampleTemplate}
                    onChange={(e) => setSampleTemplate(e.target.value)}
                  >
                    <option value="">{tr("Contoh sintetis")}</option>
                    {templates.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.name} ·{" "}
                        {channelLabels[t.channel as keyof typeof channelLabels]}
                      </option>
                    ))}
                  </Select>,
                )}
                {field(
                  "Parameter values (JSON)",
                  <textarea
                    rows={4}
                    value={sampleValues}
                    onChange={(e) => setSampleValues(e.target.value)}
                  />,
                )}
                <pre>
                  {(() => {
                    try {
                      const t = templates.find((t) => t.id === sampleTemplate),
                        v = JSON.parse(sampleValues);
                      const body = t ? render(t.body, v) : "Hello Demo";
                      return JSON.stringify(
                        mapRequest(JSON.parse(requestMapping), {
                          recipient: "recipient@example.test",
                          body,
                          channel: t?.channel ?? "email",
                          message_id: "preview-id",
                          sender: "Sender demo",
                          template_name: t?.name ?? "demo",
                          template_language: "id",
                          variables: v,
                          parameters: t
                            ? variables(t.body).map((name) => ({
                                name,
                                value: v[name] ?? "",
                              }))
                            : [],
                          callback_url: "https://example.test/callback",
                        }),
                        null,
                        2,
                      );
                    } catch (e) {
                      return (e as Error).message;
                    }
                  })()}
                </pre>
              </details>
            </>
          )}
          <p className="hint">
            {tr(
              "Mapping hanya memakai nilai yang didukung, tanpa skrip yang dapat dieksekusi. Kredensial disimpan pada akun, bukan di kontrak ini.",
            )}
          </p>
          <button className="primary">{tr("Simpan draf penyedia")}</button>
        </form>
      )}
      {show && tab === "accounts" && (
        <form
          className="admin-form"
          key={editing?.id ?? "new"}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void perform(async () => {
              const key = String(f.get("apiKey") ?? "");
              const secret = String(f.get("webhookSecret") ?? "");
              const extra = String(f.get("extraCredentials") ?? "").trim();
              const custom = extra ? JSON.parse(extra) : {};
              const token = String(f.get("token") ?? "").trim();
              const metadata = Object.fromEntries(
                [
                  "fromName",
                  "replyTo",
                  "workspaceId",
                  "appId",
                  "whatsappBusinessAccountId",
                  "phoneNumberId",
                ]
                  .map((k) => [k, String(f.get(k) ?? "").trim()])
                  .filter(([, v]) => v),
              );
              const senders = Object.fromEntries(
                channels
                  .map((c) => [c, String(f.get("sender-" + c) ?? "").trim()])
                  .filter(([, v]) => v),
              );
              const common = {
                definitionId: f.get("definition"),
                sender: f.get("sender"),
                metadata: { ...metadata, senders },
                clearCredentials: f.get("clearCredentials") === "on",
                ...(key || secret || token || extra
                  ? {
                      credentials: {
                        ...custom,
                        ...(token ? { token } : {}),
                        ...(key ? { apiKey: key } : {}),
                        ...(secret ? { webhookSecret: secret } : {}),
                      },
                    }
                  : {}),
              };
              if (editing)
                await request(
                  `providers/accounts/${editing.id}/versions`,
                  "POST",
                  common,
                );
              else {
                const rates = Object.fromEntries(
                  channels
                    .filter((c) => f.get(`rate-${c}`))
                    .map((c) => [c, String(f.get(`rate-${c}`))]),
                );
                await request("providers/accounts", "POST", {
                  ...common,
                  name: f.get("name"),
                  rates,
                });
              }
              setShow(false);
              setEditing(null);
              await refresh();
            }, tr("Akun penyedia tersimpan dengan versi tetap."));
          }}
        >
          <h3>
            {editing ? tr("Versi akun baru") : tr("Akun perusahaan baru")}
          </h3>
          <div className="form-grid">
            {!editing &&
              field(
                tr("Nama akun"),
                <input
                  name="name"
                  aria-label={tr("Nama akun penyedia")}
                  required
                  minLength={3}
                />,
              )}
            {field(
              tr("Definisi dipublikasikan"),
              <Select
                name="definition"
                aria-label={tr("Definisi akun")}
                required
                value={
                  accountDefinition ||
                  editing?.definition_id ||
                  data.definitions.find((d: Row) => d.published)?.id ||
                  ""
                }
                onChange={(e) => setAccountDefinition(e.target.value)}
              >
                {data.definitions
                  .filter((d: Row) => d.published)
                  .map((d: Row) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {tr(" \u00B7 v")}
                      {d.version}
                    </option>
                  ))}
              </Select>,
            )}
            {field(
              tr("Identitas pengirim"),
              <input
                name="sender"
                aria-label={tr("Identitas pengirim")}
                required
                defaultValue={editing?.sender ?? ""}
              />,
            )}
            {field(
              tr("API key baru (opsional)"),
              <input
                name="apiKey"
                aria-label={tr("API key penyedia")}
                type="password"
                autoComplete="new-password"
              />,
            )}
            {field(
              tr("Rahasia webhook baru (opsional)"),
              <input
                name="webhookSecret"
                aria-label={tr("Rahasia webhook")}
                type="password"
                autoComplete="new-password"
              />,
            )}
          </div>
          <div className="form-grid">
            {field(
              "Bearer token / bot token",
              <input
                name="token"
                type="password"
                autoComplete="new-password"
              />,
            )}
            {field(
              "Additional credentials (JSON)",
              <textarea
                name="extraCredentials"
                rows={3}
                autoComplete="off"
                placeholder='{"clientId":"...","clientSecret":"..."}'
              />,
            )}
            {[
              "fromName",
              "replyTo",
              "workspaceId",
              "appId",
              "whatsappBusinessAccountId",
              "phoneNumberId",
            ].map((k) =>
              field(
                k,
                <input
                  key={k}
                  name={k}
                  defaultValue={editing?.metadata?.[k] ?? ""}
                />,
              ),
            )}
          </div>
          <details>
            <summary>{tr("Sender per channel (opsional)")}</summary>
            <p className="hint">
              {tr(
                "Email: alamat From; SMS: sender ID; WhatsApp: phone-number ID; Slack: bot/workspace; Telegram: bot ID; Push: app/project ID. Token dan password masuk ke credentials.",
              )}
            </p>
            <div className="form-grid">
              {channels.map((c) =>
                field(
                  channelLabels[c],
                  <input
                    key={c}
                    name={"sender-" + c}
                    defaultValue={editing?.metadata?.senders?.[c] ?? ""}
                  />,
                ),
              )}
            </div>
          </details>
          {editing && (
            <label>
              <input type="checkbox" name="clearCredentials" />
              {tr("Hapus semua credentials tersimpan pada versi baru")}
            </label>
          )}
          {!editing && (
            <>
              <p className="hint">
                {tr(
                  "Tarif awal opsional untuk kanal yang didukung. Isi setelah akun dibuat jika diperlukan.",
                )}
              </p>
              <div className="form-grid">
                {channels
                  .filter((c) =>
                    (
                      data.definitions.find(
                        (d: Row) =>
                          d.id ===
                          (accountDefinition ||
                            data.definitions.find((d: Row) => d.published)?.id),
                      )?.channels ?? []
                    ).includes(c),
                  )
                  .map((c) => (
                    <label className="field" key={c}>
                      <span>
                        {tr("Tarif awal ")}
                        {c}
                        {tr(" (IDR)")}
                      </span>
                      <input
                        name={`rate-${c}`}
                        type="number"
                        min="0"
                        step="0.00000001"
                      />
                    </label>
                  ))}
              </div>
            </>
          )}
          <p className="hint">
            {tr(
              "Kredensial tidak ditampilkan kembali. Versi lama tetap digunakan oleh pesan yang sudah masuk antrean. Menonaktifkan akun menahan pengiriman berikutnya.",
            )}
          </p>
          <button className="primary">{tr("Simpan akun")}</button>
        </form>
      )}
      {show && tab === "rates" && (
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void perform(async () => {
              await request(
                `providers/accounts/${f.get("account")}/rates`,
                "POST",
                {
                  channel: f.get("channel"),
                  price: f.get("price"),
                  currency,
                  fxToIdr: currency === "IDR" ? "1" : f.get("fxToIdr"),
                  effectiveFrom: f.get("from")
                    ? new Date(String(f.get("from"))).toISOString()
                    : new Date().toISOString(),
                  reason: f.get("reason"),
                },
              );
              setShow(false);
              await refresh();
            }, tr("Tarif baru tersimpan; riwayat lama dipertahankan."));
          }}
        >
          <h3>{tr("Tarif versi baru")}</h3>
          <div className="form-grid">
            {field(
              "Akun",
              <Select
                name="account"
                aria-label={tr("Akun tarif")}
                value={rateAccount || data.accounts[0]?.id || ""}
                onChange={(e) => setRateAccount(e.target.value)}
              >
                {data.accounts.map((a: Row) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>,
            )}
            {field(
              tr("Kanal"),
              <Select name="channel" aria-label={tr("Kanal tarif")}>
                {(
                  data.accounts.find(
                    (a: Row) => a.id === (rateAccount || data.accounts[0]?.id),
                  )?.channels ?? []
                ).map((c: string) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>,
            )}
            {field(
              tr("Harga per unit"),
              <input
                name="price"
                aria-label={tr("Harga per unit")}
                type="number"
                min="0"
                step="0.00000001"
                required
              />,
            )}
            {field(
              tr("Berlaku mulai (waktu komputer)"),
              <input
                name="from"
                aria-label={tr("Berlaku mulai")}
                type="datetime-local"
              />,
            )}
          </div>
          <div className="form-grid">
            {field(
              "Currency",
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {Intl.supportedValuesOf("currency").map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>,
            )}
            {currency !== "IDR" &&
              field(
                tr("Kurs ke IDR"),
                <input
                  name="fxToIdr"
                  type="number"
                  min="0.00000001"
                  step="0.00000001"
                  required
                />,
              )}
          </div>
          <p className="hint">
            {tr(
              "Budget dan ledger dicatat dalam IDR. Kurs diisi admin dan dibekukan pada versi rate card; bukan kurs otomatis.",
            )}
          </p>
          {field(
            tr("Alasan perubahan"),
            <input
              name="reason"
              aria-label={tr("Alasan perubahan tarif")}
              required
              minLength={3}
            />,
          )}
          <button className="primary">
            <Wallet size={16} />
            {tr("Simpan tarif baru")}
          </button>
        </form>
      )}
      {tab === "definitions" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Penyedia")}</th>
                <th>{tr("Adapter / kanal")}</th>
                <th>{tr("Versi")}</th>
                <th>{tr("Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.definitions.map((d: Row) => (
                <tr key={d.id}>
                  <td>
                    <b>{d.name}</b>
                  </td>
                  <td>
                    {d.adapter}
                    <small>{d.channels.join(", ")}</small>
                  </td>
                  <td>
                    {tr("v")}
                    {d.version}
                  </td>
                  <td>
                    {d.published
                      ? tr("Dipublikasikan")
                      : d.validated_at
                        ? tr("Konfigurasi tervalidasi")
                        : tr("Draf")}
                  </td>
                  <td>
                    <button
                      className="text-btn"
                      onClick={() =>
                        void perform(async () => {
                          setResult(
                            await request(
                              `providers/definitions/${d.id}/test`,
                              "POST",
                              {},
                            ),
                          );
                          await refresh();
                        }, tr("Struktur konfigurasi tervalidasi; tidak ada koneksi vendor."))
                      }
                    >
                      {tr("Validasi mapping")}
                    </button>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setDefinitionEdit(d);
                        setAdapter(d.adapter);
                        setRequestMapping(
                          JSON.stringify(
                            d.config.requestBody ?? example.requestBody,
                            null,
                            2,
                          ),
                        );
                        setHeaderMapping(
                          JSON.stringify(d.config.headers ?? {}, null, 2),
                        );
                        setShow(true);
                      }}
                    >
                      {tr("Versi konfigurasi baru")}
                    </button>
                    {!d.published && (
                      <button
                        className="text-btn"
                        onClick={() =>
                          void perform(async () => {
                            await request(
                              `providers/definitions/${d.id}/publish`,
                              "POST",
                              {},
                            );
                            await refresh();
                          }, tr("Versi definisi dipublikasikan."))
                        }
                      >
                        {tr("Publikasikan")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "accounts" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Akun")}</th>
                <th>{tr("Pengirim")}</th>
                <th>{tr("Versi")}</th>
                <th>{tr("Status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a: Row) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.name}</b>
                    <small>
                      {a.provider} · {a.channels.join(", ")}
                    </small>
                  </td>
                  <td>
                    {a.sender}
                    <small>
                      {a.credentials_set
                        ? tr("Kredensial terenkripsi")
                        : tr("Tanpa kredensial")}
                    </small>
                  </td>
                  <td>
                    {tr("v")}
                    {a.version}
                  </td>
                  <td>
                    {a.enabled ? tr("Aktif") : tr("Nonaktif")} ·{" "}
                    {a.simulated ? tr("Simulasi") : tr("HTTP belum diaktifkan")}
                  </td>
                  <td>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setEditing(a);
                        setShow(true);
                        setAccountDefinition(a.definition_id);
                      }}
                    >
                      {tr("Versi baru")}
                    </button>
                    <button
                      className="text-btn"
                      onClick={() =>
                        void perform(async () => {
                          await request(
                            `providers/accounts/${a.id}/status`,
                            "POST",
                            { enabled: !a.enabled },
                          );
                          await refresh();
                        }, tr("Status akun diperbarui."))
                      }
                    >
                      {a.enabled ? tr("Nonaktifkan") : tr("Aktifkan")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "rates" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Akun / kanal")}</th>
                <th>{tr("Vendor price / currency")}</th>
                <th>{tr("Berlaku sejak")}</th>
                <th>{tr("Sampai (eksklusif)")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rates.map((r: Row) => (
                <tr key={r.id}>
                  <td>
                    {
                      data.accounts.find((a: Row) => a.id === r.account_id)
                        ?.name
                    }
                    <small>
                      {r.channel} ·{" "}
                      {r.channel === "sms" ? tr("per segmen") : tr("per pesan")}
                    </small>
                  </td>
                  <td>
                    {r.price} {r.currency}
                    <small>
                      {tr("Kurs ke IDR")}: {r.fx_to_idr} ·{" "}
                      {Number(r.price) * Number(r.fx_to_idr)} IDR
                    </small>
                  </td>
                  <td>
                    {new Date(r.effective_from).toLocaleString(localeTag())}
                  </td>
                  <td>
                    {r.effective_until
                      ? new Date(r.effective_until).toLocaleString(localeTag())
                      : tr("Masih berlaku / akan berlaku")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result && (
        <details className="admin-form">
          <summary>
            {tr("Hasil validasi konfigurasi (tanpa kontak vendor)")}
          </summary>
          <pre>{JSON.stringify(result.preview, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
