"use client";
import {
  statusLabel,
  messageStatusCodes,
} from "../../../../packages/domain/src/status";
import { Select } from "./select";
import { t as tr, localeTag, useLanguage } from "./i18n";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  CheckCheck,
  XCircle,
  Clock3,
  MessagesSquare,
  Wallet,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  Mail,
  MessageSquare,
  Smartphone,
  AlertCircle,
  Activity,
  Filter,
  ShieldCheck,
  Eye,
  Database,
  Receipt,
  Scale,
  ExternalLink,
} from "lucide-react";
import Decimal from "decimal.js";
type Row = Record<string, any>;
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export const formatMoney = (value: string | number) =>
  new Intl.NumberFormat(localeTag(), {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value));
const number = (value: number) =>
  new Intl.NumberFormat(localeTag()).format(value);
const timestamp = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat(localeTag(), {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value))
    : tr("Tidak tersedia");
const channelNames: Row = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push",
};
const statusNames: Row = {
  QUEUED: "Antrean",
  ACCEPTED: "Diterima vendor",
  SENT: "Dikirim vendor",
  DELIVERED: "Tersampaikan",
  FAILED: "Gagal final",
  UNKNOWN: "Belum terkonfirmasi",
  CANCELLED: "Dibatalkan",
};
function Channel({ value }: { value: string }) {
  const Icon =
    value === "email" ? Mail : value === "push" ? Smartphone : MessageSquare;
  return (
    <span className={`channel-label channel-${value}`}>
      <Icon size={15} />
      {tr(channelNames[value] ?? value)}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const { locale } = useLanguage();
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <span className="badge-dot" />
      {statusLabel(status, locale, "message")}
    </span>
  );
}
function useRemote(request: Api, url: string) {
  const [version, setVersion] = useState(0),
    [state, setState] = useState<{
      url: string;
      data: Row | null;
      error: string;
      loading: boolean;
    }>({ url: "", data: null, error: "", loading: true });
  useEffect(() => {
    let active = true;
    setState({ url, data: null, error: "", loading: true });
    request(url)
      .then((data) => {
        if (active) setState({ url, data, error: "", loading: false });
      })
      .catch((e) => {
        if (active)
          setState({ url, data: null, error: e.message, loading: false });
      });
    return () => {
      active = false;
    };
  }, [request, url, version]);
  return {
    ...(state.url === url ? state : { data: null, error: "", loading: true }),
    reload: () => setVersion((v) => v + 1),
  };
}
function State({
  loading,
  error,
  retry,
  empty,
}: {
  loading: boolean;
  error?: string;
  retry?: () => void;
  empty?: string;
}) {
  if (error)
    return (
      <div role="alert" className="ops-state error">
        <AlertCircle size={25} />
        <h3>{tr("Data belum dapat dimuat")}</h3>
        <p>{tr(error)}</p>
        <button className="secondary" onClick={retry}>
          {tr("Coba lagi")}
        </button>
      </div>
    );
  if (loading)
    return (
      <div
        className="ops-skeleton"
        role="status"
        aria-label={tr("Memuat data")}
      >
        <span />
        <span />
        <span />
      </div>
    );
  return (
    <div className="ops-state">
      <MessagesSquare size={28} />
      <h3>{empty ?? tr("Belum ada data pada periode ini")}</h3>
      <p>
        {tr(
          "Sesuaikan filter atau jalankan kampanye simulasi untuk mulai memantau.",
        )}
      </p>
    </div>
  );
}
function change(current: number, previous: number | undefined) {
  if (previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
function Metric({
  label,
  value,
  previous,
  raw,
  icon: Icon,
  onClick,
  note,
}: {
  label: string;
  value: string;
  previous?: number;
  raw?: number;
  icon: typeof MessagesSquare;
  onClick?: () => void;
  note?: string;
}) {
  const difference = change(raw ?? 0, previous);
  return (
    <article className="metric-card">
      <div className="metric-label">
        {tr(label)}
        <Icon size={16} />
      </div>
      {onClick ? (
        <button className="metric-value" onClick={onClick}>
          {value}
          <ArrowUpRight size={20} />
        </button>
      ) : (
        <strong className="metric-value">{value}</strong>
      )}
      <span
        className={`metric-change ${difference !== null && difference < 0 ? "down" : ""}`}
      >
        {difference === null ? (
          <span className="muted">
            {note ?? tr("Pembanding tidak tersedia")}
          </span>
        ) : (
          <>
            <span>
              {difference >= 0 ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}{" "}
              {Math.abs(difference).toFixed(1)}%
            </span>{" "}
            {tr("vs periode sebelumnya")}
          </>
        )}
      </span>
    </article>
  );
}
function VolumeChart({ rows }: { rows: Row[] }) {
  const [mode, setMode] = useState("volume"),
    [table, setTable] = useState(false);
  const max = Math.max(1, ...rows.map((r) => r.total));
  const points = rows
    .map(
      (r, i) =>
        `${44 + i * (630 / Math.max(1, rows.length - 1))},${200 - ((mode === "volume" ? r.total : r.delivered) / max) * 165}`,
    )
    .join(" ");
  return (
    <section className="panel analytics-panel volume-panel">
      <div className="panel-heading">
        <div>
          <h3>{tr("Aktivitas pengiriman")}</h3>
          <p>{tr("Logical messages \u00B7 Asia/Jakarta")}</p>
        </div>
        <div className="segmented">
          <button
            className={mode === "volume" ? "active" : ""}
            onClick={() => setMode("volume")}
          >
            {tr("Volume")}
          </button>
          <button
            className={mode === "delivery" ? "active" : ""}
            onClick={() => setMode("delivery")}
          >
            {tr("Delivery")}
          </button>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="volume-chart">
            <svg
              viewBox="0 0 710 240"
              role="img"
              aria-label={tr(
                "Jumlah {0} per hari. Data tabel tersedia di bawah.",
                { "0": mode === "volume" ? "pesan" : tr("pesan tersampaikan") },
              )}
            >
              {[0, 1, 2, 3].map((i) => (
                <g key={i}>
                  <line
                    x1="44"
                    x2="690"
                    y1={35 + i * 55}
                    y2={35 + i * 55}
                    stroke="var(--border)"
                    strokeDasharray="3 5"
                  />
                  <text x="4" y={40 + i * 55} fill="var(--muted)" fontSize="10">
                    {number(Math.round(max * (1 - i / 3)))}
                  </text>
                </g>
              ))}
              <polygon
                points={`44,200 ${points} ${44 + (rows.length - 1) * (630 / Math.max(1, rows.length - 1))},200`}
                fill="var(--brand-subtle)"
              />
              <polyline
                points={points}
                fill="none"
                stroke="var(--brand-primary)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              {rows.map((r, i) => (
                <g key={r.day}>
                  <circle
                    cx={44 + i * (630 / Math.max(1, rows.length - 1))}
                    cy={
                      200 -
                      ((mode === "volume" ? r.total : r.delivered) / max) * 165
                    }
                    r="3.5"
                    fill="var(--brand-primary)"
                  >
                    <title>
                      {r.day}:{" "}
                      {number(mode === "volume" ? r.total : r.delivered)}
                      {tr(" pesan")}
                    </title>
                  </circle>
                  {(rows.length < 8 || i === 0 || i === rows.length - 1) && (
                    <text
                      x={44 + i * (630 / Math.max(1, rows.length - 1))}
                      y="228"
                      textAnchor="middle"
                      fill="var(--muted)"
                      fontSize="10"
                    >
                      {r.day.slice(5)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
          <div className="chart-footer">
            <span>
              <i />{" "}
              {mode === "volume"
                ? tr("Message requests")
                : tr("Confirmed delivery")}
            </span>
            <button
              className="text-btn"
              aria-expanded={table}
              onClick={() => setTable(!table)}
            >
              {table ? tr("Tutup") : tr("Lihat")}
              {tr(" data tabel")}
            </button>
          </div>
          {table && (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  {tr("Data volume harian")}
                </caption>
                <thead>
                  <tr>
                    <th>{tr("Tanggal")}</th>
                    <th>{tr("Requests")}</th>
                    <th>{tr("Delivered")}</th>
                    <th>{tr("Gagal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.day}>
                      <td>{r.day}</td>
                      <td>{r.total}</td>
                      <td>{r.delivered}</td>
                      <td>{r.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <State loading={false} />
      )}
    </section>
  );
}
function FailureTable({
  rows,
  open,
}: {
  rows: Row[];
  open: (id: string) => void;
}) {
  return rows.length ? (
    <div className="table-wrap">
      <table className="operations-table">
        <thead>
          <tr>
            <th>{tr("Waktu \u00B7 WIB")}</th>
            <th>{tr("Message ID")}</th>
            <th>{tr("Kanal")}</th>
            <th>{tr("Vendor")}</th>
            <th>{tr("Status")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono">{timestamp(r.created_at)}</td>
              <td>
                <button className="id-link" onClick={() => open(r.id)}>
                  {r.id.slice(0, 8)}
                  <ArrowUpRight size={12} />
                </button>
                <small>{r.campaign}</small>
              </td>
              <td>
                <Channel value={r.channel} />
              </td>
              <td>{r.provider}</td>
              <td>
                <StatusBadge status={r.status} />
              </td>
              <td>
                <button
                  className="icon-btn"
                  aria-label={tr("Detail pesan {0}", { "0": r.id })}
                  onClick={() => open(r.id)}
                >
                  <ChevronRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="clear-state">
      <ShieldCheck size={22} />
      <span>
        {tr("Belum ada kegagalan atau hasil tidak pasti pada periode ini.")}
      </span>
    </div>
  );
}
function ReportFilters({
  request,
  value,
  change,
}: {
  request: Api;
  value: Record<string, string>;
  change: (value: Record<string, string>) => void;
}) {
  const { data } = useRemote(request, "operations/filters");
  return (
    <form
      className="report-filters"
      onSubmit={(e) => {
        e.preventDefault();
        change(
          Object.fromEntries(new FormData(e.currentTarget)) as Record<
            string,
            string
          >,
        );
      }}
    >
      <label>
        {tr("Koneksi vendor")}
        <Select name="provider" defaultValue={value.provider ?? ""}>
          <option value="">{tr("Semua koneksi")}</option>
          {data?.providers.map((p: Row) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </label>
      <label>
        {tr("Tanggal mulai")}
        <input type="date" name="from" defaultValue={value.from ?? ""} />
      </label>
      <label>
        {tr("Tanggal akhir")}
        <input type="date" name="to" defaultValue={value.to ?? ""} />
      </label>
      <button className="secondary">{tr("Terapkan filter")}</button>
    </form>
  );
}
function reportQuery(value: Record<string, string>) {
  return new URLSearchParams(
    Object.entries(value).filter(([, v]) => v),
  ).toString();
}
export function OperationsDashboard({
  request,
  days,
  channel,
  canCosts,
  navigate,
  open,
}: {
  request: Api;
  days: string;
  channel: string;
  canCosts: boolean;
  navigate: (key: string, query?: string) => void;
  open: (id: string) => void;
}) {
  const [report, setReport] = useState<Record<string, string>>({});
  const { data, error, loading, reload } = useRemote(
    request,
    `operations/summary?days=${days}&channel=${channel}&${reportQuery(report)}`,
  );
  if (!data)
    return <State loading={loading} error={tr(error)} retry={reload} />;
  const t = data.totals,
    p = data.previous;
  return (
    <div className="operations-dashboard">
      <ReportFilters request={request} value={report} change={setReport} />
      <section className="panel vendor-console">
        <div className="panel-heading">
          <h3>{tr("Performa koneksi vendor")}</h3>
          <p>
            {tr(
              "Maksimal 25 koneksi dan kanal dengan kegagalan terbanyak. Hasil belum terkonfirmasi dipisahkan.",
            )}
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  "Vendor",
                  "Koneksi",
                  "Kanal",
                  "Permintaan",
                  "Tersampaikan",
                  "Gagal",
                  "Belum terkonfirmasi",
                  "Rasio gagal",
                ].map((label) => (
                  <th key={label}>{tr(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.vendors?.map((v: Row, i: number) => (
                <tr key={i}>
                  <td>{v.vendor}</td>
                  <td>{v.connection}</td>
                  <td>
                    <Channel value={v.channel} />
                  </td>
                  <td>{number(v.total)}</td>
                  <td>{number(v.delivered)}</td>
                  <td>
                    <button
                      className="text-btn"
                      onClick={() =>
                        navigate(
                          "messages",
                          `days=${days}&status=FAILED&channel=${v.channel}&${reportQuery({ ...report, ...(v.provider_id ? { provider: v.provider_id } : {}) })}`,
                        )
                      }
                    >
                      {number(v.failed)}
                    </button>
                  </td>
                  <td>{number(v.unknown)}</td>
                  <td>{v.failure_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="observation-bar">
        <span>
          <span className="status-dot" />
          {tr("Ringkasan pengiriman")}{" "}
          <span className="muted">
            {tr("\u00B7 Diperbarui ")}
            {timestamp(data.observedAt)}
          </span>
        </span>
        <button className="text-btn" onClick={reload}>
          <RefreshCw size={13} />
          {tr("Refresh")}
        </button>
      </div>
      <div className={`metrics-row ${canCosts ? "" : "four"}`}>
        <Metric
          label={tr("Message requests")}
          value={number(t.total)}
          raw={t.total}
          previous={p?.total}
          icon={MessagesSquare}
        />
        <Metric
          label={tr("Confirmed delivery")}
          value={number(t.delivered)}
          raw={t.delivered}
          previous={p?.delivered}
          icon={CheckCheck}
        />
        <Metric
          label={tr("Delivery success rate")}
          value={
            t.total ? `${((t.delivered / t.total) * 100).toFixed(1)}%` : "—"
          }
          icon={Activity}
          note={tr("Delivered / seluruh requests")}
        />
        <Metric
          label={tr("Final failed")}
          value={number(t.failed)}
          raw={t.failed}
          previous={p?.failed}
          icon={XCircle}
          onClick={() =>
            navigate(
              "messages",
              `status=FAILED&days=${days}&channel=${channel}`,
            )
          }
        />
        {canCosts && (
          <Metric
            label={tr("Estimated message cost")}
            value={formatMoney(t.estimated_cost)}
            icon={Wallet}
            note={tr("IDR \u00B7 estimasi simulasi")}
          />
        )}
      </div>
      <p className="metric-definition">
        {days === "all"
          ? tr("Seluruh data yang diizinkan.")
          : `${days} hari terakhir; pembanding: ${days} hari sebelumnya.`}{" "}
        {tr(
          "Persentase delivery = pesan terkonfirmasi / seluruh requests, termasuk pesan yang masih diproses. Hasil tidak pasti terpisah dari gagal final.",
        )}
      </p>
      <div className="analytics-grid">
        <VolumeChart rows={data.trend} />
        <section className="panel analytics-panel channel-panel">
          <div className="panel-heading">
            <div>
              <h3>{tr("Performa kanal")}</h3>
              <p>{tr("Berdasarkan pesan yang teramati")}</p>
            </div>
            <Activity size={18} />
          </div>
          <div className="channel-performance">
            {["whatsapp", "email", "sms", "push"].map((channel) => {
              const r = data.channels.find((r: Row) => r.channel === channel);
              return (
                <button
                  key={channel}
                  onClick={() =>
                    channel !== "push" &&
                    navigate("messages", `channel=${channel}&days=${days}`)
                  }
                  disabled={channel === "push"}
                >
                  <span>
                    <Channel value={channel} />
                    <small>
                      {r
                        ? `${number(r.total)} requests`
                        : channel === "push"
                          ? tr("Belum dikonfigurasi")
                          : tr("Belum ada pengamatan")}
                    </small>
                  </span>
                  <span>
                    {r?.total
                      ? `${((r.delivered / r.total) * 100).toFixed(1)}%`
                      : "—"}
                    <i className="channel-meter">
                      <i
                        style={{
                          width: `${r?.total ? (r.delivered / r.total) * 100 : 0}%`,
                        }}
                      />
                    </i>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="panel-footnote">
            {tr("Delivery/read vendor nyata belum terhubung.")}
          </div>
        </section>
      </div>
      <div className="insight-grid">
        <button
          className="insight-card"
          onClick={() => navigate("deliveries", `status=QUEUED&days=${days}`)}
        >
          <span className="insight-icon">
            <Clock3 size={18} />
          </span>
          <span>
            <small>{tr("Queue backlog")}</small>
            <strong>
              {number(t.queued)} <em>{tr("messages")}</em>
            </strong>
            <small>
              {t.queued
                ? tr("Tertua: {0}", { "0": timestamp(data.oldestQueuedAt) })
                : tr("Tidak ada pesan dalam antrean")}
            </small>
          </span>
          <ArrowUpRight size={16} />
        </button>
        <button
          className="insight-card"
          onClick={() => navigate("messages", `status=UNKNOWN&days=${days}`)}
        >
          <span className="insight-icon amber">
            <AlertCircle size={18} />
          </span>
          <span>
            <small>{tr("Unconfirmed outcomes")}</small>
            <strong>
              {number(t.unknown)} <em>{tr("messages")}</em>
            </strong>
            <small>{tr("Periksa hasil sebelum mencoba ulang")}</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
        <button className="insight-card" onClick={() => navigate("channels")}>
          <span className="insight-icon">
            <Activity size={18} />
          </span>
          <span>
            <small>{tr("Provider observations")}</small>
            <strong>
              {tr("Simulation ")}
              <em>{tr("only")}</em>
            </strong>
            <small>{tr("Tidak ada klaim health vendor nyata")}</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>{tr("Perlu investigasi")}</h3>
            <p>{tr("Kegagalan final dan hasil belum terkonfirmasi terbaru")}</p>
          </div>
          <button
            className="text-btn"
            onClick={() => navigate("messages", `status=FAILED&days=${days}`)}
          >
            {tr("Message Explorer ")}
            <ArrowRight size={14} />
          </button>
        </div>
        <FailureTable rows={data.failures} open={open} />
      </section>
      {data.trendTruncated && (
        <p className="hint">
          {tr(
            "Grafik dibatasi 366 tanggal teramati. Pilih periode lebih pendek untuk investigasi.",
          )}
        </p>
      )}
    </div>
  );
}
function useExplorerFilters(mode: string) {
  const initial = {
    search: "",
    channel: "all",
    status:
      mode === "deliveries"
        ? "QUEUED"
        : mode === "reconciliation"
          ? "UNKNOWN"
          : "all",
    days: "7",
    provider: "",
    team: "",
  };
  const [filters, setFilters] = useState(initial),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setFilters({
      ...initial,
      ...Object.fromEntries(
        Object.entries(initial).map(([k, v]) => [k, p.get(k) ?? v]),
      ),
    });
    setReady(true);
  }, [mode]);
  const change = (next: Partial<typeof initial>) => {
    setFilters((old) => {
      const value = { ...old, ...next };
      const p = new URLSearchParams(
        Object.entries(value).filter(([, v]) => v !== ""),
      );
      window.history.replaceState(null, "", `${window.location.pathname}?${p}`);
      return value;
    });
  };
  return { filters, change, ready };
}
export function MessageExplorer({
  request,
  open,
  canCosts,
  mode = "messages",
}: {
  request: Api;
  open: (id: string) => void;
  canCosts: boolean;
  mode?: string;
}) {
  const { locale } = useLanguage();
  const { filters, change, ready } = useExplorerFilters(mode);
  const [draft, setDraft] = useState(""),
    [cursors, setCursors] = useState<string[]>([]),
    [compact, setCompact] = useState(false),
    [showIds, setShowIds] = useState(true);
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== ""),
  );
  if (cursors.length) params.set("cursor", cursors.at(-1)!);
  const { data, error, loading, reload } = useRemote(
    request,
    `operations/messages?${params}`,
  );
  const choices = useRemote(request, "operations/filters");
  useEffect(() => {
    setCursors([]);
    setDraft(filters.search);
  }, [JSON.stringify(filters)]);
  return (
    <section className="panel explorer-panel">
      <div className="filter-toolbar">
        <form
          className="search message-search"
          onSubmit={(e) => {
            e.preventDefault();
            change({ search: draft.trim() });
          }}
        >
          <Search size={16} />
          <input
            aria-label={tr("Cari ID pesan")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={tr("Message, provider, run, campaign ID\u2026")}
          />
          <button className="text-btn" type="submit">
            {tr("Cari")}
          </button>
        </form>
        <label>
          <span className="sr-only">{tr("Status pesan")}</span>
          <Select
            aria-label={tr("Status pesan")}
            value={filters.status}
            onChange={(e) => change({ status: e.target.value })}
          >
            <option value="all">{tr("Semua status")}</option>
            {messageStatusCodes.map((key) => (
              <option key={key} value={key}>
                {statusLabel(key, locale, "message")}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="sr-only">{tr("Kanal pesan")}</span>
          <Select
            aria-label={tr("Kanal pesan")}
            value={filters.channel}
            onChange={(e) => change({ channel: e.target.value })}
          >
            <option value="all">{tr("Semua kanal")}</option>
            {["email", "sms", "whatsapp"].map((c) => (
              <option key={c} value={c}>
                {tr(channelNames[c])}
              </option>
            ))}
          </Select>
        </label>
        <Select
          aria-label={tr("Periode pesan")}
          value={filters.days}
          onChange={(e) => change({ days: e.target.value })}
        >
          <option value="1">{tr("24 jam")}</option>
          <option value="7">{tr("7 hari")}</option>
          <option value="30">{tr("30 hari")}</option>
          <option value="90">{tr("90 hari")}</option>
          <option value="all">{tr("Semua waktu")}</option>
        </Select>
        <button
          className="icon-btn"
          aria-label={tr("Refresh pesan")}
          onClick={reload}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="explorer-secondary">
        <div>
          <span>
            <ShieldCheck size={13} />
            {tr("Penerima disamarkan")}
          </span>
          {mode === "deliveries" && (
            <span>
              {tr("Tidak ada retry otomatis untuk status tidak pasti.")}
            </span>
          )}
        </div>
        <div>
          <Select
            aria-label={tr("Filter vendor")}
            value={filters.provider}
            onChange={(e) => change({ provider: e.target.value })}
          >
            <option value="">{tr("Semua vendor")}</option>
            {choices.data?.providers.map((p: Row) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          {choices.data?.teams.length > 1 && (
            <Select
              aria-label={tr("Filter unit bisnis")}
              value={filters.team}
              onChange={(e) => change({ team: e.target.value })}
            >
              <option value="">{tr("Semua tim yang diizinkan")}</option>
              {choices.data?.teams.map((t: Row) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          )}
          <button
            className="text-btn"
            aria-pressed={compact}
            onClick={() => setCompact(!compact)}
          >
            {tr("Compact")}
          </button>
          <button
            className="text-btn"
            aria-pressed={showIds}
            onClick={() => setShowIds(!showIds)}
          >
            {tr("Provider ID")}
          </button>
        </div>
      </div>
      {!ready || !data ? (
        <State loading={!ready || loading} error={tr(error)} retry={reload} />
      ) : data.items.length ? (
        <div className="table-wrap">
          <table className={`operations-table ${compact ? "compact" : ""}`}>
            <thead>
              <tr>
                <th>{tr("Message ID")}</th>
                <th>{tr("Dibuat \u00B7 WIB")}</th>
                <th>{tr("Tim / kampanye")}</th>
                <th>{tr("Kanal")}</th>
                <th>{tr("Vendor")}</th>
                <th>{tr("Penerima")}</th>
                <th>{tr("Status")}</th>
                <th>{tr("Attempts")}</th>
                <th>{tr("Latency")}</th>
                {canCosts && <th>{tr("Est. IDR")}</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((m: Row) => (
                <tr key={m.id}>
                  <td>
                    <button
                      className="id-link mono"
                      title={m.id}
                      onClick={() => open(m.id)}
                    >
                      {m.id.slice(0, 8)}
                      <ArrowUpRight size={12} />
                    </button>
                    {showIds && (
                      <small
                        className="mono"
                        title={m.provider_ref ?? tr("Belum tersedia")}
                      >
                        {m.provider_ref?.slice(0, 16) ??
                          tr("Provider ID \u2014")}
                      </small>
                    )}
                  </td>
                  <td className="mono">{timestamp(m.created_at)}</td>
                  <td>
                    {m.team}
                    <small>{m.campaign}</small>
                  </td>
                  <td>
                    <Channel value={m.channel} />
                  </td>
                  <td>{m.provider}</td>
                  <td className="mono">{m.recipient_masked}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="tabular">{m.attempt_count}</td>
                  <td className="tabular">
                    {m.latency_ms === null
                      ? "—"
                      : `${number(Number(m.latency_ms))} ms`}
                  </td>
                  {canCosts && (
                    <td className="tabular">{formatMoney(m.estimated_cost)}</td>
                  )}
                  <td>
                    <button
                      className="icon-btn"
                      aria-label={tr("Detail pesan {0}", { "0": m.id })}
                      onClick={() => open(m.id)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <State loading={false} empty={tr("Tidak ada pesan yang cocok")} />
      )}
      <div className="table-footer">
        <span>
          {tr("Halaman ")}
          {cursors.length + 1} · {data?.items.length ?? 0}
          {tr(" pesan \u00B7 terbaru dahulu")}
        </span>
        <div>
          <button
            className="secondary"
            disabled={!cursors.length || loading}
            onClick={() => setCursors((c) => c.slice(0, -1))}
          >
            <ChevronLeft size={14} />
            {tr("Sebelumnya")}
          </button>
          <button
            className="secondary"
            disabled={!data?.nextCursor || loading}
            onClick={() => setCursors((c) => [...c, data!.nextCursor])}
          >
            {tr("Berikutnya")}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
export function MessageInvestigation({
  request,
  id,
  canResolve,
  onChanged,
}: {
  request: Api;
  id: string;
  canResolve: boolean;
  onChanged: () => void;
}) {
  const { data, error, loading, reload } = useRemote(request, `messages/${id}`);
  const [tab, setTab] = useState("summary"),
    [busy, setBusy] = useState(false),
    [resolveError, setResolveError] = useState(""),
    [copied, setCopied] = useState(false);
  if (!data)
    return <State loading={loading} error={tr(error)} retry={reload} />;
  const m = data.message;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.id);
      setCopied(true);
    } catch {
      setResolveError(
        tr("Salin ID secara manual jika clipboard tidak tersedia."),
      );
    }
  };
  return (
    <div className="message-investigation">
      <div className="drawer-intro">
        <span className="eyebrow">
          {tr("LOGICAL MESSAGE \u00B7 SIMULATION")}
        </span>
        <div>
          <code>{m.id}</code>
          <button
            className="icon-btn"
            aria-label={tr("Salin message ID")}
            onClick={() => void copy()}
          >
            <Copy size={15} />
          </button>
        </div>
        {copied && <small role="status">{tr("Message ID disalin.")}</small>}
        <StatusBadge status={m.status} />
      </div>
      <div
        className="drawer-tabs"
        role="tablist"
        aria-label={tr("Detail pesan")}
      >
        {[
          ["summary", "Ringkasan"],
          ["timeline", tr("Timeline")],
          ["attempts", tr("Attempts & errors")],
          ["payload", tr("Payload & audit")],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`message-tab-${key}`}
            id={`message-tab-button-${key}`}
            onClick={() => setTab(key)}
          >
            {tr(label)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`message-tab-${tab}`}
        aria-labelledby={`message-tab-button-${tab}`}
        className="drawer-tab-content"
      >
        {tab === "summary" && (
          <>
            <dl className="detail-grid">
              {[
                ["Penerima", m.recipient_masked],
                [tr("Kanal"), channelNames[m.channel]],
                [tr("Run ID"), m.run_id],
                [tr("Campaign ID"), m.campaign_id],
                [
                  tr("Provider reference"),
                  m.provider_ref ?? tr("Belum tersedia"),
                ],
                [tr("Dibuat \u00B7 WIB"), timestamp(m.created_at)],
                [tr("Diperbarui \u00B7 WIB"), timestamp(m.updated_at)],
                [
                  tr("Biaya estimasi"),
                  m.unit_cost !== undefined
                    ? formatMoney(m.unit_cost)
                    : tr("Akses terbatas"),
                ],
              ].map(([label, value]) => (
                <div key={tr(label)}>
                  <dt>{tr(label)}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="info-callout">
              <ShieldCheck size={18} />
              <p>
                {tr(
                  "Persetujuan vendor berbeda dari konfirmasi delivery. Hasil belum terkonfirmasi tidak dikirim ulang secara otomatis.",
                )}
              </p>
            </div>
          </>
        )}
        {tab === "timeline" && (
          <ol className="delivery-timeline">
            {data.events.map((event: Row) => (
              <li key={event.id}>
                <span
                  className={`timeline-dot ${event.status.toLowerCase()}`}
                />
                <div>
                  <StatusBadge status={event.status} />
                  <p>{event.detail ?? tr("Perubahan status tercatat")}</p>
                  <time className="mono">{timestamp(event.created_at)}</time>
                  <small className="mono">
                    {tr("Event ")}
                    {event.id}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        )}
        {tab === "attempts" && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr("Attempt")}</th>
                    <th>{tr("Status")}</th>
                    <th>{tr("Waktu \u00B7 WIB")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attempts.map((a: Row) => (
                    <tr key={a.id}>
                      <td>
                        <span className="mono">{a.id.slice(0, 8)}</span>
                        <small>{a.provider}</small>
                      </td>
                      <td>
                        <StatusBadge status={a.status} />
                        <small>{a.detail}</small>
                      </td>
                      <td>{timestamp(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.attempts.length && (
              <p className="hint">{tr("Belum ada dispatch attempt.")}</p>
            )}
            <div className="info-callout">
              <AlertCircle size={18} />
              <p>
                {tr(
                  "Manual retry belum tersedia. Tinjau status dan riwayat agar pesan tidak terkirim ganda.",
                )}
              </p>
            </div>
          </>
        )}
        {tab === "payload" && (
          <>
            <div className="info-callout">
              <ShieldCheck size={18} />
              <p>
                {data.payloadAvailable
                  ? tr(
                      "Akses payload dicatat pada audit log. Penerima tetap disamarkan.",
                    )
                  : tr(
                      "Payload dibatasi untuk admin atau peran dengan izin messages:payload.",
                    )}
              </p>
            </div>
            {data.payloadAvailable && (
              <pre className="payload-preview">{m.body}</pre>
            )}
            <dl className="detail-grid">
              <div>
                <dt>{tr("Provider account version")}</dt>
                <dd>{m.provider_version_id ?? tr("Tidak tersedia")}</dd>
              </div>
              <div>
                <dt>{tr("Template version")}</dt>
                <dd>{tr("Snapshot kampanye terkait")}</dd>
              </div>
              <div>
                <dt>{tr("Correlation ID")}</dt>
                <dd>{tr("Tidak tersedia pada kontrak pesan saat ini")}</dd>
              </div>
            </dl>
          </>
        )}
      </div>
      {canResolve && m.status === "UNKNOWN" && (
        <details className="resolve-panel">
          <summary>{tr("Rekonsiliasi hasil simulasi")}</summary>
          <p className="hint">
            {tr(
              "Hanya mengonfirmasi hasil simulator dan penyelesaian cadangan anggaran. Bukan persetujuan invoice vendor.",
            )}
          </p>
          {resolveError && (
            <p role="alert" className="alert error">
              {resolveError}
            </p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setResolveError("");
              try {
                await request(`messages/${id}/reconcile`, "POST", {
                  status: f.get("status"),
                  reason: f.get("reason"),
                });
                reload();
                onChanged();
              } catch (e) {
                setResolveError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>{tr("Hasil terkonfirmasi")}</span>
              <Select name="status">
                <option value="DELIVERED">{tr("Tersampaikan")}</option>
                <option value="FAILED">{tr("Gagal")}</option>
              </Select>
            </label>
            <label className="field">
              <span>{tr("Alasan dan bukti")}</span>
              <textarea name="reason" required minLength={3} maxLength={500} />
            </label>
            <label className="confirm-line">
              <input type="checkbox" required />
              {tr("Saya telah memeriksa hasil dan dampak anggarannya.")}
            </label>
            <button className="primary" disabled={busy}>
              {tr("Konfirmasi hasil simulasi")}
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
export function ChannelMonitoring({
  request,
  navigate,
}: {
  request: Api;
  navigate: (key: string, query?: string) => void;
}) {
  const { data, error, loading, reload } = useRemote(
    request,
    "operations/summary?days=7",
  );
  if (!data)
    return <State loading={loading} error={tr(error)} retry={reload} />;
  return (
    <>
      <div className="info-callout">
        <Activity size={19} />
        <p>
          {tr(
            "Jendela pengamatan: 7 hari. Metrik penyedia uji tidak membuktikan health, webhook delay, atau SLA vendor.",
          )}
        </p>
      </div>
      <div className="monitoring-grid">
        {["whatsapp", "email", "sms", "push"].map((channel) => {
          const r = data.channels.find((r: Row) => r.channel === channel);
          return (
            <section className="panel monitoring-card" key={channel}>
              <div className="panel-heading">
                <Channel value={channel} />
                <span className="neutral-chip">
                  {channel === "push"
                    ? tr("Not configured")
                    : r
                      ? tr("Simulated")
                      : tr("No observations")}
                </span>
              </div>
              <dl className="monitoring-metrics">
                <div>
                  <dt>{tr("Requests")}</dt>
                  <dd>{r ? number(r.total) : "—"}</dd>
                </div>
                <div>
                  <dt>{tr("Confirmed delivery")}</dt>
                  <dd>{r ? number(r.delivered) : "—"}</dd>
                </div>
                <div>
                  <dt>{tr("Final failures")}</dt>
                  <dd>{r ? number(r.failed) : "—"}</dd>
                </div>
                <div>
                  <dt>{tr("Delivery latency p95")}</dt>
                  <dd>
                    {r?.p95_ms !== null && r?.p95_ms !== undefined
                      ? `${Math.round(Number(r.p95_ms))} ms`
                      : tr("Tidak tersedia")}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Queue backlog")}</dt>
                  <dd>{r ? number(r.queued) : "—"}</dd>
                </div>
                <div>
                  <dt>{tr("Oldest queued")}</dt>
                  <dd>{timestamp(r?.oldest_queued_at)}</dd>
                </div>
              </dl>
              {channel !== "push" && (
                <div className="monitoring-actions">
                  <button
                    className="secondary"
                    onClick={() =>
                      navigate("messages", `channel=${channel}&days=7`)
                    }
                  >
                    {tr("Lihat pesan ")}
                    <ArrowRight size={14} />
                  </button>
                  <button
                    className="text-btn"
                    onClick={() =>
                      navigate(
                        "messages",
                        `channel=${channel}&status=FAILED&days=7`,
                      )
                    }
                  >
                    {tr("Investigasi gagal")}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
export function VendorUsage({
  request,
  navigate,
}: {
  request: Api;
  navigate: (key: string) => void;
}) {
  const [report, setReport] = useState<Record<string, string>>({}),
    [page, setPage] = useState(1);
  const [days, setDays] = useState("30");
  const { data, error, loading, reload } = useRemote(
    request,
    `operations/usage?days=${days}&page=${page}&${reportQuery(report)}`,
  );
  if (!data)
    return <State loading={loading} error={tr(error)} retry={reload} />;
  const total = (key: string) => data.totals[key] ?? "0";
  return (
    <>
      <ReportFilters
        request={request}
        value={report}
        change={(v) => {
          setReport(v);
          setPage(1);
        }}
      />
      <div className="finance-toolbar">
        <span className="neutral-chip">
          {tr("IDR \u00B7 internal simulation")}
        </span>
        <Select
          aria-label={tr("Periode biaya")}
          value={days}
          onChange={(e) => {
            setDays(e.target.value);
            setPage(1);
          }}
        >
          <option value="7">{tr("7 hari")}</option>
          <option value="30">{tr("30 hari")}</option>
          <option value="90">{tr("90 hari")}</option>
          <option value="all">{tr("Semua waktu")}</option>
        </Select>
        <button className="secondary" onClick={() => navigate("budgets")}>
          {tr("Alokasi biaya ")}
          <ArrowRight size={14} />
        </button>
      </div>
      <div className="metrics-row finance-metrics">
        <Metric
          label={tr("Logical messages")}
          value={number(Number(data.totals.messages))}
          icon={MessagesSquare}
          note={tr("Terpisah dari billable units")}
        />
        <Metric
          label={tr("Estimated cost")}
          value={formatMoney(total("estimated_cost"))}
          icon={Wallet}
          note={tr("Estimasi snapshot tarif")}
        />
        <Metric
          label={tr("Internal ledger spend")}
          value={formatMoney(total("ledger_spend"))}
          icon={Receipt}
          note={tr("Biaya simulasi yang dibukukan")}
        />
        <Metric
          label={tr("Provider / invoiced cost")}
          value="—"
          icon={Scale}
          note={tr("Belum terhubung")}
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>{tr("Penggunaan vendor")}</h3>
            <p>{tr("Biaya internal, vendor, dan invoice tetap terpisah")}</p>
          </div>
          <button className="text-btn" onClick={reload}>
            <RefreshCw size={14} />
            {tr("Refresh")}
          </button>
        </div>
        {data.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("Pusat biaya")}</th>
                  <th>{tr("Vendor")}</th>
                  <th>{tr("Koneksi")}</th>
                  <th>{tr("Kanal")}</th>
                  <th>{tr("Tim")}</th>
                  <th>{tr("Messages")}</th>
                  <th>{tr("Est. cost \u00B7 IDR")}</th>
                  <th>{tr("Ledger spend \u00B7 IDR")}</th>
                  <th>{tr("Provider cost")}</th>
                  <th>{tr("Invoice")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r: Row, i: number) => (
                  <tr key={i}>
                    <td>{r.cost_centre}</td>
                    <td>{r.vendor}</td>
                    <td>{r.provider}</td>
                    <td>
                      <Channel value={r.channel} />
                    </td>
                    <td>{r.team}</td>
                    <td>{number(r.messages)}</td>
                    <td className="tabular">{formatMoney(r.estimated_cost)}</td>
                    <td className="tabular">{formatMoney(r.ledger_spend)}</td>
                    <td className="muted">{tr("Tidak tersedia")}</td>
                    <td className="muted">{tr("Tidak tersedia")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <State loading={false} />
        )}
      </section>
      <div className="report-pagination">
        <button
          className="secondary"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          {tr("Sebelumnya")}
        </button>
        <span>
          {tr("Halaman")} {page} · {data.totalGroups} {tr("kelompok biaya")}
        </span>
        <button
          className="secondary"
          disabled={!data.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          {tr("Berikutnya")}
        </button>
      </div>
      <div className="info-callout">
        <ShieldCheck size={18} />
        <p>
          {tr(
            "Perhitungan internal menggunakan desimal dan snapshot tarif. Satu pesan tidak selalu satu billable unit; kuantitas tagihan, FX, provider-reported cost, dan invoice menunggu kontrak vendor yang terverifikasi.",
          )}
        </p>
      </div>
    </>
  );
}
export function ReconciliationWorkspace({
  request,
  open,
}: {
  request: Api;
  open: (id: string) => void;
}) {
  return (
    <>
      <div className="reconciliation-stages">
        {[
          ["1", tr("Internal records"), "Available", "active"],
          ["2", tr("Provider usage"), tr("Not connected"), ""],
          ["3", tr("Vendor invoices"), tr("Not connected"), ""],
          ["4", tr("Review & approval"), tr("Not available"), ""],
        ].map(([step, title, description, cls]) => (
          <div key={step} className={cls}>
            <span>{step}</span>
            <b>
              {title}
              <small>{tr(description)}</small>
            </b>
            {step !== "4" && <ChevronRight size={16} />}
          </div>
        ))}
      </div>
      <div className="info-callout">
        <Scale size={20} />
        <p>
          {tr(
            "Workbench saat ini menampilkan hasil pengiriman yang belum terkonfirmasi. Matching invoice, variance, dan approval batch belum terhubung. Tidak ada status \u201Cmatched\u201D yang disimpulkan dari total saja.",
          )}
        </p>
      </div>
      <div className="section-heading">
        <h2>{tr("Hasil yang memerlukan konfirmasi")}</h2>
        <span className="neutral-chip">{tr("Simulated outcomes")}</span>
      </div>
      <MessageExplorer
        request={request}
        open={open}
        canCosts
        mode="reconciliation"
      />
    </>
  );
}
