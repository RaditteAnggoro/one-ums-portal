"use client";
import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { t as tr } from "./i18n";
import { Select } from "./select";
type Row = Record<string, any>;
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export function CompanyPanel({ request }: { request: Api }) {
  const [companies, setCompanies] = useState<Row[]>([]),
    [show, setShow] = useState(false),
    [created, setCreated] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const refresh = () => request("platform/companies").then(setCompanies);
  useEffect(() => {
    refresh().catch((e) => setError(tr(e.message)));
  }, []);
  return (
    <>
      <div className="info-callout">
        <ShieldCheck size={20} />
        <p>
          {tr(
            "Admin platform mengatur onboarding perusahaan. Akses operasional tiap perusahaan tetap terpisah; admin perusahaan hanya mengelola perusahaannya sendiri.",
          )}
        </p>
      </div>
      {error && (
        <p role="alert" className="alert error">
          {tr(error)}
        </p>
      )}
      {created && (
        <section className="panel company-created">
          <CheckCircle2 size={24} />
          <div>
            <h3>{tr("Perusahaan berhasil dibuat")}</h3>
            <p>
              {created.name} · {created.owner.email}
            </p>
            <p>
              {tr(
                "Sampaikan kredensial awal melalui kanal aman. Admin perusahaan dapat masuk untuk menambahkan pengguna, alokasi anggaran, penyedia, template, dan sumber data.",
              )}
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label={tr("Tutup pesan")}
            onClick={() => setCreated(null)}
          >
            ×
          </button>
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>{tr("Perusahaan")}</h3>
            <p>{tr("Onboarding dan identitas perusahaan")}</p>
          </div>
          <button
            className="primary"
            onClick={() => {
              setShow(!show);
              setError("");
            }}
          >
            <Plus size={16} />
            {tr("Perusahaan baru")}
          </button>
        </div>
        {show && (
          <form
            className="admin-form company-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              setBusy(true);
              setError("");
              try {
                const result = await request(
                  "platform/companies",
                  "POST",
                  Object.fromEntries(
                    [...f].filter(
                      ([key, value]) =>
                        key !== "corporateId" || String(value).trim() !== "",
                    ),
                  ),
                );
                setCreated(result);
                setShow(false);
                form.reset();
                await refresh();
              } catch (e) {
                setError(tr((e as Error).message));
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>{tr("Identitas perusahaan")}</h3>
            <div className="form-grid">
              <label className="field">
                <span>{tr("Corporate ID")}</span>
                <input
                  name="corporateId"
                  minLength={3}
                  maxLength={60}
                  pattern="[A-Za-z0-9_-]+"
                  placeholder={tr("Otomatis jika dikosongkan")}
                />
              </label>
              <label className="field">
                <span>{tr("Nama perusahaan")}</span>
                <input name="name" required minLength={2} maxLength={120} />
              </label>
              <label className="field">
                <span>{tr("Zona waktu")}</span>
                <Select name="timezone" defaultValue="Asia/Jakarta">
                  <option value="Asia/Jakarta">WIB · Asia/Jakarta</option>
                  <option value="Asia/Makassar">WITA · Asia/Makassar</option>
                  <option value="Asia/Jayapura">WIT · Asia/Jayapura</option>
                  <option value="UTC">UTC</option>
                </Select>
              </label>
              <label className="field">
                <span>{tr("Nama tim awal")}</span>
                <input
                  name="teamName"
                  required
                  defaultValue="Operations"
                  minLength={2}
                />
              </label>
              <label className="field">
                <span>{tr("Nama pusat biaya")}</span>
                <input
                  name="costCentreName"
                  required
                  defaultValue="General"
                  minLength={2}
                />
              </label>
              <label className="field">
                <span>{tr("Bahasa awal")}</span>
                <Select name="language" defaultValue="id">
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </Select>
              </label>
            </div>
            <h3>{tr("Admin perusahaan pertama")}</h3>
            <div className="form-grid">
              <label className="field">
                <span>{tr("Nama admin")}</span>
                <input name="adminName" required minLength={2} />
              </label>
              <label className="field">
                <span>{tr("Email admin")}</span>
                <input
                  name="adminEmail"
                  type="email"
                  required
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>{tr("Kata sandi awal")}</span>
                <input
                  name="adminPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={256}
                />
                <small>
                  {tr(
                    "Minimal 12 karakter. Kata sandi tidak dicatat di audit log.",
                  )}
                </small>
              </label>
            </div>
            <div className="info-callout">
              <Building2 size={18} />
              <p>
                {tr(
                  "Sistem membuat tim, peran, dua tingkat persetujuan, pusat biaya, dan anggaran awal nol. Tambahkan pemberi persetujuan yang berbeda dari pembuat sebelum mengirim kampanye.",
                )}
              </p>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setShow(false)}
              >
                {tr("Batal")}
              </button>
              <button className="primary" disabled={busy}>
                {tr("Buat perusahaan")}
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        )}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Nama perusahaan")}</th>
                <th>{tr("Zona waktu")}</th>
                <th>{tr("Tim")}</th>
                <th>{tr("Pengguna")}</th>
                <th>{tr("Corporate ID")}</th>
                <th>{tr("Company ID")}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                  </td>
                  <td>{c.timezone}</td>
                  <td>{c.teams}</td>
                  <td>{c.users}</td>
                  <td className="mono">{c.corporate_id}</td>
                  <td className="mono">{c.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
