"use client";
import { useEffect, useState } from "react";
import { BellRing, BellOff, Smartphone, ShieldCheck } from "lucide-react";
import { t as tr, localeTag } from "./i18n";
type Row = Record<string, any>;
type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
export function PushSettings({
  request,
  profile,
}: {
  request: Api;
  profile: Row;
}) {
  const [config, setConfig] = useState<Row | null>(null),
    [devices, setDevices] = useState<Row[]>([]),
    [deliveries, setDeliveries] = useState<Row[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [supported, setSupported] = useState(false),
    [settings, setSettings] = useState({
      enabled: profile.pushEnabled === true,
      approval: profile.pushPreferences?.approval !== false,
      budget: profile.pushPreferences?.budget !== false,
      delivery: profile.pushPreferences?.delivery !== false,
    });
  const refresh = async () => {
    const [config, devices, deliveries] = await Promise.all([
      request("push/configuration"),
      request("push/subscriptions"),
      request("push/deliveries"),
    ]);
    setConfig(config);
    setDevices(devices);
    setDeliveries(deliveries);
  };
  useEffect(() => {
    setSupported(
      window.isSecureContext &&
        "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window,
    );
    refresh().catch((e) => setError(tr(e.message)));
  }, []);
  const perform = async (fn: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
      setNotice(tr(message));
    } catch (e) {
      setError(tr((e as Error).message));
    } finally {
      setBusy(false);
    }
  };
  const enable = () =>
    perform(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          tr(
            "Izin notifikasi belum diberikan. Ubah izin situs di browser untuk mencoba lagi.",
          ),
        );
      const registration = await navigator.serviceWorker.register(
        "/ums-sw.js",
        { scope: "/" },
      );
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const raw = atob(
          config!.publicKey.replace(/-/g, "+").replace(/_/g, "/"),
        );
        const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        });
      }
      await request("push/subscribe", "POST", subscription.toJSON());
      setSettings((s) => ({ ...s, enabled: true }));
    }, "Notifikasi perangkat diaktifkan.");
  return (
    <section className="panel push-settings">
      <div className="panel-heading">
        <div>
          <h3>
            <BellRing size={17} />
            {tr("Notifikasi perangkat")}
          </h3>
          <p>
            {tr(
              "Terima persetujuan, informasi anggaran, dan hasil eksekusi pada browser Anda.",
            )}
          </p>
        </div>
      </div>
      <div className="admin-form">
        {error && (
          <p role="alert" className="alert error">
            {tr(error)}
          </p>
        )}
        {notice && (
          <p role="status" className="info-strip">
            {tr(notice)}
          </p>
        )}
        {!supported ? (
          <div className="info-callout">
            <Smartphone size={20} />
            <p>
              {tr(
                "Perangkat memerlukan browser yang mendukung push dan koneksi aman. Baca panduan untuk petunjuk perangkat.",
              )}
            </p>
          </div>
        ) : !config?.enabled ? (
          <div className="info-callout">
            <ShieldCheck size={20} />
            <p>
              {tr("Administrator belum mengaktifkan notifikasi perangkat.")}
            </p>
          </div>
        ) : (
          <div className="push-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void enable()}
            >
              <BellRing size={16} />
              {tr("Aktifkan pada perangkat ini")}
            </button>
            <button
              className="secondary"
              disabled={busy || !devices.some((d) => d.active)}
              onClick={() =>
                void perform(
                  () => request("push/test", "POST", {}),
                  "Uji notifikasi masuk antrean. Status ditampilkan setelah dikonfirmasi browser.",
                )
              }
            >
              <Smartphone size={16} />
              {tr("Uji notifikasi")}
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void perform(
              () => request("push/preferences", "POST", settings),
              "Preferensi notifikasi disimpan.",
            );
          }}
        >
          <h4>{tr("Preferensi notifikasi")}</h4>
          {[
            ["enabled", "Aktifkan notifikasi perangkat"],
            ["approval", "Permintaan dan keputusan persetujuan"],
            ["budget", "Anggaran dan batas biaya"],
            ["delivery", "Penyelesaian eksekusi"],
          ].map(([key, label]) => (
            <label className="push-preference" key={key}>
              <input
                type="checkbox"
                checked={settings[key as keyof typeof settings]}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, [key]: e.target.checked }))
                }
              />
              <span>{tr(label)}</span>
            </label>
          ))}
          <button className="secondary" disabled={busy}>
            {tr("Simpan preferensi")}
          </button>
        </form>
        <h4>{tr("Perangkat terdaftar")}</h4>
        {devices.filter((d) => d.active).length === 0 ? (
          <p className="hint">{tr("Belum ada perangkat aktif.")}</p>
        ) : (
          <ul className="device-list">
            {devices
              .filter((d) => d.active)
              .map((d, index) => (
                <li key={d.id}>
                  <Smartphone size={16} />
                  <span>
                    {tr("Perangkat")} {index + 1}
                    <small>
                      {new Date(d.created_at).toLocaleString(localeTag())}
                    </small>
                  </span>
                  <button
                    className="text-btn"
                    disabled={busy}
                    onClick={() =>
                      void perform(async () => {
                        await request(
                          `push/subscriptions/${d.id}/revoke`,
                          "POST",
                          {},
                        );
                      }, "Notifikasi perangkat dinonaktifkan.")
                    }
                  >
                    <BellOff size={14} />
                    {tr("Nonaktifkan")}
                  </button>
                </li>
              ))}
          </ul>
        )}
        <details className="push-history">
          <summary>{tr("Riwayat pengiriman push")}</summary>
          <p className="hint">
            {tr(
              "Diterima layanan push belum berarti tampil pada perangkat. Status DISPLAYED berasal dari konfirmasi browser.",
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{tr("Status")}</th>
                  <th>{tr("Waktu")}</th>
                  <th>{tr("Hasil")}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {tr(
                        (
                          {
                            QUEUED: "Dalam antrean",
                            SENDING: "Sedang dikirim",
                            ACCEPTED: "Diterima layanan push",
                            DISPLAYED: "Ditampilkan browser",
                            FAILED: "Gagal",
                            UNKNOWN: "Belum terkonfirmasi",
                            CANCELLED: "Dibatalkan",
                          } as Record<string, string>
                        )[d.status] ?? d.status,
                      )}
                    </td>
                    <td>
                      {new Date(d.updated_at).toLocaleString(localeTag())}
                    </td>
                    <td>
                      {d.last_error ? tr("Perlu pemeriksaan") : tr("Tercatat")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
