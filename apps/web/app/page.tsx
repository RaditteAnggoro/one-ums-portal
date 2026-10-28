"use client";
import { Select } from "./components/select";
import {
  useCallback,
  useEffect,
  useState,
  useId,
  useRef,
  isValidElement,
  cloneElement,
  createContext,
  useContext,
  type ReactElement,
  type FormEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  AppSidebar,
  AppHeader,
  UMSBrand,
  CommandSearch,
  useShellPreferences,
  navigation,
  pageForPath,
  pathForPage,
} from "./components/app-chrome";
import {
  OperationsDashboard,
  MessageExplorer,
  MessageInvestigation,
  ChannelMonitoring,
  VendorUsage,
  ReconciliationWorkspace,
} from "./components/operations-workspace";
import { t as tr, localeTag, useLanguage } from "./components/i18n";
import { HelpCenter } from "./components/help-center";
import { PushSettings } from "./components/push-settings";
import { CompanyPanel } from "./components/company-panel";
import { AdminPanel } from "./admin-panel";
import { ProviderPanel } from "./provider-panel";
import { DashboardEditor } from "./dashboard-editor";
import { SourcePanel } from "./source-panel";
import { DateTime } from "luxon";
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  Wallet,
  X,
  Database,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
type Row = Record<string, any>;
const ledgerLabels: Record<string, string> = {
  ALLOCATE: "Alokasi",
  RESERVE: "Cadangan",
  SPEND: "Biaya",
  RELEASE: "Pelepasan",
  ADJUST: "Penyesuaian",
};
const DialogErrorContext = createContext({ message: "", clear: () => {} });
type Bootstrap = {
  user: Row;
  campaigns: Row[];
  templates: Row[];
  datasets: Row[];
  budgets: Row[];
  costCentres: Row[];
  notifications: Row[];
  roles: Row[];
  policy: Row;
  config?: Row;
  stats: Row[];
};
const money = (n: string | number) =>
  new Intl.NumberFormat(localeTag(), {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n));
