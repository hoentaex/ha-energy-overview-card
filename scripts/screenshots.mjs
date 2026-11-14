// Renders the demo page with the fake hass at a fixed time and saves the README screenshots.
// Usage: npm run screenshots
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const server = serve();
const port = server.address()?.port ?? 8769;
const browser = await chromium.launch();
const time = new Date();
time.setHours(13, 20, 0, 0);

try {
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 1600 },
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    await page.clock.setFixedTime(time);
    await page.goto(`http://127.0.0.1:${port}/demo/?lang=de`);
    await page.locator(`#${theme}`).evaluate((el) => {
      el.style.padding = "16px";
      el.style.width = "452px";
    });
    for (const [type, file] of [
      ["energy-overview-card", "card"],
      ["energy-overview-mini-card", "mini"],
    ]) {
      const card = page.locator(`#${theme} ${type}`).first();
      await card.locator("ha-card").waitFor();
      await card.screenshot({ path: `${root}screenshots/${file}-${theme}.png` });
      console.log(`saved screenshots/${file}-${theme}.png`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
