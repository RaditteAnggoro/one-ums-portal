"use client";
import { useId, useState } from "react";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { UMSBrand } from "./app-chrome";
import { Select } from "./select";
import { t as tr, useLanguage } from "./i18n";
// Structural reference: shadcn/ui login-01. Auth remains One UMS's own server flow.
export function LoginScreen({
  email,
  password,
  setEmail,
  setPassword,
  error,
  maintenanceInformation,
  busy,
  submit,
}: {
  email: string;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
  error: string;
  maintenanceInformation?: string;
  busy: boolean;
  submit: () => void;
}) {
  const { locale, setLocale } = useLanguage(),
    [visible, setVisible] = useState(false),
    id = useId();
  return (
    <main className="ums-login">
      <header className="login-header">
        <UMSBrand />
        <Select
          aria-label={tr("Bahasa")}
          value={locale}
          onChange={(e) => setLocale(e.target.value as "id" | "en")}
        >
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </Select>
      </header>
      <div className="login-center">
        <section className="login-panel" aria-labelledby={`${id}-title`}>
          <h1 id={`${id}-title`}>{tr("Masuk ke One UMS")}</h1>
          <p>
            {tr(
              "Gunakan email kerja yang terdaftar untuk mengakses perusahaan Anda.",
            )}
          </p>
          {error && (
            <div role="alert" className="alert error">
              {tr(error)}
            </div>
          )}
          {maintenanceInformation && (
            <p className="maintenance-information">{maintenanceInformation}</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label className="field" htmlFor={`${id}-email`}>
              <span>{tr("Email")}</span>
              <input
                id={`${id}-email`}
                type="email"
                required
                maxLength={254}
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </label>
            <label className="field" htmlFor={`${id}-password`}>
              <span>{tr("Kata sandi")}</span>
              <span className="password-input">
                <input
                  id={`${id}-password`}
                  type={visible ? "text" : "password"}
                  required
                  maxLength={256}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={tr(
                    visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi",
                  )}
                  aria-pressed={visible}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
            <button className="primary login-submit" disabled={busy}>
              {tr(busy ? "Memproses…" : "Masuk")}
              <ArrowRight size={16} />
            </button>
          </form>
          <p className="login-help">
            {tr("Belum memiliki akses? Hubungi admin perusahaan Anda.")}
          </p>
          {process.env.NEXT_PUBLIC_DEMO_ACCOUNTS === "true" && (
            <details className="demo-accounts">
              <summary>{tr("Akun demonstrasi")}</summary>
              {["creator", "approver", "finance", "admin"].map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => {
                    setEmail(`${role}@demo.local`);
                    setPassword("LocalDemo123!");
                  }}
                >
                  {role}
                </button>
              ))}
            </details>
          )}
        </section>
        <p className="login-footnote">One UMS · {tr("Akses perusahaan")}</p>
      </div>
    </main>
  );
}
