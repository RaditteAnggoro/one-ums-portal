"use client";
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
    void perform(refresh, "Koneksi data siap.");
  }, []);
  return (
    <section className="panel source-panel">
      <div className="panel-heading">
        <h3>
          <Database size={17} />
          Koneksi data otomatis
        </h3>
        <button className="secondary" onClick={() => setShow(!show)}>
          <Plus size={15} />
          Koneksi baru
        </button>
      </div>
      <p className="source-description">
        Terima data dari aplikasi lain atau ambil data dari API. Setiap impor
        menjadi versi baru; persetujuan pengiriman tetap diperlukan.
      </p>
      {sources.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Koneksi</th>
                <th>Jenis</th>
                <th>Versi data terakhir</th>
                <th>Tindakan</th>
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
                      ? "Ambil dari API"
                      : "Terima dari aplikasi"}
                  </td>
                  <td>{s.last_data_version || "Belum ada"}</td>
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
                          }, "Versi data baru tersedia.")
                        }
                      >
                        <RefreshCw size={14} />
                        Ambil data
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
                          }, "Kunci dibuat. Simpan dengan aman; hanya ditampilkan sekali.")
                        }
                      >
                        <KeyRound size={14} />
                        Buat kunci API
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
          <h3>Kunci koneksi baru</h3>
          <p>
            Simpan sekarang. Kunci berlaku 90 hari, terbatas pada koneksi ini.
            Jangan masukkan ke kode atau repositori publik.
          </p>
          <label className="field">
            <span>Kunci API (ditampilkan sekali)</span>
            <input
              aria-label="Kunci API"
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
            Salin kunci
          </button>
          <p className="mono">
            POST {typeof window !== "undefined" ? window.location.origin : ""}
            {key.endpoint}
          </p>
          <details>
            <summary>Petunjuk integrasi</summary>
            <p>
              Gunakan Authorization: Bearer &lt;kunci&gt; dan Idempotency-Key
              berupa UUID unik per pengiriman. Ulangi UUID yang sama hanya untuk
              percobaan ulang data yang sama.
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
              }, "Kunci telah dicabut.")
            }
          >
            Cabut kunci ini
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
            }, "Koneksi tersimpan.");
          }}
        >
          <div className="form-grid">
            <label className="field">
              <span>Nama koneksi</span>
              <input
                aria-label="Nama koneksi"
                name="name"
                required
                minLength={3}
              />
            </label>
            <label className="field">
              <span>Cara menerima data</span>
              <select
                aria-label="Cara menerima data"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="INCOMING">Dikirim oleh aplikasi lain</option>
                <option value="REST">Ambil dari REST API</option>
              </select>
            </label>
          </div>
          {type === "REST" && (
            <>
              <label className="field">
                <span>Alamat HTTPS API</span>
                <input
                  name="url"
                  aria-label="Alamat HTTPS API"
                  type="url"
                  required
                  placeholder="https://api.example.com/contacts"
                />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>Lokasi daftar di JSON (opsional)</span>
                  <input
                    name="path"
                    aria-label="Lokasi daftar JSON"
                    placeholder="Contoh: data.contacts"
                  />
                </label>
                <label className="field">
                  <span>Nama rahasia pada server (opsional)</span>
                  <input
                    name="secret"
                    aria-label="Nama rahasia server"
                    placeholder="SOURCE_CONTACTS_TOKEN"
                    pattern="SOURCE_[A-Z0-9_]+"
                  />
                </label>
              </div>
              <p className="hint">
                Minta administrator menyiapkan nilai rahasia pada server. Jangan
                masukkan token ke alamat API. Sumber harus publik melalui HTTPS;
                respons dibatasi 2 MB. Penjadwalan refresh dan pagination
                lanjutan menyusul.
              </p>
            </>
          )}
          <button className="primary" disabled={busy}>
            Simpan koneksi
          </button>
        </form>
      )}
      {!sources.length && !show && (
        <div className="empty">
          <Database size={25} />
          <p>
            Mulai dengan unggah file, lalu tambahkan koneksi saat dibutuhkan.
          </p>
        </div>
      )}
    </section>
  );
}
