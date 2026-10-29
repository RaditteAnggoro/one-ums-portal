"use client";
import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import {
  History,
  Plus,
  RefreshCw,
  Wrench,
  ShieldCheck,
  Info,
} from "lucide-react";
import { Select } from "./select";
import { t as tr, localeTag, useLanguage } from "./i18n";
import { statusLabel } from "../../../../packages/domain/src/status";
type Row = Record<string, any>;
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
function useQuery(request: Api, path: string) {
  const [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    request(path)
      .then((value) => {
        if (current) setData(value);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [path, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
const query = (value: Row) =>
  new URLSearchParams(
    Object.entries(value)
      .filter(([, v]) => v !== "" && v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
const date = (value: string, timeZone?: string) =>
  new Date(value).toLocaleString(localeTag(), { timeZone });
function ErrorMessage({ value }: { value: string }) {
  return value ? (
    <p role="alert" className="alert error">
      {tr(value)}
    </p>
  ) : null;
}
export function AuditPanel({
  request,
  timezone = "Asia/Jakarta",
}: {
  request: Api;
  timezone?: string;
}) {
  const now = DateTime.now().setZone(timezone),
    [filters, setFilters] = useState<Row>({
      from: now.minus({ days: 6 }).toISODate(),
      to: now.toISODate(),
      module: "all",
      source: "all",
      search: "",
      action: "",
    }),
    [limit, setLimit] = useState(30),
    [page, setPage] = useState(1),
    [snapshot, setSnapshot] = useState("");
  const { data, error, loading, reload } = useQuery(
    request,
    "audit?" + query({ ...filters, limit, page, snapshot }),
  );
  const modules: Record<string, string> = {
    all: "Semua aktivitas",
    authentication: "Login dan akses",
    delivery: "Pengiriman dan eksekusi",
    campaigns: "Kampanye dan persetujuan",
    templates: "Template",
    sources: "Sumber data",
    users: "Pengguna dan peran",
    providers: "Vendor dan koneksi",
    finance: "Anggaran dan biaya",
    governance: "Rilis dan pemeliharaan",
    notifications: "Notifikasi",
  };
  return (
    <section className="panel audit-panel" aria-busy={loading}>
      <div className="panel-heading">
        <div>
          <h3>{tr("Akses & audit")}</h3>
          <p>
            {tr(
              "Peristiwa bisnis dan perubahan data, sesuai hak akses perusahaan Anda.",
            )}
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setSnapshot("");
            setPage(1);
            reload();
          }}
        >
          <RefreshCw size={14} />
          {tr("Muat terbaru")}
        </button>
      </div>
      <form
        className="governance-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(Object.fromEntries(new FormData(e.currentTarget)));
          setPage(1);
          setSnapshot("");
          reload();
        }}
      >
        <label>
          {tr("Dari tanggal")}
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          {tr("Sampai tanggal")}
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label>
          {tr("Menu / use case")}
          <Select name="module" defaultValue="all">
            {Object.entries(modules).map(([value, label]) => (
              <option key={value} value={value}>
                {tr(label)}
              </option>
            ))}
          </Select>
        </label>
        <label>
          {tr("Jenis catatan")}
          <Select name="source" defaultValue="all">
            <option value="all">{tr("Semua catatan")}</option>
            <option value="business">{tr("Peristiwa bisnis")}</option>
            <option value="database">{tr("Perubahan data")}</option>
          </Select>
        </label>
        <label>
          {tr("Aksi spesifik")}
          <input name="action" placeholder="auth.login" maxLength={100} />
        </label>
        <label>
          {tr("Cari audit")}
          <input
            name="search"
            placeholder={tr("Pengguna, aksi, atau ID")}
            maxLength={100}
          />
        </label>
        <button className="primary">{tr("Terapkan filter")}</button>
      </form>
      <ErrorMessage value={error} />
      <div className="audit-controls">
        <label>
          {tr("Baris per halaman")}
          <Select
            aria-label={tr("Baris per halaman")}
            value={String(limit)}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
              setSnapshot("");
            }}
          >
            {[10, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <span>
          {data?.total ?? 0} {tr("catatan")} · {timezone}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                "Waktu",
                "Pengguna",
                "Aksi",
                "Objek / ID",
                "Alamat IP",
                "Perubahan / korelasi",
              ].map((label) => (
                <th key={label}>{tr(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((a: Row) => (
              <tr key={a.id}>
                <td>{date(a.created_at, timezone)}</td>
                <td>{a.actor_name ?? tr("Sistem")}</td>
                <td>
                  <code>{a.action}</code>
                  <small>
                    {tr(
                      a.detail.source === "database"
                        ? "Perubahan data"
                        : "Peristiwa bisnis",
                    )}
                  </small>
                </td>
                <td>
                  {a.resource_type}
                  <small className="mono">{a.resource_id}</small>
                </td>
                <td>{a.ip ?? "—"}</td>
                <td>
                  <details>
                    <summary>{tr("Lihat perubahan")}</summary>
                    <pre className="audit-detail">
                      {JSON.stringify(a.detail, null, 2)}
                    </pre>
                    <small className="mono">{a.correlation_id}</small>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && data?.items.length === 0 && (
        <p className="empty">{tr("Tidak ada catatan untuk filter ini.")}</p>
      )}
      <div className="report-pagination">
        <button
          className="secondary"
          disabled={page === 1 || loading}
          onClick={() => {
            setSnapshot(data!.snapshot);
            setPage((p) => p - 1);
          }}
        >
          {tr("Sebelumnya")}
        </button>
        <span>
          {tr("Halaman")} {page} /{" "}
          {Math.max(1, Math.ceil((data?.total ?? 0) / limit))}
        </span>
        <button
          className="secondary"
          disabled={loading || page * limit >= (data?.total ?? 0)}
          onClick={() => {
            setSnapshot(data!.snapshot);
            setPage((p) => p + 1);
          }}
        >
          {tr("Berikutnya")}
        </button>
      </div>
    </section>
  );
}
export function MaintenancePanel({ request }: { request: Api }) {
  const { data, error, reload } = useQuery(request, "governance/maintenance");
  const [failure, setFailure] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data)
    return (
      <section className="panel governance-form">
        <ErrorMessage value={error} />
        <p>{tr("Memuat pengaturan…")}</p>
      </section>
    );
  return (
    <section className="panel governance-form">
      <div className="panel-heading">
        <h3>
          <Wrench size={18} />
          {tr("Pemeliharaan perusahaan")}
        </h3>
      </div>
      <p>
        {tr(
          "Pengguna biasa tidak dapat login atau menggunakan layanan selama pemeliharaan. Admin perusahaan tetap dapat menonaktifkan mode ini. Eksekusi baru ditahan; pengiriman yang sudah berlangsung dapat selesai.",
        )}
      </p>
      <div className={`maintenance-state ${data.enabled ? "on" : ""}`}>
        <ShieldCheck size={18} />
        <b>{tr(data.enabled ? "Pemeliharaan aktif" : "Layanan aktif")}</b>
        <span>{data.corporate_id}</span>
      </div>
      <ErrorMessage value={failure || error} />
      {notice && (
        <p role="status" className="info-strip">
          {tr(notice)}
        </p>
      )}
      <form
        key={String(data.enabled) + data.updated_at}
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          setFailure("");
          setNotice("");
          try {
            await request("governance/maintenance", "PUT", {
              enabled: !data.enabled,
              message: f.get("message"),
              reason: f.get("reason"),
            });
            setNotice("Pengaturan pemeliharaan disimpan.");
            reload();
          } catch (e) {
            setFailure((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>{tr("Informasi pemeliharaan")}</span>
          <textarea
            name="message"
            defaultValue={data.message}
            maxLength={500}
          />
        </label>
        <label className="field">
          <span>{tr("Alasan perubahan")}</span>
          <textarea name="reason" required minLength={3} maxLength={500} />
        </label>
        <label className="confirm-maintenance">
          <input type="checkbox" required />
          <span>
            {tr(
              data.enabled
                ? "Saya mengonfirmasi layanan dapat dibuka kembali."
                : "Saya memahami pengguna perusahaan ini akan dibatasi selama pemeliharaan.",
            )}
          </span>
        </label>
        <button className="primary" disabled={busy}>
          {tr(
            data.enabled ? "Nonaktifkan pemeliharaan" : "Aktifkan pemeliharaan",
          )}
        </button>
      </form>
    </section>
  );
}
const changeTypes: Record<string, string> = {
  FIX: "Perbaikan issue",
  ENHANCEMENT: "Peningkatan",
  FEATURE: "Fitur baru",
  SECURITY: "Keamanan",
  MAINTENANCE: "Pemeliharaan",
  OTHER: "Lainnya",
};
export function ReleaseHistory({
  request,
  admin,
}: {
  request: Api;
  admin: boolean;
}) {
  const { locale } = useLanguage();
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [show, setShow] = useState(false),
    [items, setItems] = useState([
      { type: "FIX", description: "", ticket: "" },
    ]),
    [failure, setFailure] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const { data, error, loading, reload } = useQuery(
    request,
    "governance/releases?" + query({ page, search }),
  );
  const [transition, setTransition] = useState<Row | null>(null);
  return (
    <>
      <section className="panel release-header">
        <div className="panel-heading">
          <div>
            <h3>
              <History size={18} />
              {tr("Riwayat perubahan aplikasi")}
            </h3>
            <p>
              {tr(
                "Catatan rilis dan deployment yang didaftarkan admin perusahaan. Pendaftaran ini tidak menjalankan deployment.",
              )}
            </p>
          </div>
          {admin && (
            <button
              className="primary"
              onClick={() => {
                setShow((v) => !v);
                setFailure("");
              }}
            >
              <Plus size={16} />
              {tr("Daftarkan perubahan")}
            </button>
          )}
        </div>
        <form
          className="governance-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(
              String(new FormData(e.currentTarget).get("search") ?? ""),
            );
            setPage(1);
            reload();
          }}
        >
          <label>
            {tr("Cari versi atau judul")}
            <input name="search" maxLength={100} />
          </label>
          <button className="secondary">{tr("Cari")}</button>
        </form>
      </section>
      <ErrorMessage value={failure || error} />
      {notice && (
        <p role="status" className="info-strip">
          {tr(notice)}
        </p>
      )}
      {show && admin && (
        <form
          className="panel governance-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              f = new FormData(form);
            setBusy(true);
            setFailure("");
            try {
              const when = DateTime.fromISO(String(f.get("deployedAt")));
              await request("governance/releases", "POST", {
                version: f.get("version"),
                title: f.get("title"),
                environment: f.get("environment"),
                deployedAt: when.toISO(),
                status: f.get("status"),
                reference: f.get("reference"),
                ...(f.get("supersedesId")
                  ? { supersedesId: f.get("supersedesId") }
                  : {}),
                items,
              });
              setShow(false);
              setItems([{ type: "FIX", description: "", ticket: "" }]);
              setNotice("Perubahan terdaftar.");
              setPage(1);
              reload();
            } catch (e) {
              setFailure((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>{tr("Registrasi perubahan")}</h3>
          <div className="form-grid">
            <label className="field">
              <span>{tr("Versi rilis")}</span>
              <input
                name="version"
                required
                maxLength={80}
                placeholder="1.2.0"
              />
            </label>
            <label className="field">
              <span>{tr("Judul perubahan")}</span>
              <input name="title" required minLength={3} maxLength={160} />
            </label>
            <label className="field">
              <span>{tr("Lingkungan")}</span>
              <Select name="environment" defaultValue="production">
                {["production", "staging", "development"].map((v) => (
                  <option key={v} value={v}>
                    {tr(v)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              <span>{tr("Waktu deployment")}</span>
              <input
                type="datetime-local"
                name="deployedAt"
                required
                defaultValue={DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm")}
              />
            </label>
            <label className="field">
              <span>{tr("Status")}</span>
              <Select name="status" defaultValue="DEPLOYED">
                {["PLANNED", "DEPLOYED", "ROLLED_BACK"].map((v) => (
                  <option key={v} value={v}>
                    {v === "DEPLOYED"
                      ? tr("Diterapkan")
                      : statusLabel(v, locale)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="field">
              <span>{tr("Referensi tiket / commit")}</span>
              <input name="reference" maxLength={200} />
            </label>
            <label className="field">
              <span>{tr("Mengoreksi rilis sebelumnya")}</span>
              <Select name="supersedesId" defaultValue="">
                <option value="">{tr("Tidak ada")}</option>
                {data?.items.map((r: Row) => (
                  <option key={r.id} value={r.id}>
                    {r.version} · {r.title}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <h4>{tr("Rincian perubahan")}</h4>
          {items.map((item, index) => (
            <fieldset className="release-item-editor" key={index}>
              <legend>
                {tr("Perubahan")} {index + 1}
              </legend>
              <label>
                {tr("Jenis")}
                <Select
                  value={item.type}
                  onChange={(e) =>
                    setItems((values) =>
                      values.map((v, i) =>
                        i === index ? { ...v, type: e.target.value } : v,
                      ),
                    )
                  }
                >
                  {Object.entries(changeTypes).map(([value, label]) => (
                    <option key={value} value={value}>
                      {tr(label)}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                {tr("Deskripsi")}
                <textarea
                  required
                  minLength={3}
                  maxLength={1500}
                  value={item.description}
                  onChange={(e) =>
                    setItems((values) =>
                      values.map((v, i) =>
                        i === index ? { ...v, description: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              <label>
                {tr("Tiket")}
                <input
                  maxLength={100}
                  value={item.ticket}
                  onChange={(e) =>
                    setItems((values) =>
                      values.map((v, i) =>
                        i === index ? { ...v, ticket: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
              {items.length > 1 && (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    setItems((values) => values.filter((_, i) => i !== index))
                  }
                >
                  {tr("Hapus baris")}
                </button>
              )}
            </fieldset>
          ))}
          <div className="modal-actions">
            <button
              className="secondary"
              type="button"
              disabled={items.length >= 50}
              onClick={() =>
                setItems((values) => [
                  ...values,
                  { type: "ENHANCEMENT", description: "", ticket: "" },
                ])
              }
            >
              {tr("Tambah rincian")}
            </button>
            <button className="primary" disabled={busy}>
              {tr("Simpan perubahan")}
            </button>
          </div>
          <p className="hint">
            {tr(
              "Rincian yang sudah terdaftar dipertahankan. Buat catatan koreksi untuk memperbaiki informasi sebelumnya.",
            )}
          </p>
        </form>
      )}
      {data?.items.map((r: Row) => (
        <article className="panel release-card" key={r.id}>
          <header>
            <div>
              <span className="neutral-chip">
                {r.version} · {tr(r.environment)}
              </span>
              <h3>{r.title}</h3>
              <p>
                {date(r.deployed_at)} · {tr("Didaftarkan oleh")}{" "}
                {r.registered_by}
              </p>
            </div>
            <span className="badge">
              {r.status === "DEPLOYED"
                ? tr("Diterapkan")
                : statusLabel(r.status, locale)}
            </span>
          </header>
          {r.reference && (
            <p>
              {tr("Referensi")}: <code>{r.reference}</code>
            </p>
          )}
          {r.supersedes_id && (
            <p>
              {tr("Koreksi untuk rilis")}: <code>{r.supersedes_id}</code>
            </p>
          )}
          <ul>
            {r.items.map((item: Row, i: number) => (
              <li key={i}>
                <b>{tr(changeTypes[item.type])}</b>
                <p>{item.description}</p>
                {item.ticket && <code>{item.ticket}</code>}
              </li>
            ))}
          </ul>
          <details>
            <summary>{tr("Riwayat status")}</summary>
            <ol>
              {r.history.map((event: Row) => (
                <li key={event.id}>
                  {date(event.created_at)} ·{" "}
                  {event.status === "DEPLOYED"
                    ? tr("Diterapkan")
                    : statusLabel(event.status, locale)}{" "}
                  · {event.actor_name}
                  <p>
                    {event.reason === "Registered"
                      ? tr("Didaftarkan")
                      : event.reason}
                  </p>
                </li>
              ))}
            </ol>
          </details>
          {admin && r.status !== "ROLLED_BACK" && (
            <button
              className="secondary"
              onClick={() => {
                setTransition(r);
                setFailure("");
              }}
            >
              {tr(
                r.status === "PLANNED"
                  ? "Catat sebagai diterapkan"
                  : "Catat rollback",
              )}
            </button>
          )}
        </article>
      ))}
      {!loading && data?.items.length === 0 && (
        <p className="empty">{tr("Belum ada riwayat perubahan.")}</p>
      )}
      <div className="report-pagination">
        <button
          className="secondary"
          disabled={page === 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          {tr("Sebelumnya")}
        </button>
        <span>
          {tr("Halaman")} {page}
        </span>
        <button
          className="secondary"
          disabled={loading || page * 10 >= (data?.total ?? 0)}
          onClick={() => setPage((p) => p + 1)}
        >
          {tr("Berikutnya")}
        </button>
      </div>
      {transition && (
        <form
          className="panel governance-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setFailure("");
            setBusy(true);
            try {
              await request(
                `governance/releases/${transition.id}/status`,
                "POST",
                {
                  status:
                    transition.status === "PLANNED"
                      ? "DEPLOYED"
                      : "ROLLED_BACK",
                  expectedStatus: transition.status,
                  reason: new FormData(e.currentTarget).get("reason"),
                },
              );
              setTransition(null);
              reload();
            } catch (e) {
              setFailure((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>
            {tr("Perbarui status rilis")}: {transition.version}
          </h3>
          <label className="field">
            <span>{tr("Alasan perubahan")}</span>
            <textarea name="reason" required minLength={3} maxLength={500} />
          </label>
          <button className="primary" disabled={busy}>
            {tr("Simpan status")}
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => setTransition(null)}
          >
            {tr("Batal")}
          </button>
        </form>
      )}
    </>
  );
}
export function AboutApplication() {
  return (
    <section className="panel governance-form">
      <Info size={22} />
      <h2>One UMS Portal</h2>
      <p>{tr("Platform komunikasi dan kendali operasional perusahaan.")}</p>
      <dl className="detail-grid">
        <div>
          <dt>{tr("Pembuat")}</dt>
          <dd>Raditte Anggoro</dd>
        </div>
        <div>
          <dt>{tr("Identitas karya")}</dt>
          <dd>
            <code>RA.ONEUMS.2026.10</code>
          </dd>
        </div>
      </dl>
      <p className="hint">
        {tr(
          "Kredit dependensi dan inspirasi tersedia pada dokumentasi proyek.",
        )}
      </p>
    </section>
  );
}
