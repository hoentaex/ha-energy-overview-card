import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arcPoint,
  curvePaths,
  curvePoints,
  dayProgress,
  groundOf,
  isNight,
  readout,
  renderBanner,
  sceneOf,
} from "../src/banner.js";
import { periodRange } from "../src/period.js";
import { translator } from "../src/shared.js";
import { TZ } from "./helpers.mjs";

const t = translator("de");

test("night picture follows the dark theme unless forced", () => {
  assert.equal(isNight({ themes: { darkMode: true } }, {}), true);
  assert.equal(isNight({ themes: { darkMode: false } }, {}), false);
  assert.equal(isNight({ themes: { darkMode: true } }, { illustration_theme: "day" }), false);
  assert.equal(isNight({}, { illustration_theme: "night" }), true);
});

test("scene choice: sun by default, balcony and curve when set, anything else falls back to the sun", () => {
  assert.equal(sceneOf({}), "sun");
  assert.equal(sceneOf({ illustration_scene: "balcony" }), "balcony");
  assert.equal(sceneOf({ illustration_scene: "curve" }), "curve");
  assert.equal(sceneOf({ illustration_scene: "house" }), "sun");
});

test("the sun on its arc: left at sunrise, at the top at mid-day, right at sunset, none at night", () => {
  const rise = new Date("2026-11-18T07:30:00Z");
  const set = new Date("2026-11-18T16:30:00Z");
  assert.equal(dayProgress(new Date("2026-11-18T07:30:00Z"), rise, set), 0);
  assert.equal(dayProgress(new Date("2026-11-18T12:00:00Z"), rise, set), 0.5);
  assert.equal(dayProgress(new Date("2026-11-18T16:30:00Z"), rise, set), 1);
  assert.equal(dayProgress(new Date("2026-11-18T20:00:00Z"), rise, set), null);
  assert.equal(dayProgress(new Date("2026-11-18T05:00:00Z"), rise, set), null);
  const left = arcPoint(0);
  const top = arcPoint(0.5);
  const right = arcPoint(1);
  assert.ok(Math.abs(left.x - 68) < 1e-9 && Math.abs(left.y - 74) < 1e-9);
  assert.ok(Math.abs(top.x - 130) < 1e-9 && Math.abs(top.y - 10) < 1e-9);
  assert.ok(Math.abs(right.x - 192) < 1e-9);
});

test("ground strip: yellow for PV, orange for the grid, green for the battery, grey when nothing flows", () => {
  assert.equal(groundOf({ solar: 400, battery_charge: 200 }, "pv_charging", 10), "pv");
  assert.equal(groundOf({ grid_export: 300, solar: 600 }, "export", 10), "pv");
  assert.equal(groundOf({ grid_import: 500 }, "grid_house", 10), "imp");
  assert.equal(groundOf({ battery_discharge: 300 }, "battery_house", 10), "bat");
  assert.equal(groundOf({ solar: 0, grid_import: 3 }, "grid_house", 10), "idle");
  assert.equal(groundOf({}, null, 10), "idle");
});

test("day curve: finished hours at their middle, the live power at now, the forecast for every hour", () => {
  const range = periodRange("day", new Date("2026-11-18T12:00:00Z"), { tz: TZ });
  const solar = range.slots.map((_, i) => (i >= 8 && i < 16 ? 0.4 : 0));
  const forecast = range.slots.map((_, i) => (i >= 8 && i < 16 ? 0.5 : 0));
  const hourOf = (d) =>
    Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(d));
  const pts = curvePoints({ slots: range.slots, solar, forecast, nowH: 13.25, liveKw: 0.36, hourOf });
  assert.equal(pts.measured.at(-1).h, 13.25);
  assert.equal(pts.measured.at(-1).v, 0.36);
  assert.equal(pts.measured.at(-2).h, 12.5);
  assert.equal(pts.forecast.length, range.slots.length);
  const paths = curvePaths(pts);
  assert.match(paths.area, /^M[\d.]+ 74L.*Z$/);
  assert.match(paths.forecast, /^M/);
  assert.ok(paths.now.x > 58 && paths.now.x < 198);
  // Nothing measured yet: no area, no marker, the forecast alone.
  const empty = curvePaths({ measured: [], forecast: pts.forecast });
  assert.equal(empty.area, "");
  assert.equal(empty.now, null);
});

test("readouts: PV now and today's yield; battery state on the balcony; today and forecast on the curve", () => {
  const live = { solar: 360, battery_charge: 137 };
  const base = { t, lang: "de", live, todayKwh: 1.7, forecastKwh: 2.49, threshold: 10 };
  assert.deepEqual(readout("sun", base), ["360 W", "heute 1,70 kWh von 2,49 kWh"]);
  assert.deepEqual(readout("balcony", base), ["360 W", "Akku lädt +137 W"]);
  assert.deepEqual(readout("balcony", { ...base, live: { solar: 0, battery_discharge: 250 } }), [
    "0 W",
    "Akku entlädt 250 W",
  ]);
  assert.deepEqual(readout("curve", base), ["1,70 kWh", "Prognose 2,49 kWh"]);
  assert.deepEqual(readout("sun", { ...base, todayKwh: null }), ["360 W", ""]);
});

test("the banner: scene, ground and night class from the card state", () => {
  const hass = {
    themes: { darkMode: true },
    config: { latitude: 52.52, longitude: 13.405 },
    states: {},
  };
  const html = renderBanner({
    hass,
    config: { illustration_scene: "balcony" },
    live: { solar: 400, battery_charge: 200, soc: 64 },
    status: "pv_charging",
    today: null,
    t,
    lang: "de",
    tz: TZ,
    now: new Date("2026-11-18T12:00:00Z"),
    logo: "",
    color: "red",
    name: "Energie",
    sub: "",
    pill: "",
    button: "",
  });
  assert.match(html, /class="banner night"/);
  assert.match(html, /eb-balcony/);
  assert.match(html, /class="ground g-pv"/);
  assert.equal((html.match(/eb-seg on/g) || []).length, 3);
});
