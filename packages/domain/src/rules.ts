import { Decimal } from "decimal.js";

export const channels = ["email", "sms", "whatsapp"] as const;
export type Channel = (typeof channels)[number];
export type DataRow = Record<string, string>;

export function variables(body: string): string[] {
  return [
    ...new Set(
      [...body.matchAll(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g)].map((m) => m[1]),
    ),
  ];
}

export function render(body: string, row: DataRow): string {
  return body.replace(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g, (_, key: string) => {
    if (!row[key]?.trim()) throw new Error(`Nilai ${key} wajib diisi.`);
    return row[key];
  });
}

export function destination(channel: Channel, value: string): string {
  const clean = value.trim();
  if (channel === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean))
      throw new Error("Alamat email tidak valid.");
    return clean.toLowerCase();
  }
  const number = clean.replace(/[\s()+-]/g, "").replace(/^0/, "62");
  if (!/^62\d{8,13}$/.test(number))
    throw new Error("Gunakan nomor Indonesia: 08… atau +62….");
  return `+${number}`;
}

// Demo tariffs are explicit simulation prices, not quotes from a real provider.
export const demoRates: Record<Channel, string> = {
  email: "10",
  sms: "350",
  whatsapp: "500",
};
export function estimate(
  channel: Channel,
  bodies: string[],
  rate = demoRates[channel],
): string {
  return bodies
    .reduce(
      (sum, body) =>
        sum.plus(new Decimal(rate).times(billableUnits(channel, body))),
      new Decimal(0),
    )
    .toFixed(4);
}
const basic=new Set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà");
const extension=new Set('^{}\\[~]|€\f');
export function billableUnits(channel: Channel, body: string): number {
  if (channel !== "sms") return 1;
  // GSM 03.38 default/extension alphabets; actual vendor billing must be verified by its adapter.
  // https://www.twilio.com/docs/glossary/what-is-gsm-7-character-encoding
  const symbols=[...body];const gsm=symbols.every(c=>basic.has(c)||extension.has(c));
  const weights=symbols.map(c=>gsm?(extension.has(c)?2:1):c.length);
  if(weights.reduce((sum,n)=>sum+n,0)<=(gsm?160:70))return 1;
  const capacity=gsm?153:67;let segments=1,used=0;
  for(const weight of weights){if(used+weight>capacity){segments++;used=0;}used+=weight;}
  return segments;
}

export function periodEnd(start: string, months: number): string {
  if (![1, 3, 6, 12].includes(months))
    throw new Error("Periode harus 1, 3, 6, atau 12 bulan.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start))
    throw new Error("Tanggal tidak valid.");
  const date = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(+date) || date.toISOString().slice(0, 10) !== start)
    throw new Error("Tanggal tidak valid.");
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString().slice(0, 10);
}

const progress: Record<string, number> = {
  QUEUED: 0,
  ACCEPTED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
};
export function advanceState(current: string, incoming: string): string {
  if (current === "READ" || current === "DELIVERED")
    return (progress[incoming] ?? -1) > progress[current] ? incoming : current;
  if (
    current === "CANCELLED" ||
    current === "SUPPRESSED" ||
    current === "FAILED"
  )
    return current;
  if (incoming === "FAILED" || incoming === "UNKNOWN") return incoming;
  return (progress[incoming] ?? -1) > (progress[current] ?? -1)
    ? incoming
    : current;
}
