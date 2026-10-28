"use client";
import { Select } from "./components/select";
import { t as tr } from "./components/i18n";
import { useEffect, useState } from "react";
import { Database, Plus, RefreshCw, KeyRound, Copy } from "lucide-react";
type Row = Record<string, any>;
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export function SourcePanel({
  request,
  perform,
}: {
  request: Api;
  perform: (fn: () => Promise<unknown>, message?: string) => Promise<void>;
}) {
  const [sources, setSources] = useState<Row[]>([]);
  const [type, setType] = useState("INCOMING");
  const [show, setShow] = useState(false);
  const [key, setKey] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () => setSources(await request("sources"));
  useEffect(() => {
    void perform(refresh, tr("Koneksi data siap."));
  }, []);
  return (
    <section className="panel source-panel">
      <div className="panel-heading">
        <h3>
          <Database size={17} />
          {tr("Koneksi data otomatis")}
        </h3>
        <button className="secondary" onClick={() => setShow(!show)}>
          <Plus size={15} />
          {tr("Koneksi baru")}
        </button>
      </div>
      <p className="source-description">
        {tr(
          "Terima data dari aplikasi lain atau ambil data dari API. Setiap impor menjadi versi baru; persetujuan pengiriman tetap diperlukan.",
        )}
      </p>
      {sources.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr("Koneksi")}</th>
                <th>{tr("Jenis")}</th>
                <th>{tr("Versi data terakhir")}</th>
                <th>{tr("Tindakan")}</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b>{s.name}</b>
                  </td>
                  <td>
                    {s.type === "REST"
                      ? tr("Ambil dari API")
                      : tr("Terima dari aplikasi")}
                  </td>
                  <td>{s.last_data_version || tr("Belum ada")}</td>
                  <td>
                    {s.type === "REST" ? (
                      <button
                        className="text-btn"
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            setBusy(true);
                            try {
                              await request(
                                `sources/${s.id}/refresh`,
                                "POST",
                                {},
                              );
                              await refresh();
                            } finally {
                              setBusy(false);
                            }
                          }, tr("Versi data baru tersedia."))
                        }
                      >
                        <RefreshCw size={14} />
                        {tr("Ambil data")}
                      </button>
                    ) : (
                      <button
                        className="text-btn"
                        disabled={busy}
                        onClick={() =>
                          void perform(async () => {
                            setKey({
                              ...(await request(
                                `sources/${s.id}/keys`,
                                "POST",
                                {},
                              )),
                              sourceId: s.id,
                            });
                          }, tr("Kunci dibuat. Simpan dengan aman; hanya ditampilkan sekali."))
                        }
                      >
                        <KeyRound size={14} />
                        {tr("Buat kunci API")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {key && (
        <div className="key-card">
          <h3>{tr("Kunci koneksi baru")}</h3>
          <p>
            {tr(
              "Simpan sekarang. Kunci berlaku 90 hari, terbatas pada koneksi ini. Jangan masukkan ke kode atau repositori publik.",
            )}
          </p>
          <label className="field">
            <span>{tr("Kunci API (ditampilkan sekali)")}</span>
            <input
              aria-label={tr("Kunci API")}
              type="password"
              readOnly
              value={key.token}
            />
          </label>
          <button
            className="secondary"
            onClick={() => void navigator.clipboard.writeText(key.token)}
          >
            <Copy size={14} />
            {tr("Salin kunci")}
          </button>
          <p className="mono">
            {tr("POST ")}
            {typeof window !== "undefined" ? window.location.origin : ""}
            {key.endpoint}
          </p>
          <details>
            <summary>{tr("Petunjuk integrasi")}</summary>
            <p>
              {tr(
                "Gunakan Authorization: Bearer <kunci> dan Idempotency-Key berupa UUID unik per pengiriman. Ulangi UUID yang sama hanya untuk percobaan ulang data yang sama.",
              )}
            </p>
            <pre>
              {JSON.stringify(
                {
                  rows: [
                    {
                      customer_name: "Demo",
                      reference: "DEMO-001",
                      email: "demo@example.test",
                      phone: "081200000001",
                    },
                  ],
                },
                null,
                2,
              )}
            </pre>
          </details>
          <button
            className="text-btn"
            onClick={() =>
              void perform(async () => {
                await request(
                  `sources/${key.sourceId}/keys/${key.id}/revoke`,
                  "POST",
                  {},
                );
                setKey(null);
              }, tr("Kunci telah dicabut."))
            }
          >
            {tr("Cabut kunci ini")}
          </button>
        </div>
      )}
      {show && (
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            void perform(async () => {
              await request("sources", "POST", {
                name: f.get("name"),
                type,
                ...(type === "REST"
                  ? {
                      url: f.get("url"),
                      rowsPath: f.get("path") ?? "",
                      ...(f.get("secret")
                        ? { secretEnv: f.get("secret") }
                        : {}),
                    }
                  : {}),
              });
              form.reset();
              setShow(false);
              await refresh();
            }, tr("Koneksi tersimpan."));
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>{tr("Nama koneksi")}</span>
              <input
                aria-label={tr("Nama koneksi")}
                name="name"
                required
                minLength={3}
              />
            </label>
            <label className="field">
              <span>{tr("Cara menerima data")}</span>
              <Select
                aria-label={tr("Cara menerima data")}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="INCOMING">
                  {tr("Dikirim oleh aplikasi lain")}
                </option>
                <option value="REST">{tr("Ambil dari REST API")}</option>
              </Select>
            </label>
          </div>
          {type === "REST" && (
            <>
              <label className="field">
                <span>{tr("Alamat HTTPS API")}</span>
                <input
                  name="url"
                  aria-label={tr("Alamat HTTPS API")}
                  type="url"
                  required
                  placeholder={tr("https://api.example.com/contacts")}
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>{tr("Lokasi daftar di JSON (opsional)")}</span>
                  <input
                    name="path"
                    aria-label={tr("Lokasi daftar JSON")}
                    placeholder={tr("Contoh: data.contacts")}
                  />
                </label>
                <label className="field">
                  <span>{tr("Nama rahasia pada server (opsional)")}</span>
                  <input
                    name="secret"
                    aria-label={tr("Nama rahasia server")}
                    placeholder={tr("SOURCE_CONTACTS_TOKEN")}
                    pattern="SOURCE_[A-Z0-9_]+"
                  />
                </label>
              </div>
              <p className="hint">
                {tr(
                  "Minta administrator menyiapkan nilai rahasia pada server. Jangan masukkan token ke alamat API. Sumber harus publik melalui HTTPS; respons dibatasi 2 MB. Penjadwalan refresh dan pagination lanjutan menyusul.",
                )}
              </p>
            </>
          )}
          <button className="primary" disabled={busy}>
            {tr("Simpan koneksi")}
          </button>
        </form>
      )}
      {!sources.length && !show && (
        <div className="empty">
          <Database size={25} />
          <p>
            {tr(
              "Mulai dengan unggah file, lalu tambahkan koneksi saat dibutuhkan.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}
