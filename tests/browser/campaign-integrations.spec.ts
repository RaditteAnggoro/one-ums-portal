import { test, expect, type Page, type Locator } from "@playwright/test";
async function choose(field: Locator, value: string) {
  await field.click();
  await field
    .page()
    .locator('[role="option"]')
    .and(field.page().locator("[data-value=" + JSON.stringify(value) + "]"))
    .click();
}
const headers = {
  Origin: "http://127.0.0.1:3000",
  "X-Requested-With": "MessagingApp",
};
async function login(page: Page, role: string) {
  await page.goto("/");
  await expect(page.locator(".demo-accounts")).toBeVisible();
  await page
    .locator(".demo-accounts")
    .getByRole("button", { name: new RegExp("^" + role) })
    .click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    role + "@demo.local",
  );
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.locator(".ums-shell")).toBeVisible();
  if ((await page.locator("html").getAttribute("lang")) === "en") {
    await page.request.put("/api/profile/language", {
      headers,
      data: { locale: "id" },
    });
    await page.reload();
  }
}
test.afterEach(async ({ page }) => {
  await page.request
    .put("/api/profile/language", { headers, data: { locale: "id" } })
    .catch(() => {});
});
test("demo login exposes five roles and a second isolated demonstration company", async ({
  page,
}) => {
  await page.goto("/");
  const demo = page.locator(".demo-accounts");
  await expect(demo.getByRole("button")).toHaveCount(5);
  await choose(
    page.getByLabel("Perusahaan demo", { exact: true }),
    "other.local",
  );
  await demo.getByRole("button", { name: /^viewer/ }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "viewer@other.local",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".agents/artifacts/implementation/login-demo-mobile.png",
    fullPage: true,
  });
});
test("campaign derives 0/1/3 parameters from templates and accepts explicit email and Push recipients", async ({
  page,
}) => {
  await login(page, "creator");
  await page
    .getByRole("button", { name: "Buat kampanye", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const title = "Manual dynamic " + Date.now();
  await dialog.getByLabel("Nama kampanye", { exact: true }).fill(title);
  await choose(dialog.getByLabel("Mode penerima", { exact: true }), "manual");
  await dialog
    .getByText("Buat template untuk channel lain", { exact: true })
    .click();
  const stem = "Dynamic " + Date.now();
  async function make(suffix: string, body: string) {
    await dialog
      .getByLabel("Nama template baru", { exact: true })
      .fill(stem + suffix);
    await dialog.getByLabel("Isi template baru", { exact: true }).fill(body);
    await dialog
      .getByRole("button", { name: "Simpan dan pilih template", exact: true })
      .click();
    await expect(
      dialog
        .locator(".template-choices label")
        .filter({ hasText: stem + suffix }),
    ).toBeVisible();
  }
  await make(" three", "{{one}} / {{two}} / {{three}}");
  for (const v of ["one", "two", "three"])
    await expect(
      dialog.getByLabel("Parameter " + v, { exact: true }),
    ).toBeVisible();
  await make(" single", "{{code}}");
  await expect(
    dialog.getByLabel("Parameter code", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByLabel("Parameter one", { exact: true })).toHaveCount(
    0,
  );
  await make(" zero", "Static content");
  await expect(
    dialog.getByLabel("Parameter code", { exact: true }),
  ).toHaveCount(0);
  await dialog
    .locator(".template-choices label")
    .filter({ hasText: stem + " three" })
    .click();
  await dialog.getByLabel("Parameter one", { exact: true }).fill("Ada");
  await dialog.getByLabel("Parameter two", { exact: true }).fill("L-42");
  await dialog
    .getByLabel("Parameter three", { exact: true })
    .fill("2026-12-01");
  await dialog
    .getByLabel("Penerima Email", { exact: true })
    .fill("synthetic@example.test");
  await dialog
    .locator(".template-choices label")
    .filter({ hasText: "Demo · Push · 0 parameters" })
    .click();
  await dialog
    .getByLabel("Penerima Push notification", { exact: true })
    .fill("synthetic-device-alias");
  await expect(dialog.locator(".message-preview")).toContainText([
    "Ada / L-42 / 2026-12-01",
    "Your monthly statement is ready.",
  ]);
  await page.screenshot({
    path: ".agents/artifacts/implementation/campaign-dynamic.png",
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Ajukan persetujuan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: title, exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "synthetic@example.test",
  );
});
test("administrator manages a generic API integration, encrypted sender account and USD rate card", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/settings/providers");
  const panel = page.locator(".provider-panel");
  await panel
    .getByRole("button", { name: "Tambah provider", exact: true })
    .click();
  const name = "Generic browser " + Date.now();
  await panel.getByLabel("Nama provider", { exact: true }).fill(name);
  await choose(
    panel.getByLabel("Adapter penyedia", { exact: true }),
    "GENERIC_HTTP",
  );
  await panel
    .getByLabel("API endpoint", { exact: true })
    .fill("https://api.example.test/messages");
  await panel
    .getByLabel("Request headers (JSON)", { exact: true })
    .fill('{"X-API-Key":"{{credential.apiKey}}"}');
  await panel
    .getByLabel("Request body / template mapping (JSON)", { exact: true })
    .fill(
      '{"to":"{{recipient}}","text":"{{body}}","reference":"{{variables.loan_no}}"}',
    );
  await panel
    .getByText("Preview request dari template", { exact: true })
    .click();
  await panel
    .getByLabel("Parameter values (JSON)", { exact: true })
    .fill('{"loan_no":"L-42"}');
  await expect(panel.locator(".mapping-preview pre")).toContainText("L-42");
  await panel
    .getByRole("button", { name: "Simpan draf penyedia", exact: true })
    .click();
  const definition = panel.getByRole("row").filter({ hasText: name });
  await definition
    .getByRole("button", { name: "Validasi mapping", exact: true })
    .click();
  await expect(definition).toContainText("Konfigurasi tervalidasi");
  await definition
    .getByRole("button", { name: "Publikasikan", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Account & sender", exact: true })
    .click();
  await panel.getByRole("button", { name: "Tambah akun", exact: true }).click();
  await panel
    .getByLabel("Nama account provider", { exact: true })
    .fill(name + " account");
  await panel.getByLabel("Definisi akun", { exact: true }).click();
  await page.getByRole("option", { name: name + " · v1", exact: true }).click();
  await panel
    .getByLabel("Sender ID / alamat From", { exact: true })
    .fill("sender@example.test");
  await panel
    .getByLabel("API key provider", { exact: true })
    .fill("synthetic-never-send-key");
  await panel.getByLabel("replyTo", { exact: true }).fill("reply@example.test");
  await panel.getByRole("button", { name: "Simpan akun", exact: true }).click();
  await expect(
    panel.getByRole("row").filter({ hasText: name + " account" }),
  ).toContainText("Kredensial terenkripsi");
  await panel.getByRole("button", { name: "Rate cards", exact: true }).click();
  await panel
    .getByRole("button", { name: "Tambah tarif", exact: true })
    .click();
  await panel.getByLabel("Akun tarif", { exact: true }).click();
  await page
    .getByRole("option", { name: name + " account", exact: true })
    .click();
  await choose(panel.getByLabel("Currency", { exact: true }), "USD");
  await panel.getByLabel("Harga per unit", { exact: true }).fill("0.01");
  await panel.getByLabel("Kurs ke IDR", { exact: true }).fill("16000");
  await panel
    .getByLabel("Alasan perubahan tarif", { exact: true })
    .fill("Synthetic quoted contract");
  await panel
    .getByRole("button", { name: "Simpan tarif baru", exact: true })
    .click();
  await expect(
    panel.getByRole("row").filter({ hasText: name + " account" }),
  ).toContainText("USD");
  await page.screenshot({
    path: ".agents/artifacts/implementation/provider-currency.png",
    fullPage: true,
  });
});
