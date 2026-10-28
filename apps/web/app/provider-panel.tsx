"use client";
import { useEffect, useState } from "react";
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
}: {
  request: Api;
  perform: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const [data, setData] = useState<Row | null>(null);
  const [tab, setTab] = useState("definitions");
  const [show, setShow] = useState(false);
  const [adapter, setAdapter] = useState("SIMULATOR");
  const [result, setResult] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const refresh = async () => setData(await request("providers"));
  useEffect(() => {
    void perform(refresh, "Penyedia siap.");
  }, []);
  if (!data)
    return (
      <section className="panel settings-panel">
        <p>Memuat konfigurasi penyedia…</p>
      </section>
    );
  const field = (label: string, input: React.ReactNode) => (
    <label className="field">
      <span>{label}</span>
      {input}
    </label>
  );
  return (
    <section className="panel administration provider-panel">
      <div className="panel-heading">
        <h3>
          <Plug size={18} />
          Penyedia dan tarif
        </h3>
        <button
          className="secondary"
          onClick={() => {
            setShow(!show);
            setEditing(null);
          }}
        >
          <Plus size={15} />
          Tambah{" "}
          {tab === "definitions"
            ? "penyedia"
            : tab === "accounts"
              ? "akun"
              : "tarif"}
        </button>
      </div>
      <div className="info-strip">
        <ShieldCheck size={18} />
        <span>
          Pengiriman lokal memakai simulator. Konfigurasi HTTP bisa disimpan dan
          divalidasi; transport vendor nyata memerlukan adapter serta pengujian
          API. Validasi mapping tidak menghubungi vendor.
        </span>
      </div>
      <div className="admin-tabs">
        {[
          ["definitions", "Definisi penyedia"],
          ["accounts", "Akun dan pengirim"],
          ["rates", "Riwayat tarif"],
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
      {tab === "definitions" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Penyedia</th>
                <th>Adapter / kanal</th>
                <th>Versi</th>
                <th>Status</th>
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
                  <td>v{d.version}</td>
                  <td>
                    {d.published
                      ? "Dipublikasikan"
                      : d.validated_at
                        ? "Tervalidasi lokal"
                        : "Draf"}
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
                        }, "Struktur konfigurasi tervalidasi; tidak ada koneksi vendor.")
                      }
                    >
                      Validasi mapping
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
                          }, "Versi definisi dipublikasikan.")
                        }
                      >
                        Publikasikan
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
                <th>Akun</th>
                <th>Pengirim</th>
                <th>Versi</th>
                <th>Status</th>
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
                        ? "Kredensial terenkripsi"
                        : "Tanpa kredensial"}
                    </small>
                  </td>
                  <td>v{a.version}</td>
                  <td>
                    {a.enabled ? "Aktif" : "Nonaktif"} ·{" "}
                    {a.simulated ? "Simulasi" : "HTTP belum diaktifkan"}
                  </td>
                  <td>
                    <button
                      className="text-btn"
                      onClick={() => {
                        setEditing(a);
                        setShow(true);
                      }}
                    >
                      Versi baru
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
                        }, "Status akun diperbarui.")
                      }
                    >
                      {a.enabled ? "Nonaktifkan" : "Aktifkan"}
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
                <th>Akun / kanal</th>
                <th>Tarif IDR</th>
                <th>Berlaku sejak</th>
                <th>Sampai (eksklusif)</th>
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
                      {r.channel === "sms" ? "per segmen" : "per pesan"}
                    </small>
                  </td>
                  <td>{r.price}</td>
                  <td>{new Date(r.effective_from).toLocaleString("id-ID")}</td>
                  <td>
                    {r.effective_until
                      ? new Date(r.effective_until).toLocaleString("id-ID")
                      : "Masih berlaku / akan berlaku"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result && (
        <details className="admin-form">
          <summary>Hasil validasi konfigurasi (tanpa kontak vendor)</summary>
          <pre>{JSON.stringify(result.preview, null, 2)}</pre>
        </details>
      )}
      {show && tab === "definitions" && (
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void perform(async () => {
              let config = {};
              if (adapter === "GENERIC_HTTP")
                config = JSON.parse(String(f.get("config")));
              await request("providers/definitions", "POST", {
                name: f.get("name"),
                adapter,
                channels: f.getAll("channels"),
                config,
              });
              setShow(false);
              await refresh();
            }, "Draf penyedia tersimpan.");
          }}
        >
          <h3>Definisi penyedia baru</h3>
          <div className="form-grid">
            {field(
              "Nama penyedia",
              <input
                name="name"
                aria-label="Nama penyedia"
                required
                minLength={3}
              />,
            )}
            {field(
              "Adapter",
              <select
                aria-label="Adapter penyedia"
                value={adapter}
                onChange={(e) => setAdapter(e.target.value)}
              >
                <option value="SIMULATOR">Simulator lokal</option>
                <option value="GENERIC_HTTP">Generic HTTP (konfigurasi)</option>
              </select>,
            )}
          </div>
          <div className="permission-grid">
            {["email", "sms", "whatsapp"].map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  name="channels"
                  value={c}
                  defaultChecked
                />
                {c}
              </label>
            ))}
          </div>
          {adapter === "GENERIC_HTTP" &&
            field(
              "Kontrak HTTP JSON",
              <textarea
                aria-label="Kontrak HTTP JSON"
                name="config"
                rows={13}
                defaultValue={JSON.stringify(example, null, 2)}
                spellCheck={false}
              />,
            )}
          <p className="hint">
            Mapping hanya memakai nilai yang didukung, tanpa skrip yang dapat
            dieksekusi. Kredensial disimpan pada akun, bukan di kontrak ini.
          </p>
          <button className="primary">Simpan draf penyedia</button>
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
              const common = {
                definitionId: f.get("definition"),
                sender: f.get("sender"),
                ...(key || secret
                  ? {
                      credentials: {
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
                  ["email", "sms", "whatsapp"]
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
            }, "Akun penyedia tersimpan dengan versi tetap.");
          }}
        >
          <h3>{editing ? "Versi akun baru" : "Akun perusahaan baru"}</h3>
          <div className="form-grid">
            {!editing &&
              field(
                "Nama akun",
                <input
                  name="name"
                  aria-label="Nama akun penyedia"
                  required
                  minLength={3}
                />,
              )}
            {field(
              "Definisi dipublikasikan",
              <select
                name="definition"
                aria-label="Definisi akun"
                required
                defaultValue={editing?.definition_id}
              >
                {data.definitions
                  .filter((d: Row) => d.published)
                  .map((d: Row) => (
                    <option key={d.id} value={d.id}>
                      {d.name} · v{d.version}
                    </option>
                  ))}
              </select>,
            )}
            {field(
              "Identitas pengirim",
              <input
                name="sender"
                aria-label="Identitas pengirim"
                required
                defaultValue={editing?.sender ?? "Relay Demo"}
              />,
            )}
            {field(
              "API key baru (opsional)",
              <input
                name="apiKey"
                aria-label="API key penyedia"
                type="password"
                autoComplete="new-password"
              />,
            )}
            {field(
              "Rahasia webhook baru (opsional)",
              <input
                name="webhookSecret"
                aria-label="Rahasia webhook"
                type="password"
                autoComplete="new-password"
              />,
            )}
          </div>
          {!editing && (
            <>
              <p className="hint">
                Tarif awal opsional untuk kanal yang didukung. Isi setelah akun
                dibuat jika diperlukan.
              </p>
              <div className="form-grid">
                {["email", "sms", "whatsapp"].map((c) => (
                  <label className="field" key={c}>
                    <span>Tarif awal {c} (IDR)</span>
                    <input
                      name={`rate-${c}`}
                      type="number"
                      min="0"
                      step="0.0001"
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          <p className="hint">
            Kredensial tidak ditampilkan kembali. Versi lama tetap digunakan
            oleh pesan yang sudah masuk antrean. Menonaktifkan akun menahan
            pengiriman berikutnya.
          </p>
          <button className="primary">Simpan akun</button>
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
                  effectiveFrom: new Date(String(f.get("from"))).toISOString(),
                  reason: f.get("reason"),
                },
              );
              setShow(false);
              await refresh();
            }, "Tarif baru tersimpan; riwayat lama dipertahankan.");
          }}
        >
          <h3>Tarif versi baru</h3>
          <div className="form-grid">
            {field(
              "Akun",
              <select name="account" aria-label="Akun tarif">
                {data.accounts.map((a: Row) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>,
            )}
            {field(
              "Kanal",
              <select name="channel" aria-label="Kanal tarif">
                {["email", "sms", "whatsapp"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>,
            )}
            {field(
              "Harga per unit (IDR)",
              <input
                name="price"
                aria-label="Harga per unit"
                type="number"
                min="0"
                step="0.0001"
                required
              />,
            )}
            {field(
              "Berlaku mulai (waktu komputer)",
              <input
                name="from"
                aria-label="Berlaku mulai"
                type="datetime-local"
                required
              />,
            )}
          </div>
          {field(
            "Alasan perubahan",
            <input
              name="reason"
              aria-label="Alasan perubahan tarif"
              required
              minLength={3}
            />,
          )}
          <button className="primary">
            <Wallet size={16} />
            Simpan tarif baru
          </button>
        </form>
      )}
    </section>
  );
}
