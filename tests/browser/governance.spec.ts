import { test, expect, type Page, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
const headers = {
  Origin: "http://127.0.0.1:3000",
  "X-Requested-With": "MessagingApp",
};
async function choose(locator: Locator, value: string) {
  await locator.click();
  await locator
    .page()
    .locator('[role="option"]')
    .and(locator.page().locator("[data-value=" + JSON.stringify(value) + "]"))
    .click();
}
async function signIn(page: Page, role = "admin", domain = "demo.local") {
  await page.goto("/");
  const logout = page.getByRole("button", { name: /^(Keluar|Sign out)$/ });
  await expect(
    logout.or(page.getByLabel("Email", { exact: true })),
  ).toBeVisible();
  if (await logout.isVisible()) await logout.click();
  const language = page.getByRole("combobox", { name: /^(Bahasa|Language)$/ });
  if ((await page.locator("html").getAttribute("lang")) === "en")
    await choose(language, "id");
  await page.getByLabel("Email", { exact: true }).fill(`${role}@${domain}`);
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalDemo123!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page.locator(".ums-shell")).toBeVisible();
  if ((await page.locator("html").getAttribute("lang")) === "en") {
    await page.request.put("/api/profile/language", {
      headers,
      data: { locale: "id" },
    });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
  }
}
test.afterEach(async ({ page }) => {
  await page.request
    .put("/api/profile/language", { headers, data: { locale: "id" } })
    .catch(() => {});
});

test("sidebar keeps its DOM and scroll position and supports saved pointer/keyboard resizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 680 });
  await signIn(page);
  const nav = page.locator(".ums-sidebar nav");
  await nav.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
    (window as any).__umsSidebar = node.parentElement;
  });
  const position = await nav.evaluate((n) => n.scrollTop);
  expect(position).toBeGreaterThan(0);
  await nav
    .getByRole("button", { name: "Riwayat perubahan", exact: true })
    .click();
  await expect(page).toHaveURL(/\/updates$/);
  expect(
    await page.evaluate(
      () =>
        document.querySelector(".ums-sidebar") === (window as any).__umsSidebar,
    ),
  ).toBe(true);
  expect(
    Math.abs((await nav.evaluate((n) => n.scrollTop)) - position),
  ).toBeLessThan(3);
  const separator = page.getByRole("separator", {
    name: "Ubah lebar navigasi",
    exact: true,
  });
  const previous = (await page.locator(".ums-sidebar").boundingBox())!.width;
  await separator.focus();
  await page.keyboard.press("ArrowRight");
  await expect(separator).toHaveAttribute(
    "aria-valuenow",
    String(previous + 16),
  );
  const bounds = (await separator.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, 200);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 352 - (previous + 16),
    200,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect(separator).toHaveAttribute("aria-valuenow", "352");
  await page.reload();
  await expect(separator).toHaveAttribute("aria-valuenow", "352");
  expect((await page.locator(".ums-sidebar").boundingBox())!.width).toBe(352);
  await page
    .getByRole("button", { name: "Ciutkan navigasi", exact: true })
    .click();
  expect((await page.locator(".ums-sidebar").boundingBox())!.width).toBe(68);
  await page
    .getByRole("button", { name: "Perluas navigasi", exact: true })
    .click();
  expect((await page.locator(".ums-sidebar").boundingBox())!.width).toBe(352);
  await separator.dblclick();
  await expect(separator).toHaveAttribute("aria-valuenow", "248");
  await page.screenshot({
    path: ".agents/artifacts/implementation/sidebar-governance.png",
    fullPage: true,
  });
});

