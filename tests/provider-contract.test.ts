import { describe, it, expect } from "vitest";
import {
  genericContract,
  mapRequest,
} from "../packages/domain/src/provider-contract.js";
import { encryptSecret, decryptSecret } from "../apps/api/src/secrets.js";
describe("provider contract boundaries", () => {
  it("maps only declared JSON placeholders and preserves structured parameters", () => {
    expect(
      mapRequest(
        {
          to: "{{recipient}}",
          params: "{{parameters}}",
          body: "Hello {{body}}",
        },
        {
          recipient: "demo@example.test",
          parameters: ["one", "two"],
          body: "data",
        },
      ),
    ).toEqual({
      to: "demo@example.test",
      params: ["one", "two"],
      body: "Hello data",
    });
    expect(() => mapRequest({ value: "{{process}}" }, {})).toThrow(
      "Unsupported mapping",
    );
    expect(() => mapRequest(JSON.parse('{"__proto__":"bad"}'), {})).toThrow();
  });
  it("requires an explicit HTTPS destination and reserves transport headers", () => {
    const valid = {
      endpoint: "https://api.example.test/send",
      allowedHosts: ["api.example.test"],
      requestBody: { to: "{{recipient}}" },
    };
    expect(genericContract.parse(valid).auth).toBe("bearer");
    expect(() =>
      genericContract.parse({ ...valid, allowedHosts: ["different.test"] }),
    ).toThrow();
    expect(() =>
      genericContract.parse({ ...valid, headers: { Authorization: "secret" } }),
    ).toThrow();
    expect(() =>
      genericContract.parse({
        ...valid,
        endpoint: "http://api.example.test/send",
      }),
    ).toThrow();
  });
  it("encrypts credentials with fresh nonces and detects modification", () => {
    const value = { apiKey: "synthetic-test-secret" };
    const a = encryptSecret(value),
      b = encryptSecret(value);
    expect(a).not.toBe(b);
    expect(a).not.toContain(value.apiKey);
    expect(decryptSecret(a)).toEqual(value);
    const parts = a.split(".");
    const bytes = Buffer.from(parts[2], "base64url");
    bytes[0] ^= 1;
    parts[2] = bytes.toString("base64url");
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});
