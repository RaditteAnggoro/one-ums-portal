"use client";
import { Select } from "./components/select";
import { t as tr } from "./components/i18n";
import { useEffect, useState, type ReactNode } from "react";
import { Plus, Users, ShieldCheck } from "lucide-react";
type Row = Record<string, any>;
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
const permissionNames: Record<string, string> = {
  "campaigns:read": "Lihat kampanye",
  "campaigns:create": "Buat kampanye",
  "campaigns:approve": "Setujui kampanye",
  "campaigns:manage": "Kelola eksekusi",
  "messages:payload": "Lihat isi pesan sensitif",
  "budgets:read": "Lihat anggaran dan biaya",
  "budgets:write": "Kelola anggaran",
  "sources:write": "Kelola sumber data",
  "templates:write": "Kelola template",
  "audit:read": "Lihat jejak audit",
  "admin:write": "Administrasi perusahaan",
};
export function AdminPanel({
  request,
  perform,
}: {
  request: Api;
  perform: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const [data, setData] = useState<Row | null>(null);
  const [tab, setTab] = useState("users");
  const [busy, setBusy] = useState(false),
    [page, setPage] = useState(1),
    [limit, setLimit] = useState(30),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Row | null>(null),
    [editingRole, setEditingRole] = useState<Row | null>(null);
  const refresh = async () =>
    setData(
      await request(
        `admin/workspace?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
      ),
    );
  useEffect(() => {
    void perform(refresh, tr("Administrasi siap."));
  }, [page, limit, search]);
  const submit = async (
    event: React.FormEvent<HTMLFormElement>,
    path: string,
    body: (f: FormData) => unknown,
  ) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = body(new FormData(form));
    setBusy(true);
    try {
      await perform(async () => {
        await request(`admin/${path}`, "POST", values);
        form.reset();
        await refresh();
      }, tr("Pengaturan perusahaan tersimpan."));
    } finally {
      setBusy(false);
    }
  };
  const field = (label: string, element: ReactNode) => (
    <label className="field" key={label}>
      <span>{label}</span>
      {element}
    </label>
  );
  if (!data)
    return (
      <section className="panel settings-panel">
        <p>{tr("Memuat administrasi perusahaan\u2026")}</p>
      </section>
    );
  return (
    <section className="panel administration">
      <div className="panel-heading">
        <h3>
          <Users size={18} />
          {tr("Administrasi perusahaan")}
        </h3>
      </div>
      <div className="admin-tabs">
        {[
          ["users", tr("Pengguna")],
          ["roles", tr("Peran")],
          ["teams", tr("Tim")],
          ["cost-centres", tr("Pusat biaya")],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "users" && (
        <>
          <div className="admin-company-identity">
            <b>{data.company.name}</b>
            <span>
              {tr("Corporate ID")}: <code>{data.company.corporate_id}</code>
            </span>
          </div>
          <form
            className="governance-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(
                String(new FormData(e.currentTarget).get("search") ?? ""),
              );
              setPage(1);
            }}
          >
            <label>
              {tr("Cari pengguna")}
              <input
                name="search"
                placeholder={tr("Nama, email, atau ID pegawai")}
                maxLength={100}
              />
            </label>
            <label>
              {tr("Baris per halaman")}
              <Select
                aria-label={tr("Baris pengguna per halaman")}
                value={String(limit)}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 30, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </label>
            <button className="secondary">{tr("Cari")}</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("Pengguna")}</th>
                  <th>{tr("ID pegawai / pekerjaan")}</th>
                  <th>{tr("Tim")}</th>
                  <th>{tr("Peran")}</th>
                  <th>{tr("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u: Row) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                      <small>{u.email}</small>
                    </td>
                    <td>
                      <b>{u.employee_id || "—"}</b>
                      <small>
                        {u.department} {u.job_title && `· ${u.job_title}`}
                      </small>
                      <small>{u.work_phone}</small>
                    </td>
                    <td>{u.team}</td>
                    <td>
                      {u.role}
                      <small>
                        {tr("Level")} {u.role_level}
                      </small>
                    </td>
                    <td>
                      <button
                        className="text-btn"
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            await request(`admin/users/${u.id}`, "PUT", {
                              active: !u.active,
                              teamId: u.team_id,
                              roleId: u.role_id,
                            });
                            await refresh();
                          }, tr("Akses pengguna diperbarui; sesi lama telah berakhir."))
                        }
                      >
                        {u.active
                          ? tr("Aktif \u00B7 nonaktifkan")
                          : tr("Nonaktif \u00B7 aktifkan")}
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => setEditing(u)}
                      >
                        {tr("Edit informasi")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="report-pagination">
            <button
              className="secondary"
              disabled={page === 1 || busy}
              onClick={() => setPage((p) => p - 1)}
            >
              {tr("Sebelumnya")}
            </button>
            <span>
              {tr("Halaman")} {page} · {data.userTotal} {tr("pengguna")}
            </span>
            <button
              className="secondary"
              disabled={busy || page * limit >= data.userTotal}
              onClick={() => setPage((p) => p + 1)}
            >
              {tr("Berikutnya")}
            </button>
          </div>
          {editing && (
            <form
              className="admin-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await perform(async () => {
                    await request(
                      `admin/users/${editing.id}/details`,
                      "PUT",
                      Object.fromEntries(f),
                    );
                    await refresh();
                    setEditing(null);
                  }, tr("Informasi pengguna diperbarui."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>{tr("Edit informasi pengguna")}</h3>
              <p>
                {tr("Corporate ID")}: {data.company.corporate_id}
              </p>
              <div className="form-grid">
                {field(
                  tr("Nama pengguna"),
                  <input
                    name="name"
                    defaultValue={editing.name}
                    required
                    minLength={2}
                    maxLength={100}
                  />,
                )}
                {field(
                  tr("Email pengguna"),
                  <input
                    name="email"
                    type="email"
                    defaultValue={editing.email}
                    required
                    maxLength={254}
                  />,
                )}
                {[
                  ["employeeId", "ID pegawai", editing.employee_id, 60],
                  ["department", "Departemen", editing.department, 100],
                  ["jobTitle", "Jabatan", editing.job_title, 100],
                  ["workPhone", "Telepon kerja", editing.work_phone, 40],
                ].map(([name, label, value, max]) =>
                  field(
                    tr(String(label)),
                    <input
                      key={String(name)}
                      name={String(name)}
                      defaultValue={String(value ?? "")}
                      maxLength={Number(max)}
                    />,
                  ),
                )}
              </div>
              <button className="primary" disabled={busy}>
                {tr("Simpan informasi")}
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setEditing(null)}
              >
                {tr("Batal")}
              </button>
            </form>
          )}
          <form
            className="admin-form"
            onSubmit={(e) =>
              void submit(e, "users", (f) => ({
                name: f.get("name"),
                email: f.get("email"),
                password: f.get("password"),
                teamId: f.get("team"),
                roleId: f.get("role"),
                employeeId: f.get("employeeId"),
                department: f.get("department"),
                jobTitle: f.get("jobTitle"),
                workPhone: f.get("workPhone"),
              }))
            }
          >
            <h3>{tr("Tambahkan pengguna")}</h3>
            <div className="form-grid">
              {field(
                tr("Nama"),
                <input
                  aria-label={tr("Nama pengguna")}
                  name="name"
                  required
                  minLength={2}
                />,
              )}
              {field(
                tr("Email"),
                <input
                  aria-label={tr("Email pengguna")}
                  name="email"
                  type="email"
                  required
                />,
              )}
              {field(
                tr("Kata sandi awal"),
                <input
                  aria-label={tr("Kata sandi awal")}
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                />,
              )}
              {field(
                tr("Tim"),
                <Select aria-label={tr("Tim pengguna")} name="team">
                  {data.teams.map((t: Row) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>,
              )}
              {field(
                tr("Peran"),
                <Select aria-label={tr("Peran pengguna")} name="role">
                  {data.roles.map((r: Row) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>,
              )}
            </div>
            <div className="form-grid">
              {[
                ["employeeId", "ID pegawai", 60],
                ["department", "Departemen", 100],
                ["jobTitle", "Jabatan", 100],
                ["workPhone", "Telepon kerja", 40],
              ].map(([name, label, max]) =>
                field(
                  tr(String(label)),
                  <input
                    key={String(name)}
                    name={String(name)}
                    maxLength={Number(max)}
                  />,
                ),
              )}
            </div>
            <button className="primary" disabled={busy}>
              <Plus size={16} />
              {tr("Tambah pengguna")}
            </button>
          </form>
        </>
      )}
      {tab === "roles" && (
        <div className="admin-form">
          <div className="role-list">
            {data.roles.map((r: Row) => (
              <div key={r.id}>
                <ShieldCheck size={18} />
                <b>{r.name}</b>
                <span>
                  {tr("Level")} {r.level}
                </span>
                <button className="text-btn" onClick={() => setEditingRole(r)}>
                  {tr("Edit peran")}
                </button>
                <small>
                  {r.company_scope
                    ? tr("Seluruh perusahaan")
                    : tr("Tim sendiri")}{" "}
                  · {r.permissions.length}
                  {tr(" izin")}
                </small>
              </div>
            ))}
          </div>
          {editingRole && (
            <form
              className="role-edit-form"
              onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  await perform(async () => {
                    await request(`admin/roles/${editingRole.id}`, "PUT", {
                      name: f.get("name"),
                      level: Number(f.get("level")),
                      companyScope: f.get("scope") === "company",
                      permissions: f.getAll("permissions"),
                    });
                    setEditingRole(null);
                    await refresh();
                  }, tr("Peran diperbarui."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3>{tr("Edit peran")}</h3>
              {field(
                tr("Nama peran"),
                <input
                  name="name"
                  defaultValue={editingRole.name}
                  required
                  minLength={2}
                  maxLength={100}
                />,
              )}
              {field(
                tr("Level peran"),
                <input
                  name="level"
                  type="number"
                  min={1}
                  max={99}
                  defaultValue={editingRole.level}
                  required
                />,
              )}
              {field(
                tr("Cakupan data"),
                <Select
                  name="scope"
                  defaultValue={editingRole.company_scope ? "company" : "team"}
                >
                  <option value="team">{tr("Tim sendiri")}</option>
                  <option value="company">{tr("Seluruh perusahaan")}</option>
                </Select>,
              )}
              <div className="permission-grid">
                {data.permissionCatalog.map((p: string) => (
                  <label key={p}>
                    <input
                      type="checkbox"
                      name="permissions"
                      value={p}
                      defaultChecked={editingRole.permissions.includes(p)}
                    />
                    {tr(permissionNames[p] ?? p)}
                  </label>
                ))}
              </div>
              <button className="primary" disabled={busy}>
                {tr("Simpan peran")}
              </button>
              <button
                type="button"
                className="text-btn"
                onClick={() => setEditingRole(null)}
              >
                {tr("Batal")}
              </button>
            </form>
          )}
          <form
            onSubmit={(e) =>
              void submit(e, "roles", (f) => ({
                name: f.get("name"),
                permissions: f.getAll("permissions"),
                companyScope: f.get("scope") === "company",
                level: Number(f.get("level")),
              }))
            }
          >
            <h3>{tr("Peran baru")}</h3>
            {field(
              tr("Level peran"),
              <input
                aria-label={tr("Level peran baru")}
                name="level"
                type="number"
                min={1}
                max={99}
                defaultValue={1}
                required
              />,
            )}
            <p className="hint">
              {tr(
                "Level adalah informasi organisasi. Hak akses dan tingkat persetujuan tetap ditentukan melalui izin dan kebijakan persetujuan.",
              )}
            </p>
            {field(
              tr("Nama peran"),
              <input
                aria-label={tr("Nama peran")}
                name="name"
                required
                minLength={2}
              />,
            )}
            {field(
              tr("Cakupan data"),
              <Select aria-label={tr("Cakupan data")} name="scope">
                <option value="team">{tr("Tim sendiri")}</option>
                <option value="company">{tr("Seluruh perusahaan")}</option>
              </Select>,
            )}
            <div className="permission-grid">
              {data.permissionCatalog.map((p: string) => (
                <label key={p}>
                  <input name="permissions" value={p} type="checkbox" />
                  {tr(permissionNames[p] ?? p)}
                </label>
              ))}
            </div>
            <button className="primary" disabled={busy}>
              {tr("Simpan peran")}
            </button>
          </form>
        </div>
      )}
      {tab === "teams" && (
        <div className="admin-form">
          <div className="role-list">
            {data.teams.map((t: Row) => (
              <div key={t.id}>
                <Users size={18} />
                {t.name}
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) =>
              void submit(e, "teams", (f) => ({ name: f.get("name") }))
            }
          >
            {field(
              tr("Nama tim baru"),
              <input
                aria-label={tr("Nama tim baru")}
                name="name"
                required
                minLength={2}
              />,
            )}
            <button className="primary" disabled={busy}>
              {tr("Tambah tim")}
            </button>
          </form>
        </div>
      )}
      {tab === "cost-centres" && (
        <div className="admin-form">
          <div className="role-list">
            {data.costCentres.map((c: Row) => (
              <div key={c.id}>
                {c.name}
                <small>
                  {data.teams.find((t: Row) => t.id === c.team_id)?.name}
                </small>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) =>
              void submit(e, "cost-centres", (f) => ({
                name: f.get("name"),
                teamId: f.get("team"),
              }))
            }
          >
            {field(
              tr("Nama pusat biaya"),
              <input
                aria-label={tr("Nama pusat biaya")}
                name="name"
                required
                minLength={2}
              />,
            )}
            {field(
              tr("Tim pemilik"),
              <Select aria-label={tr("Tim pusat biaya")} name="team">
                {data.teams.map((t: Row) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>,
            )}
            <button className="primary" disabled={busy}>
              {tr("Tambah pusat biaya")}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
