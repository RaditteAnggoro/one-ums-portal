import type { Locale } from "./i18n.js";
// Labels are keyed by stable server codes; translated labels never become data keys.
const labels: Record<string, [string, string]> = {
  DEPLOYED: ["Diterapkan", "Deployed"],
  DRAFT: ["Draf", "Draft"],
  PENDING_APPROVAL: ["Menunggu persetujuan", "Pending approval"],
  APPROVED: ["Disetujui", "Approved"],
  SCHEDULED: ["Terjadwal", "Scheduled"],
  REJECTED: ["Ditolak", "Rejected"],
  RETURNED: ["Perlu revisi", "Returned for revision"],
  QUEUED: ["Dalam antrean", "Queued"],
  RUNNING: ["Berjalan", "Running"],
  COMPLETED: ["Selesai", "Completed"],
  COMPLETED_WITH_ERRORS: ["Selesai · perlu perhatian", "Completed with issues"],
  BUDGET_HOLD: ["Anggaran tertahan", "Budget hold"],
  MISSED: ["Jadwal terlewat", "Missed"],
  DELIVERED: ["Terkirim ke penerima", "Delivered"],
  SENT: ["Dikirim penyedia", "Sent"],
  ACCEPTED: ["Diterima penyedia", "Accepted"],
  FAILED: ["Gagal", "Failed"],
  UNKNOWN: ["Belum terkonfirmasi", "Unconfirmed"],
  CANCELLED: ["Dibatalkan", "Cancelled"],
  PLANNED: ["Direncanakan", "Planned"],
  RESCHEDULED: ["Dijadwalkan ulang", "Rescheduled"],
  PAUSED: ["Dijeda", "Paused"],
  RECOVERY_HOLD: ["Menunggu keputusan pemulihan", "Recovery hold"],
  VALIDATION_HOLD: [
    "Perlu pemeriksaan konfigurasi",
    "Configuration review required",
  ],
  PREFLIGHT: ["Pemeriksaan awal", "Preflight"],
  SUPPRESSED: ["Tidak dikirim", "Suppressed"],
  SENDING: ["Sedang dikirim", "Sending"],
  DISPLAYED: ["Ditampilkan browser", "Displayed by browser"],
  SUBMITTING: ["Sedang diajukan", "Submitting"],
  PENDING: ["Dalam peninjauan", "Pending review"],
  DISABLED: ["Dinonaktifkan", "Disabled"],
  ROLLED_BACK: ["Dikembalikan ke versi sebelumnya", "Rolled back"],
  ACTIVE: ["Aktif", "Active"],
  INACTIVE: ["Nonaktif", "Inactive"],
  READ: ["Dibaca", "Read"],
  RECEIVED: ["Diterima", "Received"],
  RETRYING: ["Dicoba kembali", "Retrying"],
};
export const messageStatusCodes = [
  "QUEUED",
  "ACCEPTED",
  "SENT",
  "DELIVERED",
  "FAILED",
  "UNKNOWN",
  "CANCELLED",
  "SUPPRESSED",
] as const;
export function statusLabel(
  code: string,
  locale: Locale,
  context: "workflow" | "message" = "workflow",
) {
  const value =
    context === "message" && code === "FAILED"
      ? ["Gagal final", "Final failed"]
      : context === "message" && code === "DELIVERED"
        ? ["Tersampaikan", "Delivered"]
        : labels[code];
  return value?.[locale === "en" ? 1 : 0] ?? code;
}
