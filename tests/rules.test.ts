import { describe, it, expect } from "vitest";
import {
  variables,
  render,
  destination,
  estimate,
  periodEnd,
  advanceState,
  billableUnits,
} from "../packages/domain/src/rules.js";
describe("template and cost rules", () => {
  it("keeps distinct 0/1/3 parameter sets and validates channel-specific destinations", () => {
    expect(variables("No values")).toEqual([]);
    expect(variables("{{loan}}")).toEqual(["loan"]);
    expect(variables("{{name}} {{loan}} {{date}} {{name}}")).toEqual([
      "name",
      "loan",
      "date",
    ]);
    expect(destination("slack", "C12345678")).toBe("C12345678");
    expect(destination("telegram", "-10012345678")).toBe("-10012345678");
    expect(destination("push", "opaque-device-token")).toBe(
      "opaque-device-token",
    );
    for (const [channel, value] of [
      ["slack", "marketing"],
      ["telegram", "display name"],
      ["push", "invalid token"],
    ])
      expect(() => destination(channel as any, value)).toThrow();
  });

  it("renders values as data without evaluating expressions", () => {
    expect(variables("Hi {{ name }} / {{name}} {{reference}}")).toEqual([
      "name",
      "reference",
    ]);
    expect(render("Hi {{name}}", { name: "<script>alert(1)</script>" })).toBe(
      "Hi <script>alert(1)</script>",
    );
    expect(() => render("{{missing}}", {})).toThrow("missing");
  });
  it("normalizes Indonesian phones and rejects ambiguous destinations", () => {
    expect(destination("sms", "0812-0000-0001")).toBe("+6281200000001");
    expect(destination("email", "USER@Example.test")).toBe("user@example.test");
    expect(() => destination("sms", "81200000001")).toThrow();
  });
  it("counts SMS segments and keeps monetary calculations exact", () => {
    expect(billableUnits("sms", "a".repeat(161))).toBe(2);
    expect(billableUnits("sms", "漢".repeat(71))).toBe(2);
    expect(billableUnits("sms", "€".repeat(71))).toBe(1);
    expect(billableUnits("sms", "€".repeat(153))).toBe(3);
    expect(billableUnits("sms", "`".repeat(71))).toBe(2);
    expect(billableUnits("sms", "😀".repeat(67))).toBe(3);
    expect(estimate("email", ["a", "b", "c"], "0.1")).toBe("0.3000");
  });
  it("uses exclusive calendar boundaries including month-end and leap years", () => {
    expect(periodEnd("2026-01-31", 1)).toBe("2026-02-28");
    expect(periodEnd("2024-02-29", 12)).toBe("2025-02-28");
    for (const months of [1, 3, 6, 12])
      expect(periodEnd("2026-01-01", months)).toMatch(/^202[67]-/);
    expect(() => periodEnd("2026-02-30", 1)).toThrow();
  });
  it("does not regress a delivery result when events arrive late", () => {
    expect(advanceState("DELIVERED", "SENT")).toBe("DELIVERED");
    expect(advanceState("DELIVERED", "FAILED")).toBe("DELIVERED");
    expect(advanceState("DELIVERED", "READ")).toBe("READ");
    expect(advanceState("UNKNOWN", "DELIVERED")).toBe("DELIVERED");
  });
});
