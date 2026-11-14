// Renders the demo page with the simulated hass at a fixed time (14 Nov 2026, 13:20 Berlin) and saves the
// README screenshots: the whole card per period (light / dark) and the history tile in every view.
// Usage: npm run screenshots
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const server = serve();
const port = server.address()?.port ?? 8769;
const browser = await chromium.launch();
const TIME = new Date("2026-11-14T13:20:00+01:00");
const shot = (name) => `${root}screenshots/${name}.png`;

const open = async (theme, query = "") => {
  const page = await browser.newPage({
    viewport: { width: 1100, height: 2400 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
    timezoneId: "Europe/Berlin",
  });
  await page.clock.setFixedTime(TIME);
  await page.goto(`http://127.0.0.1:${port}/demo/?lang=de&scenario=sim${query}`);
  await page.locator(`#${theme}`).evaluate((el) => {
    el.style.padding = "16px";
    el.style.width = "452px";
  });
  const card = page.locator(`#${theme} energy-overview-card`).first();
  await card.locator(".cols").waitFor();
  return { page, card };
};

const settle = async (card, kind) => {
  await card.locator(`[data-act="period"][data-v="${kind}"][aria-pressed="true"]`).waitFor();
  await card.locator(".cols").waitFor();
  await card.page().waitForTimeout(300);
};

try {
  for (const theme of ["light", "dark"]) {
    const { page, card } = await open(theme);
    for (const kind of ["day", "week", "month"]) {
      await card.locator(`[data-act="period"][data-v="${kind}"]`).click();
      await settle(card, kind);
      await card.screenshot({ path: shot(`card-${kind}-${theme}`) });
      console.log(`saved screenshots/card-${kind}-${theme}.png`);
      for (const mode of ["consumption", "solar", "battery"]) {
        await card.locator(`[data-act="mode"][data-v="${mode}"]`).click();
        await page.waitForTimeout(150);
        await card.locator('[data-sec="history"] .tile').screenshot({ path: shot(`history-${kind}-${mode}-${theme}`) });
        console.log(`saved screenshots/history-${kind}-${mode}-${theme}.png`);
      }
      await card.locator('[data-act="mode"][data-v="consumption"]').click();
    }
    const mini = page.locator(`#${theme} energy-overview-mini-card`).first();
    await mini.locator(".mini").waitFor();
    await page.waitForTimeout(300);
    await mini.screenshot({ path: shot(`mini-${theme}`) });
    console.log(`saved screenshots/mini-${theme}.png`);
    await page.setViewportSize({ width: 760, height: 2600 });
    await mini.locator("[data-open]").click();
    const dialog = page.locator("energy-overview-dialog energy-overview-card");
    await dialog.locator(".cols").waitFor();
    await page.waitForTimeout(300);
    await dialog.screenshot({ path: shot(`popup-${theme}`) });
    console.log(`saved screenshots/popup-${theme}.png`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
