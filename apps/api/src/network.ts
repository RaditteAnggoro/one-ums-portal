import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import { BadRequestException } from "@nestjs/common";

export function publicAddress(address: string) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export async function fetchSourceJson(endpoint: string, secretEnv?: string) {
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  )
    throw new BadRequestException(
      "Gunakan HTTPS port standar tanpa kredensial di URL.",
    );
  if (secretEnv && !/^SOURCE_[A-Z0-9_]{1,64}$/.test(secretEnv))
    throw new BadRequestException(
      "Referensi rahasia harus menggunakan nama SOURCE_… pada server.",
    );
  const secret = secretEnv ? process.env[secretEnv] : undefined;
  if (secretEnv && !secret)
    throw new BadRequestException(
      "Rahasia koneksi belum tersedia pada server.",
    );
  let addresses;
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new BadRequestException("Alamat sumber tidak dapat ditemukan.");
  }
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new BadRequestException(
      "Alamat lokal, privat, atau infrastruktur tidak diizinkan.",
    );
  const pinned = addresses[0];
  return new Promise<unknown>((resolve, reject) => {
    // Connect to the validated IP and keep TLS verification against the original hostname. No redirects or DNS rebinding.
    const req = request(
      {
        hostname: pinned.address,
        family: pinned.family,
        servername: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        method: "GET",
        agent: false,
        headers: {
          Host: url.hostname,
          Accept: "application/json",
          ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(
            new BadRequestException(
              `Sumber mengembalikan HTTP ${response.statusCode}. Pengalihan tidak diikuti.`,
            ),
          );
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 2_000_000) {
            req.destroy();
            reject(
              new BadRequestException(
                "Respons sumber melebihi 2 MB. Gunakan sumber yang dipaginasi.",
              ),
            );
          } else chunks.push(chunk);
        });
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            reject(
              new BadRequestException(
                "Sumber tidak mengembalikan JSON yang valid.",
              ),
            );
          }
        });
        response.on("error", () =>
          reject(new BadRequestException("Pengambilan sumber terputus.")),
        );
      },
    );
    req.setTimeout(10000, () => req.destroy(new Error("timeout")));
    req.on("error", () =>
      reject(
        new BadRequestException(
          "Pengambilan sumber gagal atau melewati batas waktu.",
        ),
      ),
    );
    req.end();
  });
}
export function valueAt(data: unknown, path: string): unknown {
  let value = data;
  for (const key of path.split(".").filter(Boolean)) {
    if (
      ["__proto__", "prototype", "constructor"].includes(key) ||
      !value ||
      typeof value !== "object" ||
      !Object.hasOwn(value, key)
    )
      throw new BadRequestException("Jalur data sumber tidak ditemukan.");
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