const date = (v: string) =>
  new Intl.DateTimeFormat(localeTag(), {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(v));
const labels: Record<string, string> = {
  DRAFT: "Draf",
  PENDING_APPROVAL: "Menunggu persetujuan",
  APPROVED: "Disetujui",
  SCHEDULED: "Terjadwal",
  REJECTED: "Ditolak",
  RETURNED: "Perlu revisi",
  QUEUED: "Dalam antrean",
  RUNNING: "Berjalan",
  COMPLETED: "Selesai",
  COMPLETED_WITH_ERRORS: "Selesai · perlu perhatian",
  BUDGET_HOLD: "Anggaran tertahan",
  MISSED: "Jadwal terlewat",
  DELIVERED: "Terkirim ke penerima",
  SENT: "Dikirim penyedia",
  ACCEPTED: "Diterima penyedia",
  FAILED: "Gagal",
  UNKNOWN: "Belum terkonfirmasi",
  CANCELLED: "Dibatalkan",
  PLANNED: "Direncanakan",
  RESCHEDULED: "Dijadwalkan ulang",
  PAUSED: "Dijeda",
  RECOVERY_HOLD: "Menunggu keputusan pemulihan",
  VALIDATION_HOLD: "Perlu pemeriksaan konfigurasi",
};
let sessionGeneration = 0;
async function api(path: string, method = "GET", body?: unknown) {
  const generation = sessionGeneration;
  const response = await fetch(`/api/${path}`, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers:
      method === "GET"
        ? {}
        : {
            "Content-Type": "application/json",
            "X-Requested-With": "MessagingApp",
          },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response
    .json()
    .catch(() => ({ message: tr("Layanan belum siap. Silakan coba lagi.") }));
  if (generation !== sessionGeneration)
    throw Object.assign(
      new Error(tr("Sesi berubah. Muat ulang data ruang kerja.")),
      { status: 401 },
    );
  if (!response.ok)
    throw Object.assign(new Error(tr(value.message ?? "Permintaan gagal.")), {
      status: response.status,
    });
  return value;
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      {tr(labels[status] ?? status)}
    </span>
  );
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const labelId = useId();
  return (
    <div className="field">
      <label htmlFor={`${labelId}-control`} id={labelId}>
        {label}
      </label>
      {isValidElement(children)
        ? cloneElement(
            children as ReactElement<{
              "aria-labelledby"?: string;
              id?: string;
            }>,
            { "aria-labelledby": labelId, id: `${labelId}-control` },
          )
        : children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <MessageSquare size={28} />
      <p>{children}</p>
    </div>
  );
}
function Modal({
  title,
  children,
  close,
  wide = false,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  drawer?: boolean;
}) {
  const dialogError = useContext(DialogErrorContext);
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = [
      ...document.querySelectorAll<HTMLElement>(".main-shell,.sidebar"),
    ];
    background.forEach((element) => element.setAttribute("inert", ""));
    dialog.current
      ?.querySelector<HTMLElement>(
        'button,input,select,textarea,a[href],summary,[tabindex="0"]',
      )
      ?.focus();
    return () => {
      background.forEach((element) => element.removeAttribute("inert"));
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className={`overlay ${drawer ? "drawer-overlay" : ""}`}
      onClick={close}
    >
      <section
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) {
            event.preventDefault();
            close();
          }
          if (event.key === "Tab") {
            const items = [
              ...dialog.current!.querySelectorAll<HTMLElement>(
                'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]',
              ),
            ].filter((element) => element.getClientRects().length > 0);
            const first = items[0],
              last = items.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""} ${drawer ? "message-drawer" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-btn" onClick={close} aria-label={tr("Tutup")}>
            <X size={20} />
          </button>
        </header>
        {dialogError.message && (
          <div className="alert error" role="alert">
            {dialogError.message}
            <button
              type="button"
              className="icon-btn"
              onClick={dialogError.clear}
              aria-label={tr("Tutup pesan")}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {children}
      </section>
    </div>
  );
}
export default function Home() {
  const { locale, setLocale } = useLanguage();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const page = pageForPath(pathname);
  const setPage = useCallback(
    (key: string) => router.push(pathForPage(key)),
    [router],
  );
  const shell = useShellPreferences();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [messagePage, setMessagePage] = useState(0);
  useEffect(() => setMessagePage(0), [selected?.id]);
  const [auditRows, setAuditRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("creator@demo.local");
  const [password, setPassword] = useState("LocalDemo123!");
  const navigate = useCallback(
    (key: string, query = "") => {
      setModal("");
      setSearch("");
      router.push(pathForPage(key) + (query ? "?" + query : ""));
    },
    [router],
  );
  const openMessage = (id: string) => {
    setSelected({ id });
    setModal("message-investigation");
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal("command");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const currentUser = useRef<string | null>(null);
  const updateSession = useCallback((next: Bootstrap | null) => {
    const id = next?.user.id ?? null;
    if (currentUser.current !== id) {
      currentUser.current = id;
      sessionGeneration++;
      setModal("");
      setSelected(null);
      setDetail(null);
      setAuditRows([]);
      setSearch("");
      setError("");
      setNotice("");
      setBusy(false);
      setPassword("");
    }
    setData(next);
  }, []);
  const refresh = useCallback(async () => {
    const generation = sessionGeneration;
    try {
      updateSession(await api("bootstrap"));
    } catch (e) {
      if (
        generation === sessionGeneration &&
        (!loaded ||
          (
            e as Error & {
              status?: number;
            }
          ).status === 401)
      )
        updateSession(null);
    } finally {
      setLoaded(true);
    }
  }, [loaded, updateSession]);
  useEffect(() => {
    void refresh();
  }, []); // Initial session recovery; polling below starts after login.
  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [!!data, refresh]);
  useEffect(() => {
    if (page === "audit" && data)
      api(`audit?search=${encodeURIComponent(search)}`)
        .then(setAuditRows)
        .catch((e) => setError(e.message));
  }, [page, search, !!data]);
  useEffect(() => {
    if (!selected || modal !== "detail") return;
    const load = () =>
      api(`campaigns/${selected.id}?page=${messagePage}`)
        .then((next) =>
          setDetail((previous) => {
            if (!previous || previous.campaign.id !== next.campaign.id)
              return next;
            const old = previous.campaign,
              current = next.campaign;
            if (
              current.version < old.version ||
              (current.version === old.version &&
                current.approval_stage < old.approval_stage)
            )
              return previous;
            if (
              current.version !== old.version ||
              current.approval_stage !== old.approval_stage
            )
              return { ...previous, staleReview: true };
            return next;
          }),
        )
        .catch((e) => setError(e.message));
    void load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [selected?.id, modal, messagePage]);
  const perform = async (
    fn: () => Promise<unknown>,
    message = tr("Perubahan tersimpan."),
  ) => {
    const operationUser = currentUser.current;
    setBusy(true);
    setError("");
    try {
      await fn();
      if (operationUser !== currentUser.current) return;
      await refresh();
      if (operationUser !== currentUser.current) return;
      setNotice(message);
      setTimeout(() => {
        if (operationUser === currentUser.current) setNotice("");
      }, 5000);
    } catch (e) {
      if (operationUser === currentUser.current) setError((e as Error).message);
    } finally {
      if (operationUser === currentUser.current) setBusy(false);
    }
  };
  useEffect(() => {
    const saved = data?.user.profile?.locale;
    if (saved === "id" || saved === "en") setLocale(saved);
  }, [data?.user.id, data?.user.profile?.locale]);
  useEffect(() => {
    if (!data?.user.id) return;
    const id = new URLSearchParams(window.location.search).get("campaign");
    if (id && /^[0-9a-f-]{36}$/i.test(id)) {
      setSelected({ id });
      setDetail(null);
      setModal("detail");
    }
  }, [data?.user.id]);
  const can = (permission: string) =>
    data?.user.permissions.includes(permission);
  if (!loaded)
    return (
      <main className="loading">
        <Radio className="brand-icon" size={35} />
        {tr("Menyiapkan ruang kerja\u2026")}
      </main>
    );
  if (!data)
    return (
      <main className="login">
        <div className="login-story">
          <UMSBrand />
          <div>
            <span className="eyebrow">{tr("PESAN YANG TERORGANISASI")}</span>
            <h1>
              {tr("Satu ruang.")}
              <br />
              {tr("Setiap pesan.")}
              <br />
              <em>{tr("Lebih terkendali.")}</em>
            </h1>
            <p>
              {tr(
                "Kelola kampanye, persetujuan, dan anggaran tim dengan langkah yang jelas.",
              )}
            </p>
          </div>
          <small>{tr("Platform komunikasi · Alur kerja tim")}</small>
        </div>
        <div className="login-form">
          <div className="login-card">
            <div className="login-language">
              <Select
                aria-label={tr("Bahasa")}
                value={locale}
                onChange={(e) => setLocale(e.target.value as "id" | "en")}
              >
                <option value="id">Indonesia</option>
                <option value="en">English</option>
              </Select>
            </div>
            <span className="eyebrow">{tr("SELAMAT DATANG KEMBALI")}</span>
            <h2>{tr("Masuk ke ruang kerja")}</h2>
            <p>{tr("Pilih akun demo untuk mencoba alur tim.")}</p>
            {error && (
              <div role="alert" className="alert error">
                {tr(error)}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform(async () => {
                  await api("auth/login", "POST", { email, password });
                  updateSession(await api("bootstrap"));
                }, tr("Berhasil masuk."));
              }}
            >
              <Field label={tr("Email")}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </Field>
              <Field label={tr("Kata sandi")}>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              <button className="primary full" disabled={busy}>
                {busy ? tr("Memproses\u2026") : tr("Masuk")}
                <ArrowUpRight size={18} />
              </button>
            </form>
            <div className="demo-accounts">
              <span>{tr("Coba sebagai")}</span>
              {["creator", "approver", "finance", "admin"].map((role) => (
                <button
                  type="button"
                  key={role}
                  className={email.startsWith(role) ? "active" : ""}
                  onClick={() => setEmail(`${role}@demo.local`)}
                >
                  {role}
                </button>
              ))}
            </div>
            <div className="simulation">
              <ShieldCheck size={20} />
              <span>
                <b>{tr("Mode simulasi aman")}</b>
                {tr("Penyedia uji tidak membebankan biaya vendor.")}
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  const pending = data.campaigns.filter((c) => c.status === "PENDING_APPROVAL");
  const total = data.stats.reduce((n, s) => n + s.count, 0);
  const delivered = data.stats
    .filter((s) => s.status === "DELIVERED")
    .reduce((n, s) => n + s.count, 0);
  const failed = data.stats
    .filter((s) => ["FAILED", "UNKNOWN"].includes(s.status))
    .reduce((n, s) => n + s.count, 0);
  const nav = navigation.map((n) => [n.key, n.label, n.icon] as const);
  const visible = (key: string) =>
    key === "campaigns"
      ? can("campaigns:read")
      : key === "approvals"
        ? can("campaigns:approve")
        : key === "budgets"
          ? can("budgets:read")
          : key === "audit"
            ? can("audit:read")
            : key === "templates"
              ? can("templates:write")
              : key === "sources"
                ? can("sources:write")
                : true;
  const campaignTable = (items: Row[]) =>
    items.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("Kampanye")}</th>
              <th>{tr("Status")}</th>
              <th>{tr("Pembuat")}</th>
              <th>{tr("Dibuat")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr
                key={c.id}
                onClick={() => {
                  setSelected(c);
                  setDetail(null);
                  setModal("detail");
                }}
              >
                <td>
                  <button className="campaign-name" type="button">
                    {c.name}
                  </button>
                  <small className="mono">
                    {c.id.slice(0, 8)}
                    {tr(" \u00B7 v")}
                    {c.version}
                  </small>
                </td>
                <td>
                  <Badge status={c.status} />
                </td>
                <td>{c.creator_name}</td>
                <td>{date(c.created_at)}</td>
                <td>
                  <ChevronRight size={17} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty>
        {tr(
          "Belum ada kampanye. Mulai dari sumber data dan template yang sudah tersedia.",
        )}
      </Empty>
    );
  const widgets = (data.user.profile?.dashboard?.widgets ?? [
    "campaigns",
    "delivery",
    "budget",
    "activity",
  ]) as string[];
  return (
    <DialogErrorContext.Provider
      value={{ message: error, clear: () => setError("") }}
    >
      <div
        className={`app-shell ums-shell ${shell.collapsed ? "sidebar-collapsed" : ""}`}
      >
        <AppSidebar
          user={data.user}
          page={page}
          pending={pending.length}
          collapsed={shell.collapsed}
          toggle={shell.toggle}
          navigate={navigate}
          profile={() => setModal("profile")}
        />
        <div className="main-shell">
          <AppHeader
            page={page}
            user={data.user}
            theme={shell.theme}
            changeTheme={shell.changeTheme}
            changeLanguage={(next) =>
              void perform(
                async () => {
                  await api("profile/language", "PUT", { locale: next });
                  setLocale(next);
                },
                next === "en" ? "Language updated." : "Bahasa diperbarui.",
              )
            }
            environment={data.config?.environment}
            help={() => navigate("help")}
            search={() => setModal("command")}
            notifications={() => setModal("notifications")}
            unread={data.notifications.some(
              (n) => !n.read_by.includes(data.user.id),
            )}
            logout={() =>
              void perform(async () => {
                await api("auth/logout", "POST", {});
                updateSession(null);
              })
            }
          />
          <main className="content">
            {notice && (
              <div role="status" className="toast">
                <Check size={18} />
                {tr(notice)}
              </div>
            )}
            {error && (
              <div role="alert" className="alert error">
                {tr(error)}
                <button
                  className="icon-btn"
                  onClick={() => setError("")}
                  aria-label={tr("Tutup pesan")}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  {page === "dashboard"
                    ? tr("RUANG KERJA ANDA")
                    : tr("KELOLA DENGAN JELAS")}
                </span>
                <h1>
                  {page === "dashboard"
                    ? tr("Overview")
                    : tr(nav.find((n) => n[0] === page)?.[1] ?? "")}
                </h1>
                <p>
                  {page === "dashboard"
                    ? tr(
                        "Aktivitas pesan, performa delivery, dan kendali operasional dalam satu workspace.",
                      )
                    : page === "approvals"
                      ? tr(
                          "Tinjau isi, penerima, dan biaya sebelum memberikan keputusan.",
                        )
                      : tr(
                          "Data dan tindakan mengikuti akses perusahaan serta tim Anda.",
                        )}
                </p>
              </div>
              {can("campaigns:create") &&
                ["dashboard", "campaigns"].includes(page) && (
                  <button
                    className="primary"
                    onClick={() => setModal("campaign")}
                  >
                    <Plus size={18} />
                    {tr("Buat kampanye")}
                  </button>
                )}
            </div>
            {page === "dashboard" && (
              <>
                <div className="section-heading">
                  <h2>{tr("Ruang pantau")}</h2>
                  <button
                    className="subtle"
                    onClick={() => setModal("dashboard")}
                  >
                    <SlidersHorizontal size={16} />
                    {tr("Atur tampilan")}
                  </button>
                </div>
                <div className="dashboard-filters">
                  <span>{tr("Filter pesan")}</span>
                  <Select
                    aria-label={tr("Filter kanal dashboard")}
                    value={data.user.profile.dashboard.filters.channel}
                    onChange={(e) =>
                      void perform(
                        () =>
                          api("dashboard", "PUT", {
                            ...data.user.profile.dashboard,
                            filters: {
                              ...data.user.profile.dashboard.filters,
                              channel: e.target.value,
                            },
                          }),
                        tr("Filter tersimpan."),
                      )
                    }
                  >
                    <option value="all">{tr("Semua kanal")}</option>
                    <option value="email">{tr("Email")}</option>
                    <option value="sms">{tr("SMS")}</option>
                    <option value="whatsapp">{tr("WhatsApp")}</option>
                  </Select>
                  <Select
                    aria-label={tr("Filter periode dashboard")}
                    value={data.user.profile.dashboard.filters.days}
                    onChange={(e) =>
                      void perform(
                        () =>
                          api("dashboard", "PUT", {
                            ...data.user.profile.dashboard,
                            filters: {
                              ...data.user.profile.dashboard.filters,
                              days: e.target.value,
                            },
                          }),
                        tr("Filter tersimpan."),
                      )
                    }
                  >
                    <option value="all">{tr("Semua waktu")}</option>
                    <option value="1">{tr("24 jam")}</option>
                    <option value="7">{tr("7 hari")}</option>
                    <option value="30">{tr("30 hari")}</option>
                    <option value="90">{tr("90 hari")}</option>
                  </Select>
                </div>
                {can("campaigns:read") && (
                  <OperationsDashboard
                    request={api}
                    days={data.user.profile.dashboard.filters.days}
                    channel={data.user.profile.dashboard.filters.channel}
                    canCosts={!!can("budgets:read")}
                    navigate={navigate}
                    open={openMessage}
                  />
                )}
                <div className="section-heading personal-dashboard-heading">
                  <h2>{tr("Workspace Anda")}</h2>
                  <span className="hint">
                    {tr("Widget mengikuti pengaturan pribadi")}
                  </span>
                </div>
                <div className="dashboard-grid">
                  {widgets.map((widget) => (
                    <section
                      className={`panel widget-${widget}`}
                      key={widget}
                      style={{
                        gridColumn:
                          (data.user.profile.dashboard.sizes[widget] ??
                            (["campaigns", "activity"].includes(widget)
                              ? "full"
                              : "half")) === "full"
                            ? "1 / -1"
                            : "auto",
                      }}
                    >
                      <div className="panel-heading">
                        <h3>
                          {
                            {
                              campaigns: tr("Kampanye terbaru"),
                              delivery: tr("Hasil pengiriman"),
                              budget: tr("Ringkasan anggaran"),
                              activity: tr("Aktivitas tim"),
                            }[widget]
                          }
                        </h3>
                        <button
                          className="text-btn"
                          onClick={() =>
                            setPage(
                              widget === "campaigns"
                                ? "campaigns"
                                : widget === "budget"
                                  ? "budgets"
                                  : widget === "activity"
                                    ? "approvals"
                                    : "campaigns",
                            )
                          }
                        >
                          {tr("Lihat semua ")}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                      {widget === "campaigns" ? (
                        campaignTable(data.campaigns.slice(0, 5))
                      ) : widget === "delivery" ? (
                        <div className="delivery-widget">
                          <div
                            className="donut"
                            style={{
                              background: `conic-gradient(var(--teal) ${total ? (delivered / total) * 100 : 0}%, #edf0f3 0)`,
                            }}
                          >
                            <div>
                              <strong>
                                {total
                                  ? ((delivered / total) * 100).toFixed(1)
                                  : 0}
                                %
                              </strong>
                              <small>{tr("Tersampaikan")}</small>
                            </div>
                          </div>
                          <div className="legend">
                            <span>
                              <i />
                              {tr("Tersampaikan ")}
                              <b>{delivered}</b>
                            </span>
                            <span>
                              <i className="amber" />
                              {tr("Perlu perhatian ")}
                              <b>{failed}</b>
                            </span>
                            <span>
                              <i className="grey" />
                              {tr("Pesan lainnya ")}
                              <b>{total - delivered - failed}</b>
                            </span>
                          </div>
                        </div>
                      ) : widget === "budget" ? (
                        can("budgets:read") ? (
                          <div className="budget-list">
                            {data.budgets.slice(0, 3).map((b) => (
                              <div key={b.id}>
                                <div>
                                  <b>{b.name}</b>
                                  <span>
                                    {money(b.available)}
                                    {tr(" tersedia")}
                                  </span>
                                </div>
                                <div className="progress">
                                  <i
                                    style={{
                                      width: `${Math.min(100, ((Number(b.spent) + Number(b.reserved)) / (Number(b.allocated) + Number(b.adjusted))) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <small>
                                  {tr("Terpakai ")}
                                  {money(b.spent)}
                                  {tr(" \u00B7 Dicadangkan")}{" "}
                                  {money(b.reserved)}
                                  {tr(" \u00B7 Simulasi")}
                                </small>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Empty>
                            {tr(
                              "Akses anggaran tidak tersedia untuk peran Anda.",
                            )}
                          </Empty>
                        )
                      ) : (
                        <div className="activity-list">
                          {data.notifications.slice(0, 4).map((n) => (
                            <div key={n.id}>
                              <span className="activity-icon">
                                <Bell size={15} />
                              </span>
                              <div>
                                <b>{tr(n.title)}</b>
                                <p>{tr(n.body)}</p>
                                <small>{date(n.created_at)}</small>
                              </div>
                            </div>
                          ))}
                          {!data.notifications.length && (
                            <Empty>
                              {tr(
                                "Aktivitas kampanye tim akan tampil di sini.",
                              )}
                            </Empty>
                          )}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )}
            {["messages", "deliveries"].includes(page) &&
              (can("campaigns:read") ? (
                <MessageExplorer
                  key={page}
                  request={api}
                  open={openMessage}
                  canCosts={!!can("budgets:read")}
                  mode={page}
                />
              ) : (
                <Empty>
                  {tr("Akses pesan tidak tersedia untuk peran Anda.")}
                </Empty>
              ))}
            {page === "channels" &&
              (can("campaigns:read") ? (
                <ChannelMonitoring request={api} navigate={navigate} />
              ) : (
                <Empty>{tr("Akses pemantauan tidak tersedia.")}</Empty>
              ))}
            {page === "usage" &&
              (can("budgets:read") ? (
                <VendorUsage request={api} navigate={navigate} />
              ) : (
                <Empty>{tr("Akses keuangan tidak tersedia.")}</Empty>
              ))}
            {page === "reconciliation" &&
              (can("budgets:read") ? (
                <ReconciliationWorkspace request={api} open={openMessage} />
              ) : (
                <Empty>{tr("Akses rekonsiliasi tidak tersedia.")}</Empty>
              ))}
            {page === "help" && (
              <HelpCenter user={data.user} navigate={navigate} />
            )}
            {page === "push" && (
              <PushSettings request={api} profile={data.user.profile} />
            )}
            {page === "companies" &&
              (data.user.platform_admin ? (
                <CompanyPanel request={api} />
              ) : (
                <Empty>
                  {tr("Hanya admin platform yang dapat mengelola perusahaan.")}
                </Empty>
              ))}
            {page === "providers" &&
              (can("admin:write") ? (
                <ProviderPanel request={api} perform={perform} />
              ) : (
                <Empty>{tr("Akses administrasi tidak tersedia.")}</Empty>
              ))}
            {["campaigns", "approvals"].includes(page) && (
              <section className="panel">
                <div className="panel-heading">
                  <h3>
                    {page === "approvals"
                      ? tr("Permintaan persetujuan")
                      : tr("Semua kampanye")}{" "}
                    <span className="count">
                      {page === "approvals"
                        ? pending.length
                        : data.campaigns.length}
                    </span>
                  </h3>
                  <div className="search">
                    <Search size={16} />
                    <input
                      aria-label={tr("Cari kampanye")}
                      placeholder={tr("Cari kampanye\u2026")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                {campaignTable(
                  (page === "approvals" ? pending : data.campaigns).filter(
                    (c) => c.name.toLowerCase().includes(search.toLowerCase()),
                  ),
                )}
              </section>
            )}
            {page === "templates" && (
              <>
                <div className="section-heading">
                  <p>{tr("Versi yang sudah diajukan tetap tersimpan.")}</p>
                  <button
                    className="primary"
                    onClick={() => {
                      setSelected(null);
                      setModal("template");
                    }}
                  >
                    <Plus size={17} />
                    {tr("Template baru")}
                  </button>
                </div>
                <div className="cards-grid">
                  {data.templates.map((t) => (
                    <article className="panel template-card" key={t.id}>
                      <div>
                        <span className="channel-icon">
                          {t.channel === "email" ? <Mail /> : <MessageSquare />}
                        </span>
                        <Badge status={t.channel} />
                      </div>
                      <h3>{t.name}</h3>
                      <p>{t.body}</p>
                      <footer>
                        <small>
                          {tr("Versi ")}
                          {t.version} · {date(t.created_at)}
                        </small>
                        <button
                          className="text-btn"
                          onClick={() => {
                            setSelected(t);
                            setModal("template");
                          }}
                        >
                          {tr("Buat versi baru")}
                        </button>
                      </footer>
                    </article>
                  ))}
                </div>
              </>
            )}
            {page === "sources" && (
              <SourcePanel request={api} perform={perform} />
            )}
            {page === "sources" && (
              <section className="panel">
                <div className="panel-heading">
                  <h3>{tr("Sumber penerima")}</h3>
                  <button
                    className="primary"
                    onClick={() => setModal("source")}
                  >
                    <Upload size={17} />
                    {tr("Unggah data")}
                  </button>
                </div>
                <div className="info-strip">
                  <Database size={18} />
                  {tr(
                    "CSV, XLSX, dan JSON tersedia. Gunakan kolom email / phone untuk tujuan pesan.",
                  )}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr("Sumber")}</th>
                        <th>{tr("Baris")}</th>
                        <th>{tr("Versi")}</th>
                        <th>{tr("Dibuat")}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.datasets.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <b>{d.name}</b>
                          </td>
                          <td>{d.row_count}</td>
                          <td>
                            {tr("v")}
                            {d.version}
                          </td>
                          <td>{date(d.created_at)}</td>
                          <td>
                            <button
                              className="text-btn"
                              onClick={() =>
                                void perform(async () => {
                                  setSelected(await api(`datasets/${d.id}`));
                                  setModal("preview");
                                }, tr("Pratinjau siap."))
                              }
                            >
                              {tr("Pratinjau")}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {page === "budgets" && can("budgets:write") && (
              <div className="section-heading">
                <p>{tr("Periode terpisah, tanpa tumpang tindih.")}</p>
                <button className="primary" onClick={() => setModal("budget")}>
                  <Plus size={17} />
                  {tr("Periode anggaran baru")}
                </button>
              </div>
            )}
            {page === "budgets" && (
              <div className="cards-grid">
                {data.budgets.map((b) => (
                  <article className="panel budget-card" key={b.id}>
                    <div className="section-heading">
                      <Wallet size={22} />
                      <span className="pill">{tr("SIMULASI \u00B7 IDR")}</span>
                    </div>
                    <h3>{b.name}</h3>
                    <small>
                      {String(b.starts_on).slice(0, 10)} —{" "}
                      {String(b.ends_on).slice(0, 10)}
                      {tr(" (eksklusif) \u00B7 ")}
                      {b.months} {tr("bulan")}
                    </small>
                    <strong>{money(b.available)}</strong>
                    <span>{tr("Anggaran tersedia")}</span>
                    <dl>
                      <div>
                        <dt>{tr("Alokasi + penyesuaian")}</dt>
                        <dd>
                          {money(Number(b.allocated) + Number(b.adjusted))}
                        </dd>
                      </div>
                      <div>
                        <dt>{tr("Dicadangkan")}</dt>
                        <dd>{money(b.reserved)}</dd>
                      </div>
                      <div>
                        <dt>{tr("Biaya terkonfirmasi")}</dt>
                        <dd>{money(b.spent)}</dd>
                      </div>
                    </dl>
                    <button
                      className="secondary full"
                      onClick={() =>
                        void perform(async () => {
                          setSelected({
                            budget: b,
                            ...(await api(`budgets/${b.id}/ledger`)),
                          });
                          setModal("ledger");
                        }, tr("Riwayat biaya dimuat."))
                      }
                    >
                      {tr("Riwayat alokasi dan biaya")}
                    </button>
                    {can("budgets:write") && (
                      <button
                        className="secondary full"
                        onClick={() => {
                          setSelected(b);
                          setModal("topup");
                        }}
                      >
                        <Plus size={16} />
                        {tr("Tambah alokasi")}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
            {page === "audit" && (
              <section className="panel">
                <div className="panel-heading">
                  <h3>{tr("Aktivitas tercatat")}</h3>
                  <div className="search">
                    <Search size={16} />
                    <input
                      placeholder={tr("Cari aksi atau ID\u2026")}
                      aria-label={tr("Cari audit")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr("Waktu")}</th>
                        <th>{tr("Pengguna")}</th>
                        <th>{tr("Aksi")}</th>
                        <th>{tr("Objek / ID")}</th>
                        <th>{tr("Alamat IP")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((a) => (
                        <tr key={a.id}>
                          <td>{date(a.created_at)}</td>
                          <td>{a.actor_name}</td>
                          <td>
                            <code>{a.action}</code>
                          </td>
                          <td>
                            {a.resource_type}
                            <small className="mono">{a.resource_id}</small>
                          </td>
                          <td>{a.ip}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {page === "settings" && (
              <div className="settings-grid">
                {can("admin:write") && (
                  <AdminPanel request={api} perform={perform} />
                )}
                <section className="panel settings-panel">
                  <Users size={24} />
                  <h2>{tr("Profil Anda")}</h2>
                  <p>
                    {data.user.name} · {data.user.email}
                  </p>
                  <button
                    className="secondary"
                    onClick={() => setModal("profile")}
                  >
                    {tr("Ubah profil")}
                  </button>
                </section>
                <section className="panel settings-panel">
                  <ShieldCheck size={24} />
                  <h2>{tr("Alur persetujuan")}</h2>
                  <p>
                    {data.policy?.stages?.length ?? 0}
                    {tr(" tingkat \u00B7 Versi")} {data.policy?.version}
                  </p>
                  <ol className="policy-list">
                    {data.policy?.stages?.map((s: Row, i: number) => (
                      <li key={i}>
                        {s.name}
                        <small>
                          {data.roles
                            .filter((r) => s.roleIds.includes(r.id))
                            .map((r) => r.name)
                            .join(", ")}
                        </small>
                      </li>
                    ))}
                  </ol>
                  {can("admin:write") && (
                    <button
                      className="secondary"
                      onClick={() => setModal("policy")}
                    >
                      {tr("Atur tingkat persetujuan")}
                    </button>
                  )}
                </section>
                <section className="panel settings-panel">
                  <MessageSquare size={24} />
                  <h2>{tr("Penyedia uji")}</h2>
                  <p>
                    {tr(
                      "Satu simulator untuk email, SMS, dan WhatsApp. Hasil diberi label simulasi.",
                    )}
                  </p>
                  <small>
                    {tr(
                      "Integrasi vendor nyata menunggu dokumentasi API dan akses pengujian.",
                    )}
                  </small>
                </section>
              </div>
            )}
            <footer className="page-footer">
              <span>{tr("UMS workspace \u00B7 Asia/Jakarta (WIB)")}</span>
              <span>
                <ShieldCheck size={14} />
                {tr("Akses mengikuti peran Anda")}
              </span>
            </footer>
          </main>
        </div>
        {modal === "command" && (
          <Modal title={tr("Pencarian global")} close={() => setModal("")}>
            <CommandSearch user={data.user} navigate={navigate} />
          </Modal>
        )}
        {modal === "message-investigation" && selected && (
          <Modal title={tr("Detail pesan")} drawer close={() => setModal("")}>
            <MessageInvestigation
              key={selected.id}
              request={api}
              id={selected.id}
              canResolve={!!can("budgets:write")}
              onChanged={() => void refresh()}
            />
          </Modal>
        )}
        {["campaign", "revision"].includes(modal) && (
          <CampaignForm
            data={data}
            initialCampaign={modal === "revision" ? selected : undefined}
            busy={busy}
            close={() => setModal("")}
            save={(input) =>
              perform(async () => {
                const c =
                  modal === "revision"
                    ? await api(`campaigns/${selected!.id}`, "PUT", input)
                    : await api("campaigns", "POST", input);
                await api(`campaigns/${c.id}/submit`, "POST", {});
                setModal("");
                setPage("campaigns");
              }, tr("Kampanye diajukan untuk persetujuan."))
            }
          />
        )}
        {modal === "template" && (
          <Modal
            title={selected ? tr("Buat versi template") : tr("Template baru")}
            close={() => setModal("")}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void perform(async () => {
                  await api("templates", "POST", {
                    name: f.get("name"),
                    channel: f.get("channel"),
                    body: f.get("body"),
                    ...(selected ? { parentId: selected.id } : {}),
                  });
                  setModal("");
                }, tr("Versi template tersimpan."));
              }}
            >
              <Field label={tr("Nama template")}>
                <input
                  name="name"
                  required
                  minLength={3}
                  defaultValue={selected?.name}
                />
              </Field>
              <Field label={tr("Kanal")}>
                <Select
                  name="channel"
                  defaultValue={selected?.channel ?? "email"}
                >
                  {["email", "sms", "whatsapp"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field
                label={tr("Isi pesan")}
                hint={tr(
                  "Gunakan {{customer_name}} atau {{reference}} dari kolom data.",
                )}
              >
                <textarea
                  name="body"
                  rows={6}
                  required
                  defaultValue={
                    selected?.body ??
                    "Halo {{customer_name}}, referensi Anda {{reference}}."
                  }
                />
              </Field>
              <p className="hint">
                {tr(
                  "Template WhatsApp uji belum merupakan template yang disetujui penyedia.",
                )}
              </p>
              <button className="primary full" disabled={busy}>
                {tr("Simpan template")}
              </button>
            </form>
          </Modal>
        )}
        {modal === "source" && (
          <Modal title={tr("Unggah sumber data")} close={() => setModal("")}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const file = f.get("file") as File;
                void perform(async () => {
                  const format = file.name.toLowerCase().endsWith(".xlsx")
                    ? "xlsx"
                    : file.name.toLowerCase().endsWith(".json")
                      ? "json"
                      : "csv";
                  let content = await file.text();
                  if (format === "xlsx") {
                    const bytes = new Uint8Array(await file.arrayBuffer());
                    let binary = "";
                    for (let i = 0; i < bytes.length; i++)
                      binary += String.fromCharCode(bytes[i]);
                    content = btoa(binary);
                  }
                  await api("datasets", "POST", {
                    name: f.get("name"),
                    format,
                    content,
                  });
                  setModal("");
                }, tr("Sumber data berhasil diimpor."));
              }}
            >
              <Field label={tr("Nama sumber")}>
                <input name="name" required minLength={3} />
              </Field>
              <Field label={tr("File CSV, XLSX, atau JSON")}>
                <input
                  name="file"
                  type="file"
                  required
                  accept=".csv,.xlsx,.json"
                />
              </Field>
              <div className="info-strip">
                {tr(
                  "Contoh kolom: customer_name, reference, email, phone. File harus berisi nilai, bukan formula.",
                )}
              </div>
              <button className="primary full" disabled={busy}>
                {tr("Impor data")}
              </button>
            </form>
          </Modal>
        )}
        {modal === "preview" && selected && (
          <Modal title={tr("Pratinjau sumber")} close={() => setModal("")} wide>
            <p>
              {selected.name}
              {tr(" \u00B7 Maksimal 20 baris ditampilkan.")}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {Object.keys(selected.rows[0] ?? {}).map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.rows.map((r: Row, i: number) => (
                    <tr key={i}>
                      {Object.values(r).map((v, j) => (
                        <td key={j}>{String(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Modal>
        )}
        {modal === "topup" && selected && (
          <Modal
            title={tr("Tambah alokasi internal")}
            close={() => setModal("")}
          >
            <p>
              {selected.name}
              {tr(" \u00B7 Simulasi, tanpa transaksi pembayaran.")}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void perform(async () => {
                  await api(`budgets/${selected.id}/topup`, "POST", {
                    amount: f.get("amount"),
                    reason: f.get("reason"),
                  });
                  setModal("");
                });
              }}
            >
              <Field label={tr("Nominal (IDR)")}>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="0.0001"
                  required
                />
              </Field>
              <Field label={tr("Alasan penyesuaian")}>
                <textarea name="reason" minLength={3} required />
              </Field>
              <button className="primary full" disabled={busy}>
                {tr("Simpan penyesuaian")}
              </button>
            </form>
          </Modal>
        )}
        {modal === "budget" && (
          <Modal title={tr("Periode anggaran baru")} close={() => setModal("")}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void perform(async () => {
                  await api("budgets", "POST", {
                    costCentreId: f.get("centre"),
                    startsOn: f.get("start"),
                    months: Number(f.get("months")),
                    amount: f.get("amount"),
                  });
                  setModal("");
                }, tr("Periode anggaran tersimpan."));
              }}
            >
              <Field label={tr("Pusat biaya")}>
                <Select name="centre" required>
                  {data.costCentres.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="form-grid">
                <Field label={tr("Mulai periode")}>
                  <input name="start" type="date" required />
                </Field>
                <Field label={tr("Durasi")}>
                  <Select name="months">
                    {[1, 3, 6, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}
                        {tr(" bulan")}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label={tr("Alokasi awal (IDR)")}>
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.0001"
                  required
                />
              </Field>
              <button className="primary full" disabled={busy}>
                {tr("Buat periode")}
              </button>
            </form>
          </Modal>
        )}
        {modal === "ledger" && selected && (
          <Modal
            title={tr("Riwayat alokasi dan biaya")}
            close={() => setModal("")}
            wide
          >
            <div className="section-heading">
              <p>
                {selected.budget.name} · {selected.total}
                {tr(" entri \u00B7 Simulasi")}
              </p>
              <a
                className="text-btn"
                href={`/api/budgets/${selected.budget.id}/ledger.csv`}
                download
              >
                {tr("Unduh CSV")}
              </a>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tr("Waktu")}</th>
                    <th>{tr("Jenis")}</th>
                    <th>{tr("IDR")}</th>
                    <th>{tr("Run / pesan")}</th>
                    <th>{tr("Oleh / alasan")}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.rows.map((r: Row) => (
                    <tr key={r.id}>
                      <td>{date(r.created_at)}</td>
                      <td>{ledgerLabels[r.kind] ?? r.kind}</td>
                      <td>{money(r.amount)}</td>
                      <td className="mono">
                        {r.run_id?.slice(0, 8) ?? "—"}
                        <small>
                          {r.message_id?.slice(0, 8) ?? ""} {r.channel ?? ""}
                        </small>
                      </td>
                      <td>
                        {r.actor_name ?? tr("Sistem")}
                        <small>{r.reason ?? ""}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="modal-actions">
              {[-1, 1].map((direction) => (
                <button
                  key={direction}
                  className="secondary"
                  disabled={
                    busy ||
                    (direction === -1
                      ? selected.page === 0
                      : (selected.page + 1) * 200 >= selected.total)
                  }
                  onClick={() =>
                    void perform(async () => {
                      setSelected({
                        ...selected,
                        ...(await api(
                          `budgets/${selected.budget.id}/ledger?page=${selected.page + direction}`,
                        )),
                      });
                    }, tr("Halaman diperbarui."))
                  }
                >
                  {direction === -1 ? tr("Sebelumnya") : tr("Berikutnya")}
                </button>
              ))}
            </div>
          </Modal>
        )}
        {modal === "profile" && (
          <Modal title={tr("Profil Anda")} close={() => setModal("")}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void perform(async () => {
                  await api("profile", "PUT", {
                    name: f.get("name"),
                    bio: f.get("bio"),
                  });
                  const picture = f.get("picture") as File;
                  if (picture?.size) {
                    if (picture.size > 2000000)
                      throw new Error(tr("Ukuran foto maksimal 2 MB."));
                    const bytes = new Uint8Array(await picture.arrayBuffer());
                    let binary = "";
                    for (const byte of bytes)
                      binary += String.fromCharCode(byte);
                    await api("profile/picture", "PUT", {
                      base64: btoa(binary),
                    });
                  }
                  setModal("");
                });
              }}
            >
              <Field label={tr("Nama")}>
                <input
                  name="name"
                  required
                  minLength={2}
                  defaultValue={data.user.name}
                />
              </Field>
              <Field label={tr("Tentang Anda")}>
                <textarea
                  name="bio"
                  defaultValue={data.user.profile.bio ?? ""}
                />
              </Field>
              <Field
                label={tr("Foto profil")}
                hint={tr(
                  "PNG, JPEG, atau WebP. Maksimal 2 MB dan 8 megapiksel.",
                )}
              >
                <input
                  name="picture"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                />
              </Field>
              <p className="hint">
                {data.user.email} · {data.user.role}
              </p>
              <button className="primary full" disabled={busy}>
                {tr("Simpan profil")}
              </button>
            </form>
            <details className="password-settings">
              <summary>{tr("Ubah kata sandi")}</summary>
              <p className="hint">
                {tr("Sesi Anda yang lain akan dikeluarkan setelah perubahan.")}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void perform(async () => {
                    if (f.get("newPassword") !== f.get("confirmPassword"))
                      throw new Error(
                        tr("Konfirmasi kata sandi belum sesuai."),
                      );
                    await api("auth/password", "POST", {
                      currentPassword: f.get("currentPassword"),
                      newPassword: f.get("newPassword"),
                    });
                    setModal("");
                  }, tr("Kata sandi diperbarui. Sesi lain telah berakhir."));
                }}
              >
                <Field label={tr("Kata sandi saat ini")}>
                  <input
                    name="currentPassword"
                    type="password"
                    required
                    maxLength={256}
                    autoComplete="current-password"
                  />
                </Field>
                <Field
                  label={tr("Kata sandi baru")}
                  hint={tr("Minimal 12 karakter.")}
                >
                  <input
                    name="newPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={256}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label={tr("Konfirmasi kata sandi baru")}>
                  <input
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={256}
                    autoComplete="new-password"
                  />
                </Field>
                <button className="secondary full" disabled={busy}>
                  {tr("Simpan kata sandi")}
                </button>
              </form>
            </details>
          </Modal>
        )}
        {modal === "notifications" && (
          <Modal title={tr("Notifikasi tim")} close={() => setModal("")}>
            <div className="notification-toolbar">
              <button
                className="text-btn"
                onClick={() =>
                  void perform(
                    () => api("notifications/read-all", "POST", {}),
                    tr("Semua notifikasi ditandai dibaca."),
                  )
                }
              >
                {tr("Tandai semua dibaca")}
              </button>
              <button className="text-btn" onClick={() => navigate("push")}>
                {tr("Pengaturan notifikasi")}
              </button>
            </div>
            <div className="activity-list">
              {data.notifications.map((n) => (
                <div key={n.id}>
                  <Bell size={17} />
                  <div>
                    <b>{tr(n.title)}</b>
                    <p>{tr(n.body)}</p>
                    <div className="notification-meta">
                      <time>{date(n.created_at)}</time>
                      <div className="notification-actions">
                        <button
                          className="text-btn"
                          onClick={() => {
                            if (n.event_key?.startsWith("push-test:")) {
                              navigate("push");
                              return;
                            }
                            setSelected({ id: n.resource_id });
                            setModal("detail");
                          }}
                        >
                          {tr(
                            n.event_key?.startsWith("push-test:")
                              ? "Buka pengaturan"
                              : "Buka kampanye ",
                          )}
                          <ChevronRight size={14} />
                        </button>
                        {!n.read_by.includes(data.user.id) && (
                          <button
                            className="text-btn"
                            onClick={() =>
                              void perform(
                                () =>
                                  api(`notifications/${n.id}/read`, "POST", {}),
                                tr("Notifikasi ditandai dibaca."),
                              )
                            }
                          >
                            {tr("Tandai dibaca")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Modal>
        )}
        {modal === "dashboard" && (
          <Modal title={tr("Atur ruang pantau")} close={() => setModal("")}>
            <DashboardEditor
              value={data.user.profile.dashboard}
              busy={busy}
              save={(value) =>
                perform(async () => {
                  await api("dashboard", "PUT", value);
                  setModal("");
                })
              }
              reset={() =>
                perform(async () => {
                  await api("dashboard/reset", "POST", {});
                  setModal("");
                }, tr("Default dipulihkan."))
              }
              publish={
                can("admin:write")
                  ? (value) =>
                      perform(async () => {
                        await api("admin/dashboard-default", "PUT", value);
                        await api("dashboard", "PUT", value);
                        setModal("");
                      }, tr("Default perusahaan dipublikasikan."))
                  : undefined
              }
            />
          </Modal>
        )}
        {modal === "policy" && (
          <PolicyForm
            data={data}
            close={() => setModal("")}
            busy={busy}
            save={(stages) =>
              perform(async () => {
                await api("admin/approval-policy", "PUT", { stages });
                setModal("");
              }, tr("Kebijakan baru tersimpan. Pengajuan lama tetap memakai versi sebelumnya."))
            }
          />
        )}
        {modal === "detail" && (
          <Modal
            title={detail?.campaign?.name ?? tr("Detail kampanye")}
            close={() => {
              setModal("");
              setDetail(null);
            }}
            wide
          >
            {!detail ? (
              <p>{tr("Memuat\u2026")}</p>
            ) : (
              <>
                <div className="detail-summary">
                  <Badge status={detail.campaign.status} />
                  <span className="mono">
                    {detail.campaign.id}
                    {tr(" \u00B7 v")}
                    {detail.campaign.version}
                  </span>
                </div>
                {detail.staleReview && (
                  <div className="alert error" role="alert">
                    {tr(
                      "Kampanye atau tingkat persetujuan sudah berubah. Tutup detail ini dan buka kembali untuk meninjau informasi terbaru.",
                    )}
                  </div>
                )}
                {(can("campaigns:manage") || can("campaigns:create")) &&
                  detail.campaign.status !== "CANCELLED" && (
                    <div className="campaign-controls">
                      {can("campaigns:create") &&
                        [
                          "DRAFT",
                          "RETURNED",
                          "REJECTED",
                          "APPROVED",
                          "SCHEDULED",
                          "PAUSED",
                        ].includes(detail.campaign.status) && (
                          <button
                            className="secondary"
                            disabled={
                              busy ||
                              detail.runs.some(
                                (r: Row) =>
                                  [
                                    "PREFLIGHT",
                                    "QUEUED",
                                    "RUNNING",
                                    "BUDGET_HOLD",
                                    "PAUSED",
                                    "RECOVERY_HOLD",
                                  ].includes(r.status) ||
                                  (r.status === "VALIDATION_HOLD" &&
                                    r.budget_id),
                              )
                            }
                            onClick={() => {
                              setSelected(detail.campaign);
                              setModal("revision");
                            }}
                          >
                            {tr("Revisi kampanye")}
                          </button>
                        )}
                      {can("campaigns:manage") &&
                        ["APPROVED", "SCHEDULED"].includes(
                          detail.campaign.status,
                        ) && (
                          <button
                            className="secondary"
                            onClick={() => {
                              setSelected({
                                ...detail.campaign,
                                controlAction: "pause",
                              });
                              setModal("control");
                            }}
                          >
                            {tr("Jeda kampanye")}
                          </button>
                        )}
                      {can("campaigns:manage") &&
                        detail.campaign.status === "PAUSED" && (
                          <button
                            className="secondary"
                            onClick={() => {
                              setSelected({
                                ...detail.campaign,
                                controlAction: "resume",
                              });
                              setModal("control");
                            }}
                          >
                            {tr("Lanjutkan kampanye")}
                          </button>
                        )}
                      {can("campaigns:manage") && (
                        <button
                          className="secondary"
                          onClick={() => {
                            setSelected({
                              ...detail.campaign,
                              controlAction: "cancel",
                            });
                            setModal("control");
                          }}
                        >
                          {tr("Hentikan kampanye")}
                        </button>
                      )}
                    </div>
                  )}
                <div className="info-strip">
                  <ShieldCheck size={18} />
                  {tr("Uji pengiriman.")}{" "}
                  {can("budgets:read") && (
                    <>
                      {tr("Batas disetujui:")}{" "}
                      {money(detail.campaign.definition.spendingCeiling)} ·{" "}
                    </>
                  )}
                  {detail.campaign.message_count ??
                    detail.campaign.snapshot?.length ??
                    0}{" "}
                  {tr("pesan.")}
                </div>
                {detail.campaign.snapshot?.[0] && (
                  <blockquote>{detail.campaign.snapshot[0].body}</blockquote>
                )}
                <h3>{tr("Persetujuan")}</h3>
                <ol className="policy-list">
                  {detail.campaign.approval_policy?.stages.map(
                    (s: Row, i: number) => {
                      const result = detail.approvals.find(
                        (a: Row) =>
                          a.stage === i &&
                          a.version === detail.campaign.version,
                      );
                      return (
                        <li key={i}>
                          {s.name}
                          <small>
                            {result
                              ? `${result.decision} · ${result.actor_name}${result.reason ? ` · ${result.reason}` : ""}`
                              : i === detail.campaign.approval_stage
                                ? tr("Menunggu keputusan")
                                : tr("Belum diproses")}
                          </small>
                        </li>
                      );
                    },
                  )}
                </ol>
                {!!detail.approvals.length && (
                  <details className="approval-history">
                    <summary>
                      {tr("Riwayat keputusan semua versi (")}
                      {detail.approvals.length})
                    </summary>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>{tr("Versi / tingkat")}</th>
                            <th>{tr("Keputusan")}</th>
                            <th>{tr("Pengguna")}</th>
                            <th>{tr("Waktu / alasan")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.approvals.map((a: Row) => (
                            <tr key={a.id}>
                              <td>
                                {tr("v")}
                                {a.version} · {a.stage + 1}
                              </td>
                              <td>{a.decision}</td>
                              <td>{a.actor_name}</td>
                              <td>
                                {date(a.created_at)}
                                <small>{a.reason}</small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}
                {detail.campaign.status === "DRAFT" &&
                  can("campaigns:create") && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void perform(
                          () =>
                            api(
                              `campaigns/${detail.campaign.id}/submit`,
                              "POST",
                              {},
                            ),
                          tr("Kampanye diajukan."),
                        )
                      }
                    >
                      {tr("Ajukan persetujuan")}
                    </button>
                  )}
                {detail.campaign.status === "PENDING_APPROVAL" &&
                  can("campaigns:approve") &&
                  detail.campaign.created_by !== data.user.id &&
                  detail.campaign.revised_by !== data.user.id &&
                  detail.campaign.approval_policy.stages[
                    detail.campaign.approval_stage
                  ]?.roleIds.includes(data.user.role_id) && (
                    <form
                      className="decision-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void perform(async () => {
                          await api(
                            `campaigns/${detail.campaign.id}/decision`,
                            "POST",
                            {
                              decision: f.get("decision"),
                              version: detail.campaign.version,
                              stage: detail.campaign.approval_stage,
                              reason: f.get("reason"),
                            },
                          );
                          setDetail(
                            await api(`campaigns/${detail.campaign.id}`),
                          );
                        }, tr("Keputusan tersimpan."));
                      }}
                    >
                      <Field label={tr("Keputusan")}>
                        <Select name="decision">
                          <option value="APPROVE">{tr("Setujui")}</option>
                          <option value="RETURN">
                            {tr("Kembalikan untuk revisi")}
                          </option>
                          <option value="REJECT">{tr("Tolak")}</option>
                        </Select>
                      </Field>
                      <Field
                        label={tr(
                          "Catatan (wajib untuk penolakan / pengembalian)",
                        )}
                      >
                        <input name="reason" maxLength={1000} />
                      </Field>
                      <button
                        className="primary"
                        disabled={busy || detail.staleReview}
                      >
                        <Check size={17} />
                        {tr("Simpan keputusan")}
                      </button>
                    </form>
                  )}
                <h3>{tr("Riwayat eksekusi")}</h3>
                {detail.runs.length ? (
                  <div className="run-list">
                    {detail.runs.map((r: Row) => (
                      <div key={r.id}>
                        <div>
                          <b className="mono">{r.id.slice(0, 8)}</b>
                          <small>
                            {date(r.intended_at)}
                            {can("budgets:read") && (
                              <>
                                {tr(" \u00B7 Estimasi ")}
                                {money(r.estimated)}
                              </>
                            )}
                          </small>
                        </div>
                        <Badge status={r.status} />
                        {can("campaigns:manage") &&
                          ["RECOVERY_HOLD", "VALIDATION_HOLD"].includes(
                            r.status,
                          ) &&
                          r.budget_id && (
                            <button
                              className="secondary"
                              onClick={() => {
                                setSelected({
                                  ...r,
                                  controlAction: "recover",
                                  name: detail.campaign.name,
                                });
                                setModal("control");
                              }}
                            >
                              {tr("Tinjau pemulihan")}
                            </button>
                          )}
                        {can("campaigns:manage") &&
                          r.status === "BUDGET_HOLD" && (
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                void perform(
                                  () => api(`runs/${r.id}/retry`, "POST", {}),
                                  tr("Pemeriksaan anggaran dijalankan."),
                                )
                              }
                            >
                              {tr("Periksa ulang")}
                            </button>
                          )}
                        {can("campaigns:manage") &&
                          ["BUDGET_HOLD", "MISSED"].includes(r.status) && (
                            <button
                              className="secondary"
                              onClick={() => {
                                setSelected(r);
                                setModal("reschedule");
                              }}
                            >
                              {tr("Jadwalkan ulang")}
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>
                    {tr("Eksekusi dibuat setelah semua persetujuan selesai.")}
                  </Empty>
                )}
                <div className="section-heading">
                  <h3>
                    {tr("Pesan")}{" "}
                    <small>
                      ({detail.messageTotal}
                      {tr(" total \u00B7 200 per halaman)")}
                    </small>
                  </h3>
                  <div>
                    <button
                      className="secondary"
                      disabled={messagePage === 0}
                      onClick={() => setMessagePage(messagePage - 1)}
                    >
                      {tr("Sebelumnya")}
                    </button>
                    <button
                      className="secondary"
                      disabled={(messagePage + 1) * 200 >= detail.messageTotal}
                      onClick={() => setMessagePage(messagePage + 1)}
                    >
                      {tr("Berikutnya")}
                    </button>
                  </div>
                </div>
                {detail.messages.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{tr("Penerima")}</th>
                          <th>{tr("Kanal")}</th>
                          <th>{tr("Status")}</th>
                          {can("budgets:read") && <th>{tr("Estimasi")}</th>}
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {detail.messages.map((m: Row) => (
                          <tr key={m.id}>
                            <td>{m.recipient}</td>
                            <td>{m.channel}</td>
                            <td>
                              <Badge status={m.status} />
                            </td>
                            {can("budgets:read") && (
                              <td>{money(m.unit_cost)}</td>
                            )}
                            <td>
                              <button
                                className="text-btn"
                                onClick={() =>
                                  void perform(async () => {
                                    setSelected(await api(`messages/${m.id}`));
                                    setModal("timeline");
                                  }, tr("Riwayat pesan siap."))
                                }
                              >
                                {tr("Riwayat")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="hint">
                    {tr("Belum ada pesan yang masuk antrean.")}
                  </p>
                )}
              </>
            )}
          </Modal>
        )}
        {modal === "timeline" && selected && (
          <Modal title={tr("Riwayat pesan")} close={() => setModal("")}>
            <p>
              {selected.message.recipient} · {selected.message.channel}
            </p>
            <Badge status={selected.message.status} />
            <blockquote>{selected.message.body}</blockquote>
            <div className="activity-list">
              {selected.events.map((e: Row) => (
                <div key={e.id}>
                  <Clock3 size={16} />
                  <div>
                    <b>{labels[e.status] ?? e.status}</b>
                    <p>{e.detail}</p>
                    <small>{date(e.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
            <p className="hint mono">
              {tr("Provider: ")}
              {selected.message.provider_ref ?? tr("Belum tersedia")}
            </p>
            <p className="hint">
              {selected.attempts.length}
              {tr(
                " percobaan \u00B7 Uji pengiriman. UNKNOWN memerlukan pemeriksaan; tidak dikirim ulang otomatis.",
              )}
            </p>
            {selected.message.status === "UNKNOWN" && can("budgets:write") && (
              <form
                className="decision-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void perform(async () => {
                    await api(
                      `messages/${selected.message.id}/reconcile`,
                      "POST",
                      { status: f.get("status"), reason: f.get("reason") },
                    );
                    setSelected(await api(`messages/${selected.message.id}`));
                  }, tr("Hasil simulasi dan biaya telah direkonsiliasi."));
                }}
              >
                <h3>{tr("Rekonsiliasi hasil simulasi")}</h3>
                <p className="hint">
                  {tr(
                    "Konfirmasi hasil setelah pemeriksaan. Pesan tidak dikirim ulang.",
                  )}
                </p>
                <Field label={tr("Hasil terkonfirmasi")}>
                  <Select name="status">
                    <option value="DELIVERED">
                      {tr("Tersampaikan \u2014 catat biaya demo")}
                    </option>
                    <option value="FAILED">
                      {tr("Gagal \u2014 lepaskan cadangan demo")}
                    </option>
                  </Select>
                </Field>
                <Field label={tr("Alasan pemeriksaan")}>
                  <textarea
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                  />
                </Field>
                <button className="primary" disabled={busy}>
                  {tr("Konfirmasi hasil simulasi")}
                </button>
              </form>
            )}
          </Modal>
        )}
        {modal === "reschedule" && selected && (
          <Modal
            title={tr("Jadwalkan ulang secara eksplisit")}
            close={() => setModal("")}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void perform(async () => {
                  await api(`runs/${selected.id}/reschedule`, "POST", {
                    date: new Date(String(f.get("date"))).toISOString(),
                  });
                  setModal("");
                }, tr("Jadwal baru dibuat. Riwayat lama tetap tersimpan."));
              }}
            >
              <Field label={tr("Waktu baru (zona waktu komputer Anda)")}>
                <input name="date" type="datetime-local" required />
              </Field>
              <button className="primary full" disabled={busy}>
                {tr("Buat jadwal baru")}
              </button>
            </form>
          </Modal>
        )}
        {modal === "control" && selected && (
          <Modal
            title={
              selected.controlAction === "recover"
                ? tr("Putuskan pemulihan eksekusi")
                : tr("Kelola kampanye")
            }
            close={() => setModal("")}
          >
            <p>{selected.name}</p>
            <div className="info-strip">
              {selected.controlAction === "cancel"
                ? tr(
                    "Pesan yang belum diproses akan dihentikan dan cadangannya dilepas. Hasil dan biaya pesan yang sudah diproses tetap tersimpan.",
                  )
                : selected.controlAction === "recover"
                  ? tr(
                      "Hanya sisa pesan yang belum diproses akan dilanjutkan. Pesan yang terkirim atau belum terkonfirmasi tidak dikirim ulang. Jadwal yang terlewat menggunakan alur penjadwalan ulang terpisah.",
                    )
                  : selected.controlAction === "pause"
                    ? tr(
                        "Pengiriman baru dijeda. Cadangan anggaran tetap disimpan.",
                      )
                    : tr(
                        "Sisa pesan dari eksekusi yang dijeda akan dilanjutkan; jadwal yang sudah lewat tidak dikirim sebagai backlog.",
                      )}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void perform(async () => {
                  await api(
                    selected.controlAction === "recover"
                      ? `runs/${selected.id}/recover`
                      : `campaigns/${selected.id}/control`,
                    "POST",
                    { action: selected.controlAction, reason: f.get("reason") },
                  );
                  setModal("");
                }, tr("Keputusan tersimpan."));
              }}
            >
              <Field label={tr("Alasan tindakan")}>
                <textarea
                  name="reason"
                  required
                  minLength={3}
                  maxLength={500}
                />
              </Field>
              <button className="primary full" disabled={busy}>
                {tr("Konfirmasi")}{" "}
                {selected.controlAction === "recover"
                  ? tr("lanjutkan sisa pesan")
                  : selected.controlAction === "cancel"
                    ? tr("hentikan")
                    : selected.controlAction === "pause"
                      ? tr("jeda")
                      : tr("lanjutkan")}
              </button>
            </form>
          </Modal>
        )}
      </div>
    </DialogErrorContext.Provider>
  );
}
function CampaignForm({
  data,
  initialCampaign,
  busy,
  close,
  save,
}: {
  data: Bootstrap;
  initialCampaign?: Row | null;
  busy: boolean;
  close: () => void;
  save: (input: unknown) => Promise<void>;
}) {
  const initial = initialCampaign?.definition as Row | undefined;
  const targetTeam = initialCampaign?.team_id ?? data.user.team_id;
  const [mode, setMode] = useState(initial?.mode ?? "immediate");
  const [catalog, setCatalog] = useState<Row[]>(data.templates);
  const [sources, setSources] = useState<Row[]>(data.datasets);
  const [sourceId, setSourceId] = useState(initial?.datasetId ?? "");
  const [formError, setFormError] = useState("");
  const sourceRequest = useRef(0);
  const [providerData, setProviderData] = useState<{
    accounts: Row[];
    rates: Row[];
  }>({ accounts: [], rates: [] });
  const [providerId, setProviderId] = useState(
    initial?.providerAccountId ?? "",
  );
  useEffect(() => {
    void api("providers")
      .then((p) => {
        setProviderData(p);
        setProviderId(
          initialCampaign
            ? (initial?.providerAccountId ?? "")
            : (p.accounts.find((a: Row) => a.enabled && a.simulated)?.id ?? ""),
        );
      })
      .catch(() =>
        setFormError(
          tr("Konfigurasi penyedia belum dapat dimuat. Tutup dan coba lagi."),
        ),
      );
  }, []);
  const [timeZone, setTimeZone] = useState(initial?.timeZone ?? "Asia/Jakarta");
  const [templateIds, setTemplateIds] = useState<string[]>(
    initial?.templateIds ?? [],
  );
  const [dataset, setDataset] = useState<Row | null>(null);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>(
    initial?.fieldMap ?? {},
  );
  const loadDataset = async (id: string) => {
    const request = ++sourceRequest.current;
    setSourceId(id);
    setDataset(null);
    try {
      const row = await api(`datasets/${id}`);
      if (request !== sourceRequest.current) return;
      setDataset(row);
      setSources((previous) =>
        previous.some((s) => s.id === id) ? previous : [row, ...previous],
      );
    } catch {
      if (request === sourceRequest.current)
        setFormError(
          tr(
            "Sumber data tidak dapat dimuat. Pilih kembali sumber yang tersedia.",
          ),
        );
    }
  };
  useEffect(() => {
    if (initial) {
      void loadDataset(initial.datasetId);
      void Promise.all(
        (initial.templateIds as string[])
          .filter((id) => !catalog.some((t) => t.id === id))
          .map((id) => api(`templates/${id}`)),
      )
        .then((rows) => setCatalog((previous) => [...previous, ...rows]))
        .catch(() =>
          setFormError(tr("Template versi lama tidak dapat dimuat.")),
        );
    }
    return () => {
      sourceRequest.current++;
    };
  }, []);
  const templates = catalog.filter((t) => templateIds.includes(t.id));
  const vars = [
    ...new Set(
      templates.flatMap((t) =>
        [...t.body.matchAll(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g)].map(
          (m) => m[1],
        ),
      ),
    ),
  ];
  const columns = Object.keys(dataset?.rows[0] ?? {});
  const estimate = templates.reduce(
    (n, t) =>
      n +
      Number(
        providerData.rates.find(
          (r) =>
            r.account_id === providerId &&
            r.channel === t.channel &&
            new Date(r.effective_from).getTime() <= Date.now() &&
            (!r.effective_until ||
              new Date(r.effective_until).getTime() > Date.now()),
        )?.price ??
          (t.channel === "email" ? 10 : t.channel === "sms" ? 350 : 500),
      ) *
        Number(
          dataset?.row_count ??
            data.datasets.find((d) => d.id === dataset?.id)?.row_count ??
            dataset?.rows.length ??
            0,
        ),
    0,
  );
  return (
    <Modal
      title={initialCampaign ? tr("Revisi kampanye") : tr("Buat kampanye")}
      close={close}
      wide
    >
      {formError && (
        <div className="alert error" role="alert">
          {formError}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void save({
            name: f.get("name"),
            datasetId: f.get("datasetId"),
            ...(providerId ? { providerAccountId: providerId } : {}),
            templateIds,
            costCentreId: f.get("costCentreId"),
            spendingCeiling: f.get("ceiling"),
            mode,
            timeZone,
            fieldMap,
            ...(mode !== "immediate"
              ? {
                  scheduledAt: DateTime.fromISO(String(f.get("scheduledAt")), {
                    zone: timeZone,
                  })
                    .toUTC()
                    .toISO(),
                }
              : {}),
            ...(mode === "recurring"
              ? {
                  recurrence: {
                    frequency: f.get("frequency"),
                    interval: Number(f.get("interval")),
                    count: Number(f.get("count")),
                  },
                }
              : {}),
          });
        }}
      >
        <div className="form-step">
          <span>1</span>
          <h3>{tr("Nama dan penerima")}</h3>
        </div>
        <div className="form-grid">
          <Field label={tr("Nama kampanye")}>
            <input
              name="name"
              required
              minLength={3}
              placeholder={tr("Contoh: Pengingat November")}
              defaultValue={initial?.name ?? initialCampaign?.name ?? ""}
            />
          </Field>
          <Field label={tr("Sumber data")}>
            <Select
              name="datasetId"
              required
              value={sourceId}
              onChange={(e) => void loadDataset(e.target.value)}
            >
              <option value="" disabled>
                {tr("Pilih sumber")}
              </option>
              {sources
                .filter((d) => d.team_id === targetTeam)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.row_count}
                    {tr(" baris")}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <div className="form-step">
          <span>2</span>
          <h3>{tr("Pilih kanal dan template")}</h3>
        </div>
        <div className="template-choices">
          {catalog
            .filter((t) => t.team_id === targetTeam)
            .map((t) => (
              <label
                key={t.id}
                className={templateIds.includes(t.id) ? "chosen" : ""}
              >
                <input
                  type="checkbox"
                  checked={templateIds.includes(t.id)}
                  onChange={(e) =>
                    setTemplateIds(
                      e.target.checked
                        ? [
                            ...templateIds.filter(
                              (id) =>
                                catalog.find((x) => x.id === id)?.channel !==
                                t.channel,
                            ),
                            t.id,
                          ]
                        : templateIds.filter((id) => id !== t.id),
                    )
                  }
                />
                <b>{t.channel}</b>
                <small>
                  {t.name}
                  {tr(" \u00B7 v")}
                  {t.version}
                </small>
              </label>
            ))}
        </div>
        <Field label={tr("Akun penyedia")}>
          <Select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
          >
            <option value="">{tr("Simulator bawaan (tarif demo)")}</option>
            {providerData.accounts
              .filter((a) => a.enabled && a.simulated)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {tr(" \u00B7 v")}
                  {a.version}
                </option>
              ))}
          </Select>
        </Field>
        {vars.length > 0 && (
          <div className="form-grid">
            {vars.map((v) => (
              <Field key={v} label={tr("Variabel {0}", { "0": v })}>
                <Select
                  value={fieldMap[v] ?? v}
                  onChange={(e) =>
                    setFieldMap({ ...fieldMap, [v]: e.target.value })
                  }
                >
                  {!columns.includes(v) && (
                    <option value={v}>{tr("Pilih kolom\u2026")}</option>
                  )}
                  {columns.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        )}
        {dataset &&
          templates.map((t) => (
            <div className="message-preview" key={t.id}>
              <small>
                {tr("PRATINJAU \u00B7 ")}
                {t.channel.toUpperCase()}
                {tr(" \u00B7 BARIS PERTAMA")}
              </small>
              <p>
                {t.body.replace(
                  /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g,
                  (_: string, key: string) =>
                    dataset.rows[0]?.[fieldMap[key] ?? key] ??
                    tr("[{0} belum diisi]", { "0": key }),
                )}
              </p>
            </div>
          ))}
        <div className="form-step">
          <span>3</span>
          <h3>{tr("Waktu dan anggaran")}</h3>
        </div>
        <div className="form-grid">
          <Field label={tr("Pengiriman")}>
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="immediate">
                {tr("Segera setelah disetujui")}
              </option>
              <option value="once">{tr("Satu kali terjadwal")}</option>
              <option value="recurring">{tr("Berulang")}</option>
            </Select>
          </Field>
          <Field label={tr("Pusat biaya")}>
            <Select
              name="costCentreId"
              required
              defaultValue={initial?.costCentreId}
            >
              {data.costCentres
                .filter((b) => b.team_id === targetTeam)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </Select>
          </Field>
          {mode !== "immediate" && (
            <Field label={tr("Mulai (sesuai zona waktu kampanye)")}>
              <input
                name="scheduledAt"
                type="datetime-local"
                required
                defaultValue={
                  initial?.scheduledAt
                    ? DateTime.fromISO(initial.scheduledAt)
                        .setZone(timeZone)
                        .toFormat("yyyy-MM-dd'T'HH:mm")
                    : undefined
                }
              />
            </Field>
          )}
          {mode !== "immediate" && (
            <Field label={tr("Zona waktu kampanye")}>
              <Select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
              >
                <option value="Asia/Jakarta">
                  {tr("WIB \u00B7 Asia/Jakarta")}
                </option>
                <option value="Asia/Makassar">
                  {tr("WITA \u00B7 Asia/Makassar")}
                </option>
                <option value="Asia/Jayapura">
                  {tr("WIT \u00B7 Asia/Jayapura")}
                </option>
                <option value="UTC">{tr("UTC")}</option>
              </Select>
            </Field>
          )}
          <Field
            label={tr("Batas biaya per eksekusi (IDR)")}
            hint={tr(
              "Mencakup seluruh kanal; tarif demo. SMS panjang dihitung per segmen.",
            )}
          >
            <input
              name="ceiling"
              type="number"
              required
              min="1"
              defaultValue={initial?.spendingCeiling ?? "100000"}
              step="0.0001"
            />
          </Field>
        </div>
        {mode === "recurring" && (
          <div className="form-grid">
            <Field label={tr("Pola")}>
              <Select
                name="frequency"
                defaultValue={initial?.recurrence?.frequency ?? "daily"}
              >
                <option value="daily">{tr("Harian")}</option>
                <option value="weekly">{tr("Mingguan")}</option>
                <option value="monthly">{tr("Bulanan")}</option>
              </Select>
            </Field>
            <Field label={tr("Interval")}>
              <input
                name="interval"
                type="number"
                min="1"
                max="12"
                defaultValue={initial?.recurrence?.interval ?? 1}
              />
            </Field>
            <Field label={tr("Jumlah eksekusi")}>
              <input
                name="count"
                type="number"
                min="1"
                max="1000"
                defaultValue={initial?.recurrence?.count ?? 12}
              />
            </Field>
          </div>
        )}
        <div className="review-strip">
          <ShieldCheck size={23} />
          <div>
            <b>
              {data.policy.stages.length}
              {tr(" tingkat persetujuan diperlukan")}
            </b>
            <p>
              {dataset?.row_count ?? 0}
              {tr(" penerima \u00D7 ")}
              {templateIds.length}
              {tr(" kanal \u00B7 Estimasi awal ")}
              {money(estimate)}
              {tr(
                ". Validasi server memeriksa biaya dan data sebelum pengajuan.",
              )}
              {mode === "recurring" ? tr(" Seri disetujui satu kali.") : ""}
            </p>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={close}>
            {tr("Batal")}
          </button>
          <button
            className="primary"
            disabled={
              busy ||
              !!formError ||
              !templateIds.length ||
              templateIds.length !== templates.length ||
              !dataset ||
              (!!providerId &&
                !providerData.accounts.some(
                  (a) => a.id === providerId && a.enabled && a.simulated,
                ))
            }
          >
            {tr("Ajukan persetujuan ")}
            <ArrowUpRight size={17} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function PolicyForm({
  data,
  busy,
  close,
  save,
}: {
  data: Bootstrap;
  busy: boolean;
  close: () => void;
  save: (stages: Row[]) => Promise<void>;
}) {
  const [stages, setStages] = useState<Row[]>(data.policy.stages);
  return (
    <Modal title={tr("Atur tingkat persetujuan")} close={close}>
      <p>
        {tr(
          "Kebijakan baru berlaku untuk pengajuan berikutnya. Pembuat tidak dapat menyetujui kampanye sendiri.",
        )}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(stages);
        }}
      >
        {stages.map((s, i) => (
          <div className="policy-edit" key={i}>
            <Field label={tr("Tingkat {0}", { "0": i + 1 })}>
              <input
                required
                minLength={2}
                value={s.name}
                onChange={(e) =>
                  setStages(
                    stages.map((x, n) =>
                      n === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
            </Field>
            <Field label={tr("Peran yang dapat menyetujui")}>
              <Select
                multiple
                required
                value={s.roleIds}
                onChange={(e) =>
                  setStages(
                    stages.map((x, n) =>
                      n === i
                        ? {
                            ...x,
                            roleIds: [...e.target.selectedOptions].map(
                              (o) => o.value,
                            ),
                          }
                        : x,
                    ),
                  )
                }
              >
                {data.roles
                  .filter((r) => r.permissions.includes("campaigns:approve"))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </Select>
            </Field>
            {stages.length > 1 && (
              <button
                type="button"
                className="text-btn"
                onClick={() => setStages(stages.filter((_, n) => n !== i))}
              >
                {tr("Hapus tingkat")}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setStages([
              ...stages,
              {
                name: tr("Tingkat {0}", { "0": stages.length + 1 }),
                roleIds: [],
              },
            ])
          }
        >
          <Plus size={16} />
          {tr("Tambah tingkat")}
        </button>
        <button className="primary full" disabled={busy}>
          {tr("Simpan kebijakan")}
        </button>
      </form>
    </Modal>
  );
}
