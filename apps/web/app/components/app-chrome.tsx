"use client";
import { useEffect, useState } from "react";
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
  Command,
} from "lucide-react";
type Row = Record<string, any>;
export const navigation = [
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
    (n) => !("permission" in n) || user.permissions.includes(n.permission),
  );
}
export function useShellPreferences() {
  const [collapsed, setCollapsed] = useState(false),
    [theme, setTheme] = useState("light");
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ums.sidebar") === "collapsed");
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
  return { collapsed, toggle, theme, changeTheme };
}
export function UMSBrand() {
  return (
    <span className="ums-brand">
      <span className="ums-mark">
        <MessagesSquare size={23} />
      </span>
      <span className="brand-word">
        one<span>ums</span>
        <small>MESSAGING PLATFORM</small>
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
}: {
  user: Row;
  page: string;
  pending: number;
  collapsed: boolean;
  toggle: () => void;
  navigate: (key: string) => void;
  profile: () => void;
}) {
  const links = permittedNavigation(user);
  return (
    <aside className="sidebar ums-sidebar">
      <button
        className="brand-button"
        aria-label="UMS Overview"
        onClick={() => navigate("dashboard")}
      >
        <UMSBrand />
      </button>
      <div className="ums-workspace" title={user.company}>
        <span className="workspace-avatar">{user.company.slice(0, 1)}</span>
        <span className="workspace-copy">
          <b>{user.company}</b>
          <small>
            {user.company_scope ? "Company workspace" : "Team workspace"}
          </small>
        </span>
        <ChevronsUpDown size={14} />
      </div>
      <nav aria-label="Navigasi utama">
        {[
          "Overview",
          "Operations",
          "Orchestration",
          "Finance",
          "Administration",
        ].map((group) => {
          const items = links.filter((n) => n.group === group);
          return items.length ? (
            <div className="nav-group" key={group}>
              <span className="nav-label">{group}</span>
              {items.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  title={label}
                  aria-label={label}
                  aria-current={page === key ? "page" : undefined}
                  className={page === key ? "active" : ""}
                  onClick={() => navigate(key)}
                >
                  <Icon size={18} />
                  <span className="nav-text">{label}</span>
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
          <span className="status-dot" />
          <span>
            Local simulation <small>Tanpa pengiriman eksternal</small>
          </span>
        </div>
        <button
          className="user-button"
          aria-label={`Profil ${user.name}`}
          onClick={profile}
        >
          <span className="avatar">
            {user.profile.picture ? (
              <img src={user.profile.picture} alt="" />
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
          aria-label={collapsed ? "Perluas navigasi" : "Ciutkan navigasi"}
          onClick={toggle}
        >
          {collapsed ? (
            <PanelLeftOpen size={17} />
          ) : (
            <PanelLeftClose size={17} />
          )}
          <span className="nav-text">Ciutkan navigasi</span>
        </button>
      </div>
    </aside>
  );
}
export function AppHeader({
  page,
  user,
  theme,
  changeTheme,
  search,
  notifications,
  logout,
  unread,
}: {
  page: string;
  user: Row;
  theme: string;
  changeTheme: (v: string) => void;
  search: () => void;
  notifications: () => void;
  logout: () => void;
  unread: boolean;
}) {
  const entry = navigation.find((n) => n.key === page);
  return (
    <header className="topbar ums-topbar">
      <div className="breadcrumb">
        <span>{entry?.group}</span>
        <ChevronRight size={13} />
        <b>{entry?.label}</b>
      </div>
      <div className="top-actions">
        <button
          className="global-search"
          onClick={search}
          aria-label="Pencarian global"
        >
          <Search size={15} />
          <span>Cari halaman atau ID pesan…</span>
          <kbd>⌘ K</kbd>
        </button>
        <span
          className="environment-indicator"
          title="Layanan dan data pengiriman simulasi lokal"
        >
          <span className="status-dot" />
          Development
        </span>
        <label className="theme-picker" title="Tema">
          <span className="sr-only">Tema</span>
          {theme === "dark" ? (
            <Moon size={16} />
          ) : theme === "system" ? (
            <Monitor size={16} />
          ) : (
            <Sun size={16} />
          )}
          <select
            aria-label="Tema"
            value={theme}
            onChange={(e) => changeTheme(e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>
        <button
          className="icon-btn"
          aria-label="Notifikasi"
          onClick={notifications}
        >
          <Bell size={18} />
          {unread && <i className="notification-dot" />}
        </button>
        <button className="icon-btn" aria-label="Keluar" onClick={logout}>
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
    `${n.label} ${n.group}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="command-palette">
      <label className="search command-input">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Cari halaman atau ID pesan"
          placeholder="Cari halaman atau tempel ID pesan…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="command-results">
        {links.map((n) => (
          <button key={n.key} onClick={() => navigate(n.key)}>
            <n.icon size={17} />
            <span>
              {n.label}
              <small>{n.group}</small>
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
              Telusuri ID “{search.trim()}”
              <small>Message, provider, run, atau campaign ID</small>
            </span>
            <ChevronRight size={15} />
          </button>
        )}
        {!links.length && !search.trim() && (
          <p>Tidak ada halaman yang tersedia.</p>
        )}
      </div>
      <small className="command-hint">
        <kbd>Esc</kbd> untuk menutup · Hasil mengikuti akses Anda
      </small>
    </div>
  );
}
