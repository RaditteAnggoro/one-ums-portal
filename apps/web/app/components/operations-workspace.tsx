"use client";
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
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 2,
  }).format(Number(value));
const number = (value: number) => new Intl.NumberFormat("id-ID").format(value);
const timestamp = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Jakarta",
      }).format(new Date(value))
    : "Tidak tersedia";
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
      {channelNames[value] ?? value}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <span className="badge-dot" />
      {statusNames[status] ?? status}
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
        <h3>Data belum dapat dimuat</h3>
        <p>{error}</p>
        <button className="secondary" onClick={retry}>
          Coba lagi
        </button>
      </div>
    );
  if (loading)
    return (
      <div className="ops-skeleton" role="status" aria-label="Memuat data">
        <span />
        <span />
        <span />
      </div>
    );
  return (
    <div className="ops-state">
      <MessagesSquare size={28} />
      <h3>{empty ?? "Belum ada data pada periode ini"}</h3>
      <p>
        Sesuaikan filter atau jalankan kampanye simulasi untuk mulai memantau.
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
        {label}
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
          <span className="muted">{note ?? "Pembanding tidak tersedia"}</span>
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
            vs periode sebelumnya
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
          <h3>Aktivitas pengiriman</h3>
          <p>Logical messages · Asia/Jakarta</p>
        </div>
        <div className="segmented">
          <button
            className={mode === "volume" ? "active" : ""}
            onClick={() => setMode("volume")}
          >
            Volume
          </button>
          <button
            className={mode === "delivery" ? "active" : ""}
            onClick={() => setMode("delivery")}
          >
            Delivery
          </button>
        </div>
      </div>
      {rows.length ? (
        <>
          <div className="volume-chart">
            <svg
              viewBox="0 0 710 240"
              role="img"
              aria-label={`Jumlah ${mode === "volume" ? "pesan" : "pesan tersampaikan"} per hari. Data tabel tersedia di bawah.`}
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
                      {number(mode === "volume" ? r.total : r.delivered)} pesan
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
              {mode === "volume" ? "Message requests" : "Confirmed delivery"}
            </span>
            <button
              className="text-btn"
              aria-expanded={table}
              onClick={() => setTable(!table)}
            >
              {table ? "Tutup" : "Lihat"} data tabel
            </button>
          </div>
          {table && (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Data volume harian</caption>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Requests</th>
                    <th>Delivered</th>
                    <th>Gagal</th>
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
            <th>Waktu · WIB</th>
            <th>Message ID</th>
            <th>Kanal</th>
            <th>Vendor</th>
            <th>Status</th>
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
                  aria-label={`Detail pesan ${r.id}`}
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
      <span>Belum ada kegagalan atau hasil tidak pasti pada periode ini.</span>
    </div>
  );
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
  const { data, error, loading, reload } = useRemote(
    request,
    `operations/summary?days=${days}&channel=${channel}`,
  );
  if (!data) return <State loading={loading} error={error} retry={reload} />;
  const t = data.totals,
    p = data.previous;
  return (
    <div className="operations-dashboard">
      <div className="observation-bar">
        <span>
          <span className="status-dot" />
          Local simulation{" "}
          <span className="muted">
            · Diperbarui {timestamp(data.observedAt)}
          </span>
        </span>
        <button className="text-btn" onClick={reload}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
      <div className={`metrics-row ${canCosts ? "" : "four"}`}>
        <Metric
          label="Message requests"
          value={number(t.total)}
          raw={t.total}
          previous={p?.total}
          icon={MessagesSquare}
        />
        <Metric
          label="Confirmed delivery"
          value={number(t.delivered)}
          raw={t.delivered}
          previous={p?.delivered}
          icon={CheckCheck}
        />
        <Metric
          label="Delivery success rate"
          value={
            t.total ? `${((t.delivered / t.total) * 100).toFixed(1)}%` : "—"
          }
          icon={Activity}
          note="Delivered / seluruh requests"
        />
        <Metric
          label="Final failed"
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
            label="Estimated message cost"
            value={formatMoney(t.estimated_cost)}
            icon={Wallet}
            note="IDR · estimasi simulasi"
          />
        )}
      </div>
      <p className="metric-definition">
        {days === "all"
          ? "Seluruh data yang diizinkan."
          : `${days} hari terakhir; pembanding: ${days} hari sebelumnya.`}{" "}
        Persentase delivery = pesan terkonfirmasi / seluruh requests, termasuk
        pesan yang masih diproses. Hasil tidak pasti terpisah dari gagal final.
      </p>
      <div className="analytics-grid">
        <VolumeChart rows={data.trend} />
        <section className="panel analytics-panel channel-panel">
          <div className="panel-heading">
            <div>
              <h3>Performa kanal</h3>
              <p>Berdasarkan pesan yang teramati</p>
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
                          ? "Belum dikonfigurasi"
                          : "Belum ada pengamatan"}
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
            Delivery/read vendor nyata belum terhubung.
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
            <small>Queue backlog</small>
            <strong>
              {number(t.queued)} <em>messages</em>
            </strong>
            <small>
              {t.queued
                ? `Tertua: ${timestamp(data.oldestQueuedAt)}`
                : "Tidak ada pesan dalam antrean"}
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
            <small>Unconfirmed outcomes</small>
            <strong>
              {number(t.unknown)} <em>messages</em>
            </strong>
            <small>Periksa hasil sebelum mencoba ulang</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
        <button className="insight-card" onClick={() => navigate("channels")}>
          <span className="insight-icon">
            <Activity size={18} />
          </span>
          <span>
            <small>Provider observations</small>
            <strong>
              Simulation <em>only</em>
            </strong>
            <small>Tidak ada klaim health vendor nyata</small>
          </span>
          <ArrowUpRight size={16} />
        </button>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Perlu investigasi</h3>
            <p>Kegagalan final dan hasil belum terkonfirmasi terbaru</p>
          </div>
          <button
            className="text-btn"
            onClick={() => navigate("messages", `status=FAILED&days=${days}`)}
          >
            Message Explorer <ArrowRight size={14} />
          </button>
        </div>
        <FailureTable rows={data.failures} open={open} />
      </section>
      {data.trendTruncated && (
        <p className="hint">
          Grafik dibatasi 366 tanggal teramati. Pilih periode lebih pendek untuk
          investigasi.
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
            aria-label="Cari ID pesan"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message, provider, run, campaign ID…"
          />
          <button className="text-btn" type="submit">
            Cari
          </button>
        </form>
        <label>
          <span className="sr-only">Status pesan</span>
          <select
            aria-label="Status pesan"
            value={filters.status}
            onChange={(e) => change({ status: e.target.value })}
          >
            <option value="all">Semua status</option>
            {Object.entries(statusNames).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Kanal pesan</span>
          <select
            aria-label="Kanal pesan"
            value={filters.channel}
            onChange={(e) => change({ channel: e.target.value })}
          >
            <option value="all">Semua kanal</option>
            {["email", "sms", "whatsapp"].map((c) => (
              <option key={c} value={c}>
                {channelNames[c]}
              </option>
            ))}
          </select>
        </label>
        <select
          aria-label="Periode pesan"
          value={filters.days}
          onChange={(e) => change({ days: e.target.value })}
        >
          <option value="1">24 jam</option>
          <option value="7">7 hari</option>
          <option value="30">30 hari</option>
          <option value="90">90 hari</option>
          <option value="all">Semua waktu</option>
        </select>
        <button
          className="icon-btn"
          aria-label="Refresh pesan"
          onClick={reload}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="explorer-secondary">
        <div>
          <span>
            <ShieldCheck size={13} />
            Penerima disamarkan
          </span>
          {mode === "deliveries" && (
            <span>Tidak ada retry otomatis untuk status tidak pasti.</span>
          )}
        </div>
        <div>
          <select
            aria-label="Filter vendor"
            value={filters.provider}
            onChange={(e) => change({ provider: e.target.value })}
          >
            <option value="">Semua vendor</option>
            {choices.data?.providers.map((p: Row) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {choices.data?.teams.length > 1 && (
            <select
              aria-label="Filter unit bisnis"
              value={filters.team}
              onChange={(e) => change({ team: e.target.value })}
            >
              <option value="">Semua tim yang diizinkan</option>
              {choices.data?.teams.map((t: Row) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="text-btn"
            aria-pressed={compact}
            onClick={() => setCompact(!compact)}
          >
            Compact
          </button>
          <button
            className="text-btn"
            aria-pressed={showIds}
            onClick={() => setShowIds(!showIds)}
          >
            Provider ID
          </button>
        </div>
      </div>
      {!ready || !data ? (
        <State loading={!ready || loading} error={error} retry={reload} />
      ) : data.items.length ? (
        <div className="table-wrap">
          <table className={`operations-table ${compact ? "compact" : ""}`}>
            <thead>
              <tr>
                <th>Message ID</th>
                <th>Dibuat · WIB</th>
                <th>Tim / kampanye</th>
                <th>Kanal</th>
                <th>Vendor</th>
                <th>Penerima</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Latency</th>
                {canCosts && <th>Est. IDR</th>}
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
                        title={m.provider_ref ?? "Belum tersedia"}
                      >
                        {m.provider_ref?.slice(0, 16) ?? "Provider ID —"}
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
                      aria-label={`Detail pesan ${m.id}`}
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
        <State loading={false} empty="Tidak ada pesan yang cocok" />
      )}
      <div className="table-footer">
        <span>
          Halaman {cursors.length + 1} · {data?.items.length ?? 0} pesan ·
          terbaru dahulu
        </span>
        <div>
          <button
            className="secondary"
            disabled={!cursors.length || loading}
            onClick={() => setCursors((c) => c.slice(0, -1))}
          >
            <ChevronLeft size={14} />
            Sebelumnya
          </button>
          <button
            className="secondary"
            disabled={!data?.nextCursor || loading}
            onClick={() => setCursors((c) => [...c, data!.nextCursor])}
          >
            Berikutnya
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
  if (!data) return <State loading={loading} error={error} retry={reload} />;
  const m = data.message;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.id);
      setCopied(true);
    } catch {
      setResolveError("Salin ID secara manual jika clipboard tidak tersedia.");
    }
  };
  return (
    <div className="message-investigation">
      <div className="drawer-intro">
        <span className="eyebrow">LOGICAL MESSAGE · SIMULATION</span>
        <div>
          <code>{m.id}</code>
          <button
            className="icon-btn"
            aria-label="Salin message ID"
            onClick={() => void copy()}
          >
            <Copy size={15} />
          </button>
        </div>
        {copied && <small role="status">Message ID disalin.</small>}
        <StatusBadge status={m.status} />
      </div>
      <div className="drawer-tabs" role="tablist" aria-label="Detail pesan">
        {[
          ["summary", "Ringkasan"],
          ["timeline", "Timeline"],
          ["attempts", "Attempts & errors"],
          ["payload", "Payload & audit"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`message-tab-${key}`}
            id={`message-tab-button-${key}`}
            onClick={() => setTab(key)}
          >
            {label}
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
                ["Kanal", channelNames[m.channel]],
                ["Run ID", m.run_id],
                ["Campaign ID", m.campaign_id],
                ["Provider reference", m.provider_ref ?? "Belum tersedia"],
                ["Dibuat · WIB", timestamp(m.created_at)],
                ["Diperbarui · WIB", timestamp(m.updated_at)],
                [
                  "Biaya estimasi",
                  m.unit_cost !== undefined
                    ? formatMoney(m.unit_cost)
                    : "Akses terbatas",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="info-callout">
              <ShieldCheck size={18} />
              <p>
                Persetujuan vendor berbeda dari konfirmasi delivery. Hasil belum
                terkonfirmasi tidak dikirim ulang secara otomatis.
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
                  <p>{event.detail ?? "Perubahan status tercatat"}</p>
                  <time className="mono">{timestamp(event.created_at)}</time>
                  <small className="mono">Event {event.id}</small>
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
                    <th>Attempt</th>
                    <th>Status</th>
                    <th>Waktu · WIB</th>
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
              <p className="hint">Belum ada dispatch attempt.</p>
            )}
            <div className="info-callout">
              <AlertCircle size={18} />
              <p>
                Manual retry belum tersedia. Tinjau status dan riwayat agar
                pesan tidak terkirim ganda.
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
                  ? "Akses payload dicatat pada audit log. Penerima tetap disamarkan."
                  : "Payload dibatasi untuk admin atau peran dengan izin messages:payload."}
              </p>
            </div>
            {data.payloadAvailable && (
              <pre className="payload-preview">{m.body}</pre>
            )}
            <dl className="detail-grid">
              <div>
                <dt>Provider account version</dt>
                <dd>{m.provider_version_id ?? "Tidak tersedia"}</dd>
              </div>
              <div>
                <dt>Template version</dt>
                <dd>Snapshot kampanye terkait</dd>
              </div>
              <div>
                <dt>Correlation ID</dt>
                <dd>Tidak tersedia pada kontrak pesan saat ini</dd>
              </div>
            </dl>
          </>
        )}
      </div>
      {canResolve && m.status === "UNKNOWN" && (
        <details className="resolve-panel">
          <summary>Rekonsiliasi hasil simulasi</summary>
          <p className="hint">
            Hanya mengonfirmasi hasil simulator dan penyelesaian cadangan
            anggaran. Bukan persetujuan invoice vendor.
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
              <span>Hasil terkonfirmasi</span>
              <select name="status">
                <option value="DELIVERED">Tersampaikan</option>
                <option value="FAILED">Gagal</option>
              </select>
            </label>
            <label className="field">
              <span>Alasan dan bukti</span>
              <textarea name="reason" required minLength={3} maxLength={500} />
            </label>
            <label className="confirm-line">
              <input type="checkbox" required />
              Saya telah memeriksa hasil dan dampak anggarannya.
            </label>
            <button className="primary" disabled={busy}>
              Konfirmasi hasil simulasi
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
  if (!data) return <State loading={loading} error={error} retry={reload} />;
  return (
    <>
      <div className="info-callout">
        <Activity size={19} />
        <p>
          Jendela pengamatan: 7 hari. Metrik berasal dari simulator lokal;
          health, webhook delay, dan SLA vendor nyata belum tersedia.
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
                    ? "Not configured"
                    : r
                      ? "Simulated"
                      : "No observations"}
                </span>
              </div>
              <dl className="monitoring-metrics">
                <div>
                  <dt>Requests</dt>
                  <dd>{r ? number(r.total) : "—"}</dd>
                </div>
                <div>
                  <dt>Confirmed delivery</dt>
                  <dd>{r ? number(r.delivered) : "—"}</dd>
                </div>
                <div>
                  <dt>Final failures</dt>
                  <dd>{r ? number(r.failed) : "—"}</dd>
                </div>
                <div>
                  <dt>Delivery latency p95</dt>
                  <dd>
                    {r?.p95_ms !== null && r?.p95_ms !== undefined
                      ? `${Math.round(Number(r.p95_ms))} ms`
                      : "Tidak tersedia"}
                  </dd>
                </div>
                <div>
                  <dt>Queue backlog</dt>
                  <dd>{r ? number(r.queued) : "—"}</dd>
                </div>
                <div>
                  <dt>Oldest queued</dt>
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
                    Lihat pesan <ArrowRight size={14} />
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
                    Investigasi gagal
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
  const [days, setDays] = useState("30");
  const { data, error, loading, reload } = useRemote(
    request,
    `operations/usage?days=${days}`,
  );
  if (!data) return <State loading={loading} error={error} retry={reload} />;
  const total = (key: string) =>
    data.items
      .reduce((n: Decimal, r: Row) => n.add(r[key]), new Decimal(0))
      .toFixed(4);
  return (
    <>
      <div className="finance-toolbar">
        <span className="neutral-chip">IDR · internal simulation</span>
        <select
          aria-label="Periode biaya"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          <option value="7">7 hari</option>
          <option value="30">30 hari</option>
          <option value="90">90 hari</option>
          <option value="all">Semua waktu</option>
        </select>
        <button className="secondary" onClick={() => navigate("budgets")}>
          Alokasi biaya <ArrowRight size={14} />
        </button>
      </div>
      <div className="metrics-row finance-metrics">
        <Metric
          label="Logical messages"
          value={number(
            data.items.reduce((n: number, r: Row) => n + r.messages, 0),
          )}
          icon={MessagesSquare}
          note="Terpisah dari billable units"
        />
        <Metric
          label="Estimated cost"
          value={formatMoney(total("estimated_cost"))}
          icon={Wallet}
          note="Estimasi snapshot tarif"
        />
        <Metric
          label="Internal ledger spend"
          value={formatMoney(total("ledger_spend"))}
          icon={Receipt}
          note="Biaya simulasi yang dibukukan"
        />
        <Metric
          label="Provider / invoiced cost"
          value="—"
          icon={Scale}
          note="Belum terhubung"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Penggunaan vendor</h3>
            <p>Biaya internal, vendor, dan invoice tetap terpisah</p>
          </div>
          <button className="text-btn" onClick={reload}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        {data.items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Kanal</th>
                  <th>Tim</th>
                  <th>Messages</th>
                  <th>Est. cost · IDR</th>
                  <th>Ledger spend · IDR</th>
                  <th>Provider cost</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r: Row, i: number) => (
                  <tr key={i}>
                    <td>{r.provider}</td>
                    <td>
                      <Channel value={r.channel} />
                    </td>
                    <td>{r.team}</td>
                    <td>{number(r.messages)}</td>
                    <td className="tabular">{formatMoney(r.estimated_cost)}</td>
                    <td className="tabular">{formatMoney(r.ledger_spend)}</td>
                    <td className="muted">Tidak tersedia</td>
                    <td className="muted">Tidak tersedia</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <State loading={false} />
        )}
      </section>
      <div className="info-callout">
        <ShieldCheck size={18} />
        <p>
          Perhitungan internal menggunakan desimal dan snapshot tarif. Satu
          pesan tidak selalu satu billable unit; kuantitas tagihan, FX,
          provider-reported cost, dan invoice menunggu kontrak vendor yang
          terverifikasi.
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
          ["1", "Internal records", "Available", "active"],
          ["2", "Provider usage", "Not connected", ""],
          ["3", "Vendor invoices", "Not connected", ""],
          ["4", "Review & approval", "Not available", ""],
        ].map(([step, title, description, cls]) => (
          <div key={step} className={cls}>
            <span>{step}</span>
            <b>
              {title}
              <small>{description}</small>
            </b>
            {step !== "4" && <ChevronRight size={16} />}
          </div>
        ))}
      </div>
      <div className="info-callout">
        <Scale size={20} />
        <p>
          Workbench saat ini menampilkan hasil pengiriman yang belum
          terkonfirmasi. Matching invoice, variance, dan approval batch belum
          terhubung. Tidak ada status “matched” yang disimpulkan dari total
          saja.
        </p>
      </div>
      <div className="section-heading">
        <h2>Hasil yang memerlukan konfirmasi</h2>
        <span className="neutral-chip">Simulated outcomes</span>
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
