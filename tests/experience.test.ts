import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { translate } from "../packages/domain/src/i18n.js";
import { guideArticles } from "../packages/domain/src/manual.js";
import { validateServerEnvironment } from "../apps/api/src/config.js";
describe("bilingual experience and production guardrails", () => {
  it("translates messages without altering supplied names or identifiers", () => {
    expect(
      translate(
        "Kampanye Loan {{loan_no}} menunggu persetujuan tingkat pertama.",
        "en",
      ),
    ).toBe("Campaign Loan {{loan_no}} is awaiting first-level approval.");
    expect(translate("Detail pesan {0}", "en", { "0": "a-123" })).toBe(
      "Message details a-123",
    );
    expect(translate("Overview", "id")).toBe("Ringkasan");
    expect(translate(" Custom campaign name ", "en")).toBe(
      " Custom campaign name ",
    );
  });
  it("provides both languages for every manual entry", () => {
    expect(guideArticles.length).toBeGreaterThan(15);
    for (const article of guideArticles) {
      expect(article.idText.title).toBeTruthy();
      expect(article.enText.title).toBeTruthy();
      expect(article.idText.steps.length).toBeGreaterThan(0);
    }
  });
  it("refuses unsafe or incomplete production startup", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ENCRYPTION_KEY", "invalid");
    try {
      expect(() => validateServerEnvironment()).toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
describe("service worker authorization before display", () => {
  async function push(ok: boolean, url = "/workflows?campaign=123") {
    const handlers: Record<string, Function> = {};
    const display = vi.fn(async () => {});
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok,
        json: async () => ({
          title: "Approval",
          body: "Review",
          url,
          tag: "1",
        }),
      })
      .mockResolvedValue({ ok: true });
    const self = {
      location: { origin: "https://ums.example.test" },
      addEventListener: (name: string, fn: Function) => (handlers[name] = fn),
      registration: { showNotification: display },
    };
    runInNewContext(readFileSync("apps/web/public/ums-sw.js", "utf8"), {
      self,
      fetch,
      URL,
    });
    await new Promise<void>((resolve, reject) =>
      handlers.push({
        data: {
          json: () => ({
            id: "a".repeat(8) + "-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            token: "secret",
          }),
        },
        waitUntil: (p: Promise<void>) => p.then(resolve, reject),
      }),
    );
    return { display, fetch };
  }
  it("suppresses push after login/session authorization fails", async () => {
    const r = await push(false);
    expect(r.display).not.toHaveBeenCalled();
    expect(r.fetch).toHaveBeenCalledTimes(1);
  });
  it("acknowledges only after displaying an authorized notification", async () => {
    const r = await push(true);
    expect(r.display).toHaveBeenCalledTimes(1);
    expect(r.fetch).toHaveBeenCalledTimes(2);
    expect(r.fetch.mock.calls[1][0]).toMatch(/receipt$/);
  });
  it("blocks off-site navigation in notification data", async () => {
    const r = await push(true, "https://evil.example/");
    expect(r.display).not.toHaveBeenCalled();
  });
});