test("message status badges and filter choices change completely to English", async ({
  page,
}) => {
  await signIn(page, "creator");
  await choose(page.getByLabel("Bahasa", { exact: true }), "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/messages?days=all&status=FAILED");
  await expect(
    page.locator(".operations-table tbody .badge").first(),
  ).toHaveText("Final failed");
  await page.getByLabel("Message status", { exact: true }).click();
  for (const label of ["Queued", "Delivered", "Final failed", "Unconfirmed"])
    await expect(
      page.getByRole("option", { name: label, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Gagal final", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: ".agents/artifacts/implementation/status-english.png",
    fullPage: true,
  });
});

test("admin registers release changes and appends deployment and rollback history", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/updates");
  await page
    .getByRole("button", { name: "Daftarkan perubahan", exact: true })
    .click();
  const title = `Release browser ${Date.now()}`;
  const form = page.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Registrasi perubahan",
      exact: true,
    }),
  });
  await form
    .getByLabel("Versi rilis", { exact: true })
    .fill("2.0." + Date.now());
  await form.getByLabel("Judul perubahan", { exact: true }).fill(title);
  await choose(form.getByLabel("Lingkungan", { exact: true }), "staging");
  await choose(form.getByLabel("Status", { exact: true }), "PLANNED");
  await form
    .getByLabel("Deskripsi", { exact: true })
    .fill("Fix sidebar navigation and keep company controls traceable.");
  await form.getByLabel("Tiket", { exact: true }).fill("UMS-100");
  await form
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  const card = page.locator(".release-card").filter({ hasText: title });
  await expect(card).toBeVisible();
  await expect(card.locator("header .badge")).toHaveText("Direncanakan");
  await card
    .getByRole("button", { name: "Catat sebagai diterapkan", exact: true })
    .click();
  await page
    .getByLabel("Alasan perubahan", { exact: true })
    .fill("Deployment verified");
  await page
    .getByRole("button", { name: "Simpan status", exact: true })
    .click();
  await expect(card.locator("header .badge")).toHaveText("Diterapkan");
  await card
    .getByRole("button", { name: "Catat rollback", exact: true })
    .click();
  await page
    .getByLabel("Alasan perubahan", { exact: true })
    .fill("Rollback for controlled verification");
  await page
    .getByRole("button", { name: "Simpan status", exact: true })
    .click();
  await expect(card.locator("header .badge")).toHaveText(
    "Dikembalikan ke versi sebelumnya",
  );
  await card.locator("summary").click();
  await expect(card.locator("details ol li")).toHaveCount(3);
  await page.screenshot({
    path: ".agents/artifacts/implementation/release-history.png",
    fullPage: true,
  });
  await signIn(page, "creator");
  await page.goto("/updates");
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Daftarkan perubahan", exact: true }),
  ).toHaveCount(0);
});

test("company maintenance blocks a standard session and login while other companies remain available", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.request.put("/api/governance/maintenance", {
    headers,
    data: {
      enabled: false,
      message: "",
      reason: "Prepare isolated browser check",
    },
  });
  const userContext = await browser.newContext(),
    otherContext = await browser.newContext();
  const user = await userContext.newPage(),
    other = await otherContext.newPage();
  try {
    await signIn(user, "creator");
    await signIn(other, "creator", "other.local");
    await page.goto("/settings/maintenance");
    await page
      .getByLabel("Informasi pemeliharaan", { exact: true })
      .fill("Browser verification maintenance");
    await page
      .getByLabel("Alasan perubahan", { exact: true })
      .fill("Verify tenant maintenance controls");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Aktifkan pemeliharaan", exact: true })
      .click();
    await expect(
      page.getByText("Pemeliharaan aktif", { exact: true }),
    ).toBeVisible();
    await expect(user.locator(".ums-shell")).not.toBeVisible({
      timeout: 10000,
    });
    await expect(user.locator(".login-panel [role=alert]")).toContainText(
      "pemeliharaan",
    );
    await expect(user.locator(".maintenance-information")).toContainText(
      "Browser verification maintenance",
    );
    await user.getByLabel("Email", { exact: true }).fill("creator@demo.local");
    await user.getByLabel("Kata sandi", { exact: true }).fill("LocalDemo123!");
    await user.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(user.locator(".login-panel [role=alert]")).toContainText(
      "pemeliharaan",
    );
    await other.reload();
    await expect(other.locator(".ums-shell")).toBeVisible();
    await page
      .getByLabel("Alasan perubahan", { exact: true })
      .fill("Verification finished");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Nonaktifkan pemeliharaan", exact: true })
      .click();
    await expect(
      page.getByText("Layanan aktif", { exact: true }),
    ).toBeVisible();
    await user.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(user.locator(".ums-shell")).toBeVisible();
  } finally {
    await page.request.put("/api/governance/maintenance", {
      headers,
      data: {
        enabled: false,
        message: "",
        reason: "Finish browser verification",
      },
    });
    await userContext.close();
    await otherContext.close();
  }
});

