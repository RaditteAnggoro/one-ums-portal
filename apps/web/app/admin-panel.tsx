"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Plus, Users, ShieldCheck } from "lucide-react";
type Row = Record<string, any>;
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export function AdminPanel({
  request,
  perform,
}: {
  request: Api;
  perform: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const [data, setData] = useState<Row | null>(null);
  const [tab, setTab] = useState("users");
  const [busy, setBusy] = useState(false);
  const refresh = async () => setData(await request("admin/workspace"));
  useEffect(() => {
    void perform(refresh, "Administrasi siap.");
  }, []);
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
      }, "Pengaturan perusahaan tersimpan.");
    } finally {
      setBusy(false);
    }
  };
  const field = (label: string, element: ReactNode) => (
    <label className="field">
      <span>{label}</span>
      {element}
    </label>
  );
  if (!data)
    return (
      <section className="panel settings-panel">
        <p>Memuat administrasi perusahaan…</p>
      </section>
    );
  return (
    <section className="panel administration">
      <div className="panel-heading">
        <h3>
          <Users size={18} />
          Administrasi perusahaan
        </h3>
      </div>
      <div className="admin-tabs">
        {[
          ["users", "Pengguna"],
          ["roles", "Peran"],
          ["teams", "Tim"],
          ["cost-centres", "Pusat biaya"],
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Tim</th>
                  <th>Peran</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u: Row) => (
                  <tr key={u.id}>
                    <td>
                      <b>{u.name}</b>
                      <small>{u.email}</small>
                    </td>
                    <td>{u.team}</td>
                    <td>{u.role}</td>
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
                          }, "Akses pengguna diperbarui; sesi lama telah berakhir.")
                        }
                      >
                        {u.active
                          ? "Aktif · nonaktifkan"
                          : "Nonaktif · aktifkan"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            className="admin-form"
            onSubmit={(e) =>
              void submit(e, "users", (f) => ({
                name: f.get("name"),
                email: f.get("email"),
                password: f.get("password"),
                teamId: f.get("team"),
                roleId: f.get("role"),
              }))
            }
          >
            <h3>Tambahkan pengguna</h3>
            <div className="form-grid">
              {field(
                "Nama",
                <input
                  aria-label="Nama pengguna"
                  name="name"
                  required
                  minLength={2}
                />,
              )}
              {field(
                "Email",
                <input
                  aria-label="Email pengguna"
                  name="email"
                  type="email"
                  required
                />,
              )}
              {field(
                "Kata sandi awal",
                <input
                  aria-label="Kata sandi awal"
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                />,
              )}
              {field(
                "Tim",
                <select aria-label="Tim pengguna" name="team">
                  {data.teams.map((t: Row) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>,
              )}
              {field(
                "Peran",
                <select aria-label="Peran pengguna" name="role">
                  {data.roles.map((r: Row) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>,
              )}
            </div>
            <button className="primary" disabled={busy}>
              <Plus size={16} />
              Tambah pengguna
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
                <small>
                  {r.company_scope ? "Seluruh perusahaan" : "Tim sendiri"} ·{" "}
                  {r.permissions.length} izin
                </small>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) =>
              void submit(e, "roles", (f) => ({
                name: f.get("name"),
                permissions: f.getAll("permissions"),
                companyScope: f.get("scope") === "company",
              }))
            }
          >
            <h3>Peran baru</h3>
            {field(
              "Nama peran",
              <input
                aria-label="Nama peran"
                name="name"
                required
                minLength={2}
              />,
            )}
            {field(
              "Cakupan data",
              <select aria-label="Cakupan data" name="scope">
                <option value="team">Tim sendiri</option>
                <option value="company">Seluruh perusahaan</option>
              </select>,
            )}
            <div className="permission-grid">
              {data.permissionCatalog.map((p: string) => (
                <label key={p}>
                  <input name="permissions" value={p} type="checkbox" />
                  {p}
                </label>
              ))}
            </div>
            <button className="primary" disabled={busy}>
              Simpan peran
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
              "Nama tim baru",
              <input
                aria-label="Nama tim baru"
                name="name"
                required
                minLength={2}
              />,
            )}
            <button className="primary" disabled={busy}>
              Tambah tim
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
              "Nama pusat biaya",
              <input
                aria-label="Nama pusat biaya"
                name="name"
                required
                minLength={2}
              />,
            )}
            {field(
              "Tim pemilik",
              <select aria-label="Tim pusat biaya" name="team">
                {data.teams.map((t: Row) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>,
            )}
            <button className="primary" disabled={busy}>
              Tambah pusat biaya
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
