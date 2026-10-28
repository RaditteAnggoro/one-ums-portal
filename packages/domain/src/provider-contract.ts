import { z } from "zod";
export const genericContract = z
  .object({
    endpoint: z.url().max(2000),
    allowedHosts: z.array(z.string().min(3).max(253)).min(1).max(10),
    auth: z.enum(["none", "bearer", "api-key"]).default("bearer"),
    apiKeyHeader: z
      .string()
      .regex(/^[A-Za-z0-9-]{1,60}$/)
      .default("X-API-Key"),
    headers: z
      .record(z.string().regex(/^[A-Za-z0-9-]{1,60}$/), z.string().max(500))
      .default({}),
    requestBody: z.record(z.string(), z.unknown()),
    messageIdPath: z
      .string()
      .regex(/^[\w.]+$/)
      .default("id"),
    timeoutMs: z.number().int().min(1000).max(30000).default(10000),
    requestsPerSecond: z.number().min(0.1).max(100).default(5),
    callback: z
      .object({
        signatureHeader: z
          .string()
          .regex(/^[A-Za-z0-9-]{1,60}$/)
          .default("X-Webhook-Signature"),
        messageIdPath: z.string().regex(/^[\w.]+$/),
        eventIdPath: z.string().regex(/^[\w.]+$/),
        statusPath: z.string().regex(/^[\w.]+$/),
        statusMap: z.record(
          z.string(),
          z.enum(["ACCEPTED", "SENT", "DELIVERED", "READ", "FAILED"]),
        ),
      })
      .optional(),
  })
  .superRefine((v, c) => {
    const url = new URL(v.endpoint);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      (url.port && url.port !== "443") ||
      !v.allowedHosts.includes(url.hostname)
    )
      c.addIssue({
        code: "custom",
        message:
          "Endpoint must be HTTPS on an explicitly allowed hostname, without embedded credentials.",
      });
    for (const key of Object.keys(v.headers))
      if (
        [
          "authorization",
          "cookie",
          "host",
          "content-length",
          "connection",
        ].includes(key.toLowerCase())
      )
        c.addIssue({
          code: "custom",
          message:
            "Use the credential fields for authentication; transport headers cannot be overridden.",
        });
  });
export type GenericContract = z.infer<typeof genericContract>;
const allowed = new Set([
  "recipient",
  "body",
  "channel",
  "message_id",
  "sender",
  "callback_url",
  "template_name",
  "template_language",
  "parameters",
]);
export function mapRequest(
  template: unknown,
  values: Record<string, unknown>,
  depth = 0,
): unknown {
  if (depth > 12) throw new Error("Request mapping is too deeply nested.");
  if (typeof template === "string") {
    const exact = template.match(/^\{\{(\w+)\}\}$/);
    if (exact) {
      if (!allowed.has(exact[1]))
        throw new Error(`Unsupported mapping: ${exact[1]}`);
      return values[exact[1]] ?? "";
    }
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      if (!allowed.has(key)) throw new Error(`Unsupported mapping: ${key}`);
      return String(values[key] ?? "");
    });
  }
  if (Array.isArray(template))
    return template.map((v) => mapRequest(v, values, depth + 1));
  if (template && typeof template === "object")
    return Object.fromEntries(
      Object.entries(template).map(([key, value]) => {
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw new Error("Invalid mapping key.");
        return [key, mapRequest(value, values, depth + 1)];
      }),
    );
  if (
    template === null ||
    typeof template === "number" ||
    typeof template === "boolean"
  )
    return template;
  throw new Error("Mapping values must be JSON values.");
}
