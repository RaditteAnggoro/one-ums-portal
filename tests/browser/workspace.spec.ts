import { test, expect, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
test.afterEach(async ({ page }) => {
  await page.request
    .put("/api/profile/language", {
      headers: {
        Origin: "http://127.0.0.1:3000",
        "X-Requested-With": "MessagingApp",
      },
      data: { locale: "id" },
    })
    .catch(() => {});
});
async function selectOption(
  locator: Locator,
  option: string | { label: string },
) {
  if (await locator.evaluate((e) => e.tagName === "SELECT")) {
    await locator.selectOption(option);
    return;
  }
  await locator.click();
  const page = locator.page();
  const target =
    typeof option === "string"
      ? page
          .locator('[role="option"]')
          .filter({ visible: true })
          .and(page.locator("[data-value=" + JSON.stringify(option) + "]"))
      : page.getByRole("option", { name: option.label, exact: true });
  await target.click();
}
async function login(page: Page, role: string) {
  await page.goto("/");
  await expect(
    page
      .getByRole("button", { name: "Keluar", exact: true })
      .or(page.getByLabel("Email", { exact: true })),
  ).toBeVisible();
  if (
    await page.getByRole("button", { name: "Keluar", exact: true }).isVisible()
  )
    await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill(`${role}@demo.local`);
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalDemo123!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: new RegExp(
        `^(Profil|Profile) ${role[0].toUpperCase() + role.slice(1)}`,
      ),
    }),
  ).toBeVisible();
  if ((await page.locator("html").getAttribute("lang")) === "en") {
    await page.request.put("/api/profile/language", {
      headers: {
        Origin: "http://127.0.0.1:3000",
        "X-Requested-With": "MessagingApp",
      },
      data: { locale: "id" },
    });
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
  }
}
test("creator to two approvers to local message timeline", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page, "creator");
  await page
    .getByRole("button", { name: "Buat kampanye", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const name = `Demo browser ${Date.now()}`;
  await dialog.getByLabel("Nama kampanye", { exact: true }).fill(name);
  await selectOption(dialog.getByLabel("Sumber data", { exact: true }), {
    label: "Kontak contoh (data sintetis) · 3 baris",
  });
  await dialog
    .locator(".template-choices label")
    .filter({ hasText: "Pengingat email" })
    .first()
    .click();
  await expect(dialog.getByText(/Halo Ayu Demo/)).toBeVisible();
  await dialog
    .getByRole("button", { name: "Ajukan persetujuan", exact: true })
    .click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  for (const role of ["approver", "finance"]) {
    await login(page, role);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Persetujuan/ })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Simpan keputusan", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Keputusan tersimpan");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Tutup", exact: true })
      .click();
  }
  await login(page, "creator");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kampanye", exact: true })
    .click();
  await page.getByRole("button", { name, exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Terkirim ke penerima", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("dialog").getByText("Gagal", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Belum terkonfirmasi", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tutup", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Ringkasan", exact: true })
    .click();
  await page.screenshot({
    path: ".agents/artifacts/implementation/preview.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("small screen navigation and persisted dashboard choice", async ({
  page,
}) => {
  await login(page, "creator");
  await page.getByRole("button", { name: "Atur tampilan" }).click();
  await page.getByRole("dialog").getByLabel("Aktivitas tim").uncheck();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Simpan tampilan" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Aktivitas tim", exact: true }),
  ).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kampanye", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kampanye", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: ".agents/artifacts/implementation/mobile-preview.png",
    fullPage: true,
  });
});
test("admin creates a team and an incoming source produces a new dataset", async ({
  page,
}) => {
  await login(page, "admin");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Pengaturan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Administrasi perusahaan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tim", exact: true }).click();
  const team = `Tim browser ${Date.now()}`;
  await page.getByLabel("Nama tim baru", { exact: true }).fill(team);
  await page.getByRole("button", { name: "Tambah tim", exact: true }).click();
  await expect(page.getByText(team, { exact: true })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Sumber data", exact: true })
    .click();
  await page.getByRole("button", { name: "Koneksi baru", exact: true }).click();
  const name = `Incoming browser ${Date.now()}`;
  await page.getByLabel("Nama koneksi", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Simpan koneksi", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: name });
  await row
    .getByRole("button", { name: "Buat kunci API", exact: true })
    .click();
  const token = await page
    .getByLabel("Kunci API", { exact: true })
    .inputValue();
  const endpoint = await page.locator(".key-card .mono").innerText();
  const path = endpoint.replace(/^POST\s+/, "");
  const response = await page.request.post(path, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": randomUUID(),
    },
    data: {
      rows: [
        {
          customer_name: "API Browser Demo",
          reference: "API-001",
          email: "browser@example.test",
        },
      ],
    },
  });
  expect(response.status()).toBe(201);
  await expect(page.getByText(`${name} · v1`, { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page
    .getByRole("button", { name: "Cabut kunci ini", exact: true })
    .click();
  await expect(page.getByLabel("Kunci API", { exact: true })).not.toBeVisible();
});
test("scheduled campaign can be paused, resumed, and cancelled with reasons", async ({
  page,
}) => {
  await login(page, "creator");
  await page
    .getByRole("button", { name: "Buat kampanye", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const name = `Scheduled controls ${Date.now()}`;
  await dialog.getByLabel("Nama kampanye", { exact: true }).fill(name);
  await selectOption(dialog.getByLabel("Sumber data", { exact: true }), {
    label: "Kontak contoh (data sintetis) · 3 baris",
  });
  await dialog
    .locator(".template-choices label")
    .filter({ hasText: "Pengingat email" })
    .first()
    .click();
  await selectOption(dialog.getByLabel("Pengiriman", { exact: true }), "once");
  const future = new Date(Date.now() + 3600000)
    .toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" })
    .replace(" ", "T")
    .slice(0, 16);
  await dialog
    .getByLabel("Mulai (sesuai zona waktu kampanye)", { exact: true })
    .fill(future);
  await dialog
    .getByRole("button", { name: "Ajukan persetujuan", exact: true })
    .click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  for (const role of ["approver", "finance"]) {
    await login(page, role);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Persetujuan/ })
      .click();
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Simpan keputusan", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Keputusan tersimpan");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Tutup", exact: true })
      .click();
  }
  await login(page, "creator");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kampanye", exact: true })
    .click();
  for (const [button, confirm, status] of [
    ["Jeda kampanye", "Konfirmasi jeda", "Dijeda"],
    ["Lanjutkan kampanye", "Konfirmasi lanjutkan", "Terjadwal"],
    ["Hentikan kampanye", "Konfirmasi hentikan", "Dibatalkan"],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: button, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByLabel("Alasan tindakan", { exact: true })
      .fill("Synthetic browser workflow decision");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: confirm, exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: name })
        .getByText(status, { exact: true }),
    ).toBeVisible();
  }
});
test("admin configures a multichannel simulator and encrypted account without code changes", async ({
  page,
}) => {
  await login(page, "admin");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Vendor & integrasi", exact: true })
    .click();
  const panel = page.locator(".provider-panel");
  await panel
    .getByRole("button", { name: "Tambah provider", exact: true })
    .click();
  const name = `Provider browser ${Date.now()}`;
  await panel.getByLabel("Nama provider", { exact: true }).fill(name);
  await panel
    .getByRole("button", { name: "Simpan draf penyedia", exact: true })
    .click();
  const row = panel.getByRole("row").filter({ hasText: name });
  await row
    .getByRole("button", { name: "Validasi mapping", exact: true })
    .click();
  await expect(
    row.getByText("Konfigurasi tervalidasi", { exact: true }),
  ).toBeVisible();
  await row.getByRole("button", { name: "Publikasikan", exact: true }).click();
  await expect(row.getByText("Dipublikasikan", { exact: true })).toBeVisible();
  await panel
    .getByRole("button", { name: "Account & sender", exact: true })
    .click();
  await panel.getByRole("button", { name: "Tambah akun", exact: true }).click();
  const account = `Account browser ${Date.now()}`;
  await panel
    .getByLabel("Nama account provider", { exact: true })
    .fill(account);
  await selectOption(panel.getByLabel("Definisi akun", { exact: true }), {
    label: `${name} · v1`,
  });
  await panel
    .getByLabel("Sender ID / alamat From", { exact: true })
    .fill("Browser Demo");
  await panel
    .getByLabel("API key provider", { exact: true })
    .fill("synthetic-browser-key");
  await panel.getByLabel("Tarif awal email (IDR)", { exact: true }).fill("25");
  await panel.getByRole("button", { name: "Simpan akun", exact: true }).click();
  await expect(
    panel
      .getByRole("row")
      .filter({ hasText: account })
      .getByText("Kredensial terenkripsi", { exact: true }),
  ).toBeVisible();
});
test("widget order and width persist, ledger is visible to finance, viewer costs stay hidden", async ({
  page,
}) => {
  await login(page, "creator");
  await page
    .getByRole("button", { name: "Atur tampilan", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Hasil pengiriman", { exact: true }).check();
  const up = dialog.getByRole("button", {
    name: "Naikkan delivery",
    exact: true,
  });
  if (await up.isDisabled())
    await dialog
      .getByRole("button", { name: "Turunkan delivery", exact: true })
      .click();
  while (await up.isEnabled()) await up.click();
  await selectOption(
    dialog.getByLabel("Lebar delivery", { exact: true }),
    "full",
  );
  await dialog
    .getByRole("button", { name: "Simpan tampilan", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".dashboard-grid>section").first()).toHaveClass(
    /widget-delivery/,
  );
  await expect(page.locator(".widget-delivery")).toHaveAttribute(
    "style",
    /grid-column: 1 \/ -1/,
  );
  const updated = page.waitForResponse(
    (r) => r.url().endsWith("/api/dashboard") && r.request().method() === "PUT",
  );
  await selectOption(
    page.getByLabel("Filter kanal dashboard", { exact: true }),
    "sms",
  );
  await updated;
  await page.reload();
  await expect(
    page.getByLabel("Filter kanal dashboard", { exact: true }),
  ).toHaveAttribute("data-value", "sms");
  const restored = page.waitForResponse(
    (r) => r.url().endsWith("/api/dashboard") && r.request().method() === "PUT",
  );
  await selectOption(
    page.getByLabel("Filter kanal dashboard", { exact: true }),
    "all",
  );
  await restored;
  await login(page, "finance");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Alokasi biaya", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Riwayat alokasi dan biaya", exact: true })
    .first()
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("columnheader", { name: "Jenis", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Unduh CSV", exact: true }),
  ).toHaveAttribute("href", /ledger\.csv/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Tutup", exact: true })
    .click();
  await login(page, "viewer");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Alokasi biaya", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kampanye", exact: true })
    .click();
  await page.locator(".campaign-name").first().click();
  await expect(
    page.getByRole("dialog").getByText(/Batas disetujui/),
  ).not.toBeVisible();
});
test("returned campaign can be revised and resubmitted with preserved decisions", async ({
  page,
}) => {
  await login(page, "creator");
  await page
    .getByRole("button", { name: "Buat kampanye", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const name = `Revision browser ${Date.now()}`;
  await dialog.getByLabel("Nama kampanye", { exact: true }).fill(name);
  await selectOption(dialog.getByLabel("Sumber data", { exact: true }), {
    label: "Kontak contoh (data sintetis) · 3 baris",
  });
  await dialog
    .locator(".template-choices label")
    .filter({ hasText: "Pengingat email" })
    .first()
    .click();
  await selectOption(dialog.getByLabel("Pengiriman", { exact: true }), "once");
  await dialog
    .getByLabel("Mulai (sesuai zona waktu kampanye)", { exact: true })
    .fill(
      new Date(Date.now() + 7200000)
        .toLocaleString("sv-SE", { timeZone: "Asia/Jakarta" })
        .replace(" ", "T")
        .slice(0, 16),
    );
  await dialog
    .getByRole("button", { name: "Ajukan persetujuan", exact: true })
    .click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await login(page, "approver");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Persetujuan/ })
    .click();
  await page.getByRole("button", { name, exact: true }).click();
  await selectOption(
    page.getByRole("dialog").getByLabel("Keputusan", { exact: true }),
    "RETURN",
  );
  await page
    .getByRole("dialog")
    .getByLabel("Catatan (wajib untuk penolakan / pengembalian)", {
      exact: true,
    })
    .fill("Revise campaign title for demonstration");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Simpan keputusan", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Keputusan tersimpan");
  await login(page, "creator");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kampanye", exact: true })
    .click();
  await page.getByRole("button", { name, exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Revisi kampanye", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Nama kampanye", { exact: true }),
  ).toHaveValue(name);
  await expect(
    page.getByRole("dialog").getByText(/Halo Ayu Demo/),
  ).toBeVisible();
  const revised = `${name} v2`;
  await page
    .getByRole("dialog")
    .getByLabel("Nama kampanye", { exact: true })
    .fill(revised);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ajukan persetujuan", exact: true })
    .click();
  await expect(page.getByText(revised, { exact: true })).toBeVisible();
  for (const role of ["approver", "finance"]) {
    await login(page, role);
    await page
      .getByRole("navigation")
      .getByRole("button", { name: /Persetujuan/ })
      .click();
    await page.getByRole("button", { name: revised, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Simpan keputusan", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Keputusan tersimpan");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Tutup", exact: true })
      .click();
  }
  await login(page, "creator");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Kampanye", exact: true })
    .click();
  await page.getByRole("button", { name: revised, exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Terjadwal", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .locator("summary")
    .filter({ hasText: "Riwayat keputusan semua versi" })
    .click();
  await expect(
    page.getByRole("dialog").getByText("RETURN", { exact: true }),
  ).toBeVisible();
});
test("session expiry clears private dialogs before switching company", async ({
  page,
}) => {
  await login(page, "creator");
  await page
    .getByRole("button", { name: "Buat kampanye", exact: true })
    .click();
  const privateName = `Private session ${Date.now()}`;
  await page
    .getByRole("dialog")
    .getByLabel("Nama kampanye", { exact: true })
    .fill(privateName);
  // Expire the session while a form contains data belonging to the first company.
  const expired = await page.request.post("/api/auth/logout", {
    headers: {
      Origin: "http://127.0.0.1:3000",
      "X-Requested-With": "MessagingApp",
    },
    data: {},
  });
  expect(expired.ok()).toBeTruthy();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible({
    timeout: 12000,
  });
  await page.getByLabel("Email", { exact: true }).fill("creator@other.local");
  await page.getByLabel("Kata sandi", { exact: true }).fill("LocalDemo123!");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Keluar", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Buat kampanye", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Nama kampanye", { exact: true }),
  ).toHaveValue("");
});

test("UMS shell persists collapsed navigation and light/dark themes with readable text", async ({
  page,
}) => {
  await login(page, "creator");
  await expect(page.locator(".metrics-row").first()).toBeVisible();
  await expect(
    page.locator(".metric-label").filter({ hasText: "Permintaan pesan" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".agents/artifacts/implementation/ums-dashboard-light.png",
    fullPage: true,
  });
  const auditContrast = () =>
    page.evaluate(() => {
      const context = document.createElement("canvas").getContext("2d")!;
      const rgb = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const luminance = (v: number[]) =>
        v
          .map((c) => {
            const s = c / 255;
            return s <= 0.04045
              ? s / 12.92
              : Math.pow((s + 0.055) / 1.055, 2.4);
          })
          .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
      return [
        ...document.querySelectorAll<HTMLElement>(
          ".metric-label,.environment-indicator,.badge,.nav-label,.donut strong,th,.subtle",
        ),
      ]
        .filter(
          (e) =>
            e.getBoundingClientRect().width && e.getBoundingClientRect().height,
        )
        .map((e) => {
          let background: HTMLElement | null = e,
            color = "";
          while (background) {
            color = getComputedStyle(background).backgroundColor;
            if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") break;
            background = background.parentElement;
          }
          const foreground = luminance(rgb(getComputedStyle(e).color)),
            back = luminance(rgb(color));
          return {
            text: e.textContent?.trim(),
            ratio:
              (Math.max(foreground, back) + 0.05) /
              (Math.min(foreground, back) + 0.05),
          };
        })
        .filter((p) => p.ratio < 4.5);
    });
  expect(await auditContrast()).toEqual([]);
  await selectOption(page.getByLabel("Tema", { exact: true }), "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".insight-card").first()).toHaveCSS(
    "background-color",
    "rgb(32, 29, 39)",
  );
  expect(await auditContrast()).toEqual([]);
  await page.screenshot({
    path: ".agents/artifacts/implementation/ums-dashboard-dark.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Ciutkan navigasi", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".ums-shell")).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    Math.round((await page.locator(".ums-sidebar").boundingBox())!.width),
  ).toBe(68);
  await page
    .getByRole("button", { name: "Perluas navigasi", exact: true })
    .click();
  await selectOption(page.getByLabel("Tema", { exact: true }), "system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
test("Message Explorer filters, pages, and investigates messages without losing context", async ({
  page,
}) => {
  await login(page, "creator");
  await page.goto("/messages?days=all");
  await expect(
    page.locator(".operations-table tbody tr").first(),
  ).toBeVisible();
  const first = await page
    .locator(".operations-table .id-link")
    .first()
    .innerText();
  await page.getByRole("button", { name: "Berikutnya", exact: true }).click();
  await expect(page.getByText(/Halaman 2/)).toBeVisible();
  await expect(
    page.locator(".operations-table .id-link").first(),
  ).not.toHaveText(first);
  await page.getByRole("button", { name: "Sebelumnya", exact: true }).click();
  await expect(page.getByText(/Halaman 1/)).toBeVisible();
  await selectOption(
    page.getByLabel("Status pesan", { exact: true }),
    "FAILED",
  );
  await expect(
    page.locator(".operations-table tbody .badge").first(),
  ).toHaveText("Gagal final");
  await page.locator(".operations-table .id-link").first().click();
  const drawer = page.getByRole("dialog", {
    name: "Detail pesan",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Penerima", { exact: true })).toBeVisible();
  await drawer.getByRole("tab", { name: "Linimasa", exact: true }).click();
  await expect(drawer.locator(".delivery-timeline li").first()).toBeVisible();
  await drawer
    .getByRole("tab", { name: "Percobaan & galat", exact: true })
    .click();
  await expect(
    drawer.getByText("Manual retry belum tersedia.", { exact: false }),
  ).toBeVisible();
  await drawer
    .getByRole("tab", { name: "Payload & audit", exact: true })
    .click();
  await expect(drawer.locator(".payload-preview")).not.toBeVisible();
  await page.screenshot({
    path: ".agents/artifacts/implementation/ums-message-drawer.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(
    page.getByLabel("Status pesan", { exact: true }),
  ).toHaveAttribute("data-value", "FAILED");
  await expect(page).toHaveURL(/status=FAILED/);
});
test("command search opens monitoring and finance screens distinguish unavailable vendor data", async ({
  page,
}) => {
  await login(page, "finance");
  await page.keyboard.press("Meta+k");
  const command = page.getByRole("dialog", {
    name: "Pencarian global",
    exact: true,
  });
  await expect(command).toBeVisible();
  await command
    .getByLabel("Cari halaman atau ID pesan", { exact: true })
    .fill("Pemantauan");
  await command.getByRole("button", { name: /Pemantauan kanal/ }).click();
  await expect(page).toHaveURL(/\/channels$/);
  await expect(page.locator(".monitoring-card")).toHaveCount(6);
  const pushCard = page
    .locator(".monitoring-card")
    .filter({ hasText: "Push notification" });
  await expect(
    pushCard.getByRole("button", { name: /Lihat pesan/ }),
  ).toBeEnabled();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Penggunaan & biaya", exact: true })
    .click();
  await expect(
    page.getByText("Biaya ledger internal", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Biaya vendor / invoice", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Rekonsiliasi", exact: true })
    .click();
  await expect(
    page.getByText("Invoice vendor", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Belum terhubung", { exact: true })).toHaveCount(
    2,
  );
});
test("mobile UMS monitoring keeps navigation, drawer, and filters usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "viewer");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Penelusuran pesan", exact: true })
    .click();
  await expect(
    page.locator(".operations-table tbody tr").first(),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Est. IDR", exact: true }),
  ).not.toBeVisible();
  await page.locator(".operations-table .id-link").first().click();
  const drawer = page.getByRole("dialog", {
    name: "Detail pesan",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  expect((await drawer.boundingBox())!.width).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: ".agents/artifacts/implementation/ums-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});

test("bilingual manual, dropdown keyboard and notification layout", async ({
  page,
}) => {
  await login(page, "creator");
  await selectOption(page.getByLabel("Bahasa", { exact: true }), "en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/help");
  await expect(
    page.getByRole("heading", { name: "User guide", exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .getByLabel("Search the guide", { exact: true })
    .fill("first campaign");
  await page
    .getByRole("button", { name: "Start: your first campaign", exact: true })
    .click();
  await expect(page.locator(".guide-article")).toContainText("approval");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await selectOption(page.getByLabel("Language", { exact: true }), "id");
  await page.goto("/workflows");
  await page.getByRole("button", { name: "Notifikasi", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Notifikasi tim",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const overlaps = await dialog.locator(".notification-meta").evaluateAll(
      (rows) =>
        rows.filter((row) => {
          const time = row.querySelector("time")!.getBoundingClientRect();
          const actions = row
            .querySelector(".notification-actions")!
            .getBoundingClientRect();
          return (
            time.right > actions.left &&
            time.left < actions.right &&
            time.bottom > actions.top &&
            time.top < actions.bottom
          );
        }).length,
    );
    expect(overlaps).toBe(0);
  }
  await page.screenshot({
    path: ".agents/artifacts/implementation/notifications-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
  await page.goto("/settings/notifications");
  await expect(
    page.getByText("Administrator belum mengaktifkan notifikasi perangkat.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Aktifkan pada perangkat ini",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("platform company menu onboards a separate company owner", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/settings/companies");
  await page
    .getByRole("button", { name: "Perusahaan baru", exact: true })
    .click();
  const form = page.locator(".company-form");
  const name = `Company browser ${Date.now()}`;
  await form.getByLabel("Nama perusahaan", { exact: true }).fill(name);
  await form.getByLabel("Nama admin", { exact: true }).fill("Company owner");
  await form
    .getByLabel("Email admin", { exact: true })
    .fill(`owner-${randomUUID()}@example.test`);
  await form.locator("input[name=adminPassword]").fill("SyntheticCompany123!");
  await form
    .getByRole("button", { name: "Buat perusahaan", exact: true })
    .click();
  await expect(
    page.getByText("Perusahaan berhasil dibuat", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("table").getByText(name, { exact: true }),
  ).toBeVisible();
  await login(page, "creator");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Perusahaan", exact: true }),
  ).toHaveCount(0);
});

test("dropdown keyboard selection and Escape preserve the campaign form", async ({
  page,
}) => {
  await login(page, "creator");
  await page
    .getByRole("button", { name: "Buat kampanye", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const source = dialog.getByLabel("Sumber data", { exact: true });
  await source.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await source.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(source).not.toHaveAttribute("data-value", "");
  await page.getByRole("button", { name: "Tutup", exact: true }).click();
});

test("English login labels preserve entered credentials while switching language", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill("viewer@example.test");
  await selectOption(page.getByLabel("Bahasa", { exact: true }), "en");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
    "viewer@example.test",
  );
});