test("audit page uses server page sizes, menu filters and change details", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/audit");
  const table = page.locator(".audit-panel table");
  await expect(table.locator("tbody tr").first()).toBeVisible();
  for (const size of [10, 30, 50, 100]) {
    await choose(
      page.getByLabel("Baris per halaman", { exact: true }),
      String(size),
    );
    await expect(table.locator("tbody tr")).toHaveCount(size);
  }
  await choose(page.getByLabel("Baris per halaman", { exact: true }), "10");
  await expect(table.locator("tbody tr")).toHaveCount(10);
  const first = await table.locator("tbody tr").first().innerText();
  await page
    .locator(".audit-panel")
    .getByRole("button", { name: "Berikutnya", exact: true })
    .click();
  await expect(table.locator("tbody tr").first()).not.toHaveText(first);
  await choose(
    page.getByLabel("Menu / use case", { exact: true }),
    "authentication",
  );
  await choose(page.getByLabel("Jenis catatan", { exact: true }), "business");
  await page.getByLabel("Aksi spesifik", { exact: true }).fill("auth.login");
  await page
    .getByRole("button", { name: "Terapkan filter", exact: true })
    .click();
  await expect(
    table.locator("tbody tr").first().locator("td").nth(2).locator("code"),
  ).toHaveText("auth.login");
  await table.locator("summary").first().click();
  await expect(table.locator(".audit-detail").first()).toBeVisible();
  await page.screenshot({
    path: ".agents/artifacts/implementation/audit-filtered.png",
    fullPage: true,
  });
});

test("user work identity, corporate ID and explicit role levels are manageable", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/applications");
  const admin = page.locator(".administration");
  await expect(admin.locator(".admin-company-identity")).toContainText(
    "Corporate ID",
  );
  await admin.getByRole("button", { name: "Peran", exact: true }).click();
  const roleName = `Browser read role ${Date.now()}`;
  const roleForm = admin.locator("form").filter({
    has: page.getByRole("heading", { name: "Peran baru", exact: true }),
  });
  await roleForm.getByLabel("Nama peran", { exact: true }).fill(roleName);
  await roleForm.getByLabel("Tingkat peran baru", { exact: true }).fill("7");
  await roleForm
    .getByRole("checkbox", { name: "Lihat kampanye", exact: true })
    .check();
  await roleForm
    .getByRole("button", { name: "Simpan peran", exact: true })
    .click();
  await expect(admin.locator(".role-list")).toContainText(roleName);
  await admin.getByRole("button", { name: "Pengguna", exact: true }).click();
  const form = admin.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Tambahkan pengguna",
      exact: true,
    }),
  });
  const email = `browser-staff-${randomUUID()}@example.test`,
    employee = "EMP-" + Date.now();
  await form.getByLabel("Nama pengguna", { exact: true }).fill("Browser staff");
  await form.getByLabel("Email pengguna", { exact: true }).fill(email);
  await form
    .getByLabel("Kata sandi awal", { exact: true })
    .fill("SyntheticStaff123!");
  await form.getByLabel("ID pegawai", { exact: true }).fill(employee);
  await form.getByLabel("Departemen", { exact: true }).fill("Operations");
  await form.getByLabel("Jabatan", { exact: true }).fill("Analyst");
  await choose(
    form.getByLabel("Peran pengguna", { exact: true }),
    (await admin
      .locator(`option`)
      .filter({ hasText: roleName })
      .first()
      .getAttribute("value")) as string,
  );
  await form
    .getByRole("button", { name: "Tambah pengguna", exact: true })
    .click();
  await admin.getByLabel("Cari pengguna", { exact: true }).fill(email);
  await admin.getByRole("button", { name: "Cari", exact: true }).click();
  const row = admin.locator("tbody tr").filter({ hasText: email });
  await expect(row).toContainText(employee);
  await expect(row).toContainText("Tingkat 7");
  await row
    .getByRole("button", { name: "Edit informasi", exact: true })
    .click();
  const details = admin.locator("form").filter({
    has: page.getByRole("heading", {
      name: "Edit informasi pengguna",
      exact: true,
    }),
  });
  await details.getByLabel("Jabatan", { exact: true }).fill("Senior analyst");
  await details
    .getByRole("button", { name: "Simpan informasi", exact: true })
    .click();
  await expect(row).toContainText("Senior analyst");
});

test("restrained login has empty credentials and understated application provenance", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveValue("");
  await expect(page.locator(".login-visual")).toHaveCount(0);
  await expect(page.locator(".demo-accounts")).toBeVisible();
  await expect(page.locator('meta[name="author"]')).toHaveAttribute(
    "content",
    "Raditte Anggoro",
  );
  await expect(page.locator('meta[name="ums:provenance"]')).toHaveAttribute(
    "content",
    "RA.ONEUMS.2026.10",
  );
  await page.getByLabel("Kata sandi", { exact: true }).fill("DoNotSubmit123!");
  await page
    .getByRole("button", { name: "Tampilkan kata sandi", exact: true })
    .click();
  await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByRole("button", { name: "Sembunyikan kata sandi", exact: true })
    .click();
  await expect(page.getByLabel("Kata sandi", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.screenshot({
    path: ".agents/artifacts/implementation/login-restrained.png",
    fullPage: true,
  });
});
