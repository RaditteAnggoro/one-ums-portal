"use client";
import { Select } from "./select";
import { t as tr, useLanguage } from "./i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  MessagesSquare,
  ListFilter,
  Activity,
  Workflow,
  ShieldCheck,
  FileText,
  Database,
  Wallet,
  Receipt,
  Scale,
  Plug,
  Building2,
  ScrollText,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Bell,
  LogOut,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  ChevronsUpDown,
  HelpCircle,
  Wrench,
  History,
  Info,
  GripVertical,
  Command,
} from "lucide-react";
type Row = Record<string, any>;
export const navigation = [
  {
    key: "maintenance",
    label: "Pemeliharaan",
    group: "Administration",
    route: "/settings/maintenance",
    icon: Wrench,
    permission: "admin:write",
  },
  {
    key: "releases",
    label: "Riwayat perubahan",
    group: "Support",
    route: "/updates",
    icon: History,
  },
  {
    key: "about",
    label: "Tentang aplikasi",
    group: "Support",
    route: "/about",
    icon: Info,
  },
  {
    key: "push",
    label: "Notifikasi perangkat",
    group: "Support",
    route: "/settings/notifications",
    icon: Bell,
  },
  {
    key: "companies",
    label: "Perusahaan",
    group: "Administration",
    route: "/settings/companies",
    icon: Building2,
  },
  {
    key: "help",
    label: "Panduan pengguna",
    group: "Support",
    route: "/help",
    icon: HelpCircle,
  },

  {
    key: "dashboard",
    label: "Overview",
    group: "Overview",
    route: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "messages",
    label: "Message Explorer",
    group: "Operations",
    route: "/messages",
    icon: MessagesSquare,
    permission: "campaigns:read",
  },
  {
    key: "deliveries",
    label: "Antrean pengiriman",
    group: "Operations",
    route: "/deliveries",
    icon: ListFilter,
    permission: "campaigns:read",
  },
  {
    key: "channels",
    label: "Pemantauan kanal",
    group: "Operations",
    route: "/channels",
    icon: Activity,
    permission: "campaigns:read",
  },
  {
    key: "campaigns",
    label: "Kampanye",
    group: "Orchestration",
    route: "/workflows",
    icon: Workflow,
    permission: "campaigns:read",
  },
  {
    key: "approvals",
    label: "Persetujuan",
    group: "Orchestration",
    route: "/approvals",
    icon: ShieldCheck,
    permission: "campaigns:approve",
  },
  {
    key: "templates",
    label: "Template pesan",
    group: "Orchestration",
    route: "/templates",
    icon: FileText,
    permission: "templates:write",
  },
  {
    key: "sources",
    label: "Sumber data",
    group: "Orchestration",
    route: "/sources",
    icon: Database,
    permission: "sources:write",
  },
  {
    key: "usage",
    label: "Penggunaan & biaya",
    group: "Finance",
    route: "/finance/usage",
    icon: Receipt,
    permission: "budgets:read",
  },
  {
    key: "budgets",
    label: "Alokasi biaya",
    group: "Finance",
    route: "/finance/allocation",
    icon: Wallet,
    permission: "budgets:read",
  },
  {
    key: "reconciliation",
    label: "Rekonsiliasi",
    group: "Finance",
    route: "/finance/reconciliation",
    icon: Scale,
    permission: "budgets:read",
  },
  {
    key: "providers",
    label: "Vendor & integrasi",
    group: "Administration",
    route: "/settings/providers",
    icon: Plug,
    permission: "admin:write",
  },
  {
    key: "settings",
    label: "Pengaturan",
    group: "Administration",
    route: "/settings/applications",
    icon: Building2,
  },
  {
    key: "audit",
    label: "Akses & audit",
    group: "Administration",
    route: "/settings/audit",
    icon: ScrollText,
    permission: "audit:read",
  },
] as const;
export function pageForPath(path: string) {
  return navigation.find((n) => n.route === path)?.key ?? "dashboard";
}
export function pathForPage(page: string) {
  return navigation.find((n) => n.key === page)?.route ?? "/dashboard";
}
export function permittedNavigation(user: Row) {
  return navigation.filter(
    (n) =>
      (n.key !== "companies" || user.platform_admin) &&
      (!("permission" in n) || user.permissions.includes(n.permission)),
  );
}
export function useShellPreferences() {
  const [collapsed, setCollapsed] = useState(false),
    [theme, setTheme] = useState("light"),
    [width, setWidth] = useState(248);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ums.sidebar") === "collapsed");
      const saved = Number(localStorage.getItem("ums.sidebar.width"));
      if (Number.isFinite(saved) && saved >= 208 && saved <= 420)
        setWidth(saved);
      setTheme(localStorage.getItem("ums.theme") ?? "light");
    } catch {}
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.setAttribute(
        "data-theme",
        theme === "system" ? (media.matches ? "dark" : "light") : theme,
      );
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  const changeTheme = (value: string) => {
    setTheme(value);
    try {
      localStorage.setItem("ums.theme", value);
    } catch {}
  };
  const toggle = () =>
    setCollapsed((old) => {
      try {
        localStorage.setItem("ums.sidebar", old ? "expanded" : "collapsed");
      } catch {}
      return !old;
    });
  const resize = (next: number) => {
    const value = Math.max(208, Math.min(420, Math.round(next)));
    setWidth(value);
    try {
      localStorage.setItem("ums.sidebar.width", String(value));
    } catch {}
  };
  return { collapsed, toggle, theme, changeTheme, width, resize };
}
export function UMSBrand() {
  return (
    <span className="ums-brand">
      <span className="ums-mark">
        <MessagesSquare size={23} />
      </span>
      <span className="brand-word">
        {tr("one")}
        <span>{tr("ums")}</span>
        <small>{tr("MESSAGING PLATFORM")}</small>
      </span>
    </span>
  );
}
export function AppSidebar({
  user,
  page,
  pending,
  collapsed,
  toggle,
  navigate,
  profile,
  width,
  resize,
}: {
  user: Row;
  page: string;
  pending: number;
  collapsed: boolean;
  toggle: () => void;
  navigate: (key: string) => void;
  profile: () => void;
  width: number;
  resize: (width: number) => void;
}) {
  const links = permittedNavigation(user);
  const nav = useRef<HTMLElement>(null),
    lastUser = useRef(user.id),
    dragStart = useRef<{ x: number; width: number } | null>(null),
    expandedScroll = useRef(0);
  useLayoutEffect(() => {
    if (lastUser.current !== user.id) {
      nav.current?.scrollTo({ top: 0 });
      lastUser.current = user.id;
      expandedScroll.current = 0;
    }
  }, [user.id]);
  useLayoutEffect(() => {
    if (!collapsed && nav.current)
      nav.current.scrollTop = expandedScroll.current;
  }, [collapsed]);

  return (
    <aside className="sidebar ums-sidebar">
      <button
        className="brand-button"
        aria-label={tr("UMS Overview")}
        onClick={() => navigate("dashboard")}
      >
        <UMSBrand />
      </button>
      <div className="ums-workspace" title={user.company}>
        <span className="workspace-avatar">{user.company.slice(0, 1)}</span>
        <span className="workspace-copy">
          <b>{user.company}</b>
          <small>
            {user.company_scope
              ? tr("Company workspace")
              : tr("Team workspace")}
          </small>
        </span>
        <ChevronsUpDown size={14} />
      </div>
      <nav
        ref={nav}
        onScroll={(event) => {
          if (!collapsed)
            expandedScroll.current = event.currentTarget.scrollTop;
        }}
        aria-label={tr("Navigasi utama")}
      >
        {[
          "Overview",
          "Operations",
          "Orchestration",
          "Finance",
          "Administration",
          "Support",
        ].map((group) => {
          const items = links.filter((n) => n.group === group);
          return items.length ? (
            <div className="nav-group" key={group}>
              <span className="nav-label">{tr(group)}</span>
              {items.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  title={tr(label)}
                  aria-label={tr(label)}
                  aria-current={page === key ? "page" : undefined}
                  className={page === key ? "active" : ""}
                  onClick={() => navigate(key)}
                >
                  <Icon size={18} />
                  <span className="nav-text">{tr(label)}</span>
                  {key === "approvals" && pending > 0 && (
                    <span className="nav-count">{pending}</span>
                  )}
                </button>
              ))}
            </div>
          ) : null;
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-local">
          <ShieldCheck size={14} />
          <span>{tr("Akses mengikuti peran Anda")}</span>
        </div>
        <button
          className="user-button"
          aria-label={tr("Profil {0}", { "0": user.name })}
          onClick={profile}
        >
          <span className="avatar">
            {user.profile.picture ? (
              <img src={user.profile.picture} alt={tr("")} />
            ) : (
              user.name.slice(0, 2).toUpperCase()
            )}
          </span>
          <span className="user-copy">
            <b>{user.name}</b>
            <small>{user.role}</small>
          </span>
          <ChevronsUpDown size={14} />
        </button>
        <button
          className="collapse-button"
          aria-label={
            collapsed ? tr("Perluas navigasi") : tr("Ciutkan navigasi")
          }
          onClick={toggle}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
          <span className="nav-text">{tr("Ciutkan navigasi")}</span>
        </button>
      </div>
      {!collapsed && (
        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={tr("Ubah lebar navigasi")}
          aria-valuemin={208}
          aria-valuemax={420}
          aria-valuenow={width}
          tabIndex={0}
          onDoubleClick={() => resize(248)}
          onKeyDown={(event) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              resize(
                event.key === "Home"
                  ? 208
                  : event.key === "End"
                    ? 420
                    : width + (event.key === "ArrowRight" ? 16 : -16),
              );
            }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            const target = event.currentTarget;
            dragStart.current = { x: event.clientX, width };
            target.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (
              event.currentTarget.hasPointerCapture(event.pointerId) &&
              dragStart.current
            )
              resize(
                dragStart.current.width + event.clientX - dragStart.current.x,
              );
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
            dragStart.current = null;
          }}
          onPointerCancel={() => {
            dragStart.current = null;
          }}
        >
          <GripVertical size={14} />
        </div>
      )}
    </aside>
  );
}
export function AppHeader({
  page,
  user,
  theme,
  changeTheme,
  changeLanguage,
  environment,
  help,
  search,
  notifications,
  logout,
  unread,
}: {
  page: string;
  user: Row;
  theme: string;
  changeTheme: (v: string) => void;
  changeLanguage: (v: "id" | "en") => void;
  environment?: string;
  help: () => void;
  search: () => void;
  notifications: () => void;
  logout: () => void;
  unread: boolean;
}) {
  const { locale } = useLanguage();
  const entry = navigation.find((n) => n.key === page);
  return (
    <header className="topbar ums-topbar">
      <div className="breadcrumb">
        <span>{tr(entry?.group ?? "")}</span>
        <ChevronRight size={13} />
        <b>{tr(entry?.label ?? "")}</b>
      </div>
      <div className="top-actions">
        <button
          className="global-search"
          onClick={search}
          aria-label={tr("Pencarian global")}
        >
          <Search size={15} />
          <span>{tr("Cari halaman atau ID pesan\u2026")}</span>
          <kbd>{tr("\u2318 K")}</kbd>
        </button>
        {environment && (
          <span className="environment-indicator">
            <span className="status-dot" />
            {environment}
          </span>
        )}
        <label className="language-picker">
          <span className="sr-only">{tr("Bahasa")}</span>
          <Select
            aria-label={tr("Bahasa")}
            value={locale}
            onChange={(event) =>
              changeLanguage(event.target.value as "id" | "en")
            }
          >
            <option value="id">Indonesia</option>
            <option value="en">English</option>
          </Select>
        </label>
        <button
          className="icon-btn"
          aria-label={tr("Panduan pengguna")}
          onClick={help}
        >
          <HelpCircle size={18} />
        </button>
        <label className="theme-picker" title={tr("Tema")}>
          <span className="sr-only">{tr("Tema")}</span>
          {theme === "dark" ? (
            <Moon size={16} />
          ) : theme === "system" ? (
            <Monitor size={16} />
          ) : (
            <Sun size={16} />
          )}
          <Select
            aria-label={tr("Tema")}
            value={theme}
            onChange={(e) => changeTheme(e.target.value)}
          >
            <option value="light">{tr("Light")}</option>
            <option value="dark">{tr("Dark")}</option>
            <option value="system">{tr("System")}</option>
          </Select>
        </label>
        <button
          className="icon-btn"
          aria-label={tr("Notifikasi")}
          onClick={notifications}
        >
          <Bell size={18} />
          {unread && <i className="notification-dot" />}
        </button>
        <button className="icon-btn" aria-label={tr("Keluar")} onClick={logout}>
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
export function CommandSearch({
  user,
  navigate,
}: {
  user: Row;
  navigate: (key: string, query?: string) => void;
}) {
  const [search, setSearch] = useState("");
  const links = permittedNavigation(user).filter((n) =>
    `${tr(n.label)} ${tr(n.group)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="command-palette">
      <label className="search command-input">
        <Search size={18} />
        <input
          autoFocus
          aria-label={tr("Cari halaman atau ID pesan")}
          placeholder={tr("Cari halaman atau tempel ID pesan\u2026")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="command-results">
        {links.map((n) => (
          <button key={n.key} onClick={() => navigate(n.key)}>
            <n.icon size={17} />
            <span>
              {tr(n.label)}
              <small>{tr(n.group)}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
        {search.trim() && user.permissions.includes("campaigns:read") && (
          <button
            onClick={() =>
              navigate(
                "messages",
                `search=${encodeURIComponent(search.trim())}`,
              )
            }
          >
            <Search size={17} />
            <span>
              {tr("Telusuri ID \u201C")}
              {search.trim()}”
              <small>{tr("Message, provider, run, atau campaign ID")}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        )}
        {!links.length && !search.trim() && (
          <p>{tr("Tidak ada halaman yang tersedia.")}</p>
        )}
      </div>
      <small className="command-hint">
        <kbd>{tr("Esc")}</kbd>
        {tr(" untuk menutup \u00B7 Hasil mengikuti akses Anda")}
      </small>
    </div>
  );
}
