import { describe, it, expect } from "vitest";
import {
  publicAddress,
  valueAt,
  fetchSourceJson,
} from "../apps/api/src/network.js";
import { sourceRows } from "../apps/api/src/sources.js";
describe("data-source boundaries", () => {
  it("rejects local/private/infrastructure addresses including mapped IPv6", () => {
    for (const address of [
      "127.0.0.1",
      "10.0.0.1",
      "192.168.1.2",
      "172.16.0.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "2001:db8::1",
    ])
      expect(publicAddress(address), address).toBe(false);
    expect(publicAddress("8.8.8.8")).toBe(true);
  });
  it("requires HTTPS without inline credentials before opening a connection", async () => {
    await expect(fetchSourceJson("http://example.com/data")).rejects.toThrow(
      "HTTPS",
    );
    await expect(
      fetchSourceJson("https://user:secret@example.com/data"),
    ).rejects.toThrow("HTTPS");
    await expect(
      fetchSourceJson("https://example.com/data", "DATABASE_URL"),
    ).rejects.toThrow("SOURCE_");
  });
  it("traverses only explicit data paths and validates rows as values", () => {
    expect(valueAt({ data: { items: [1] } }, "data.items")).toEqual([1]);
    expect(() => valueAt({}, "__proto__.polluted")).toThrow();
    expect(sourceRows([{ name: "demo", amount: 10, active: true }])).toEqual([
      { name: "demo", amount: "10", active: "true" },
    ]);
    expect(() => sourceRows([{ constructor: "bad" }])).toThrow();
  });
});
