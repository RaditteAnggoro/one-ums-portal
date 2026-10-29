import { test, expect } from "@playwright/test";
test("vendor console and cost-centre report keep totals across date filters", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("finance@demo.local");
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalDemo123!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.locator(".vendor-console")).toBeVisible();
  await expect(page.locator(".vendor-console tbody tr").first()).toBeVisible();
  await expect(page.locator(".vendor-console th").last()).toHaveText(
    "Rasio gagal",
  );
  await page.goto("/finance/usage");
  await expect(
    page.getByRole("columnheader", { name: "Pusat biaya", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Koneksi", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".report-pagination")).toBeVisible();
  await page.getByLabel("Tanggal mulai", { exact: true }).fill("2000-01-01");
  await page.getByLabel("Tanggal akhir", { exact: true }).fill("2000-01-02");
  await page
    .getByRole("button", { name: "Terapkan filter", exact: true })
    .click();
  await expect(page.locator(".finance-metrics").first()).toContainText("0");
  await expect(page.locator(".report-pagination")).toContainText(
    "0 kelompok biaya",
  );
  await page.screenshot({
    path: ".agents/artifacts/implementation/vendor-reporting.png",
    fullPage: true,
  });
});
