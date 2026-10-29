import {
  statusLabel,
  messageStatusCodes,
} from "../packages/domain/src/status.js";
import ExcelJS from "exceljs";
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

it("round-trips XLSX conditional formatting through the patched uuid dependency", async () => {
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet("Contacts");
  sheet.addRow(["name", "email"]);
  sheet.addRow(["Synthetic", "test@example.test"]);
  sheet.addConditionalFormatting({
    ref: "A2:A2",
    rules: [
      {
        type: "dataBar",
        minLength: 0,
        maxLength: 100,
        gradient: true,
        showValue: true,
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: "FF7733CC" },
      },
    ],
  });
  const bytes = await workbook.xlsx.writeBuffer();
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(bytes);
  expect(read.getWorksheet("Contacts")!.getRow(2).getCell(1).value).toBe(
    "Synthetic",
  );
});

it("labels every supported message status in both languages from stable codes", () => {
  for (const code of messageStatusCodes) {
    expect(statusLabel(code, "en", "message")).not.toBe(code);
    expect(statusLabel(code, "id", "message")).not.toBe(code);
  }
  expect(statusLabel("FAILED", "en", "message")).toBe("Final failed");
  expect(statusLabel("FAILED", "id", "message")).toBe("Gagal final");
  expect(statusLabel("PENDING_APPROVAL", "en")).toBe("Pending approval");
  expect(statusLabel("RECOVERY_HOLD", "en")).toBe("Recovery hold");
});
