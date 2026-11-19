import assert from "node:assert/strict";
import { test } from "node:test";
import {
  along,
  flowParts,
  normWeather,
  renderHouse,
  renderRing,
  renderSankey,
  roundPath,
  setFlowAssets,
  skyKey,
  skyState,
} from "../src/flowstyles.js";
import { translator } from "../src/shared.js";

const t = translator("de");
const opts = { t, lang: "de", threshold: 10, time: "Sa 13:20" };
// Grid charges the battery at night-time prices while PV covers a little: 500 + 73 = 192 + 381.
const gridCharge = {
  solar: 73,
  grid_import: 500,
  grid_export: 0,
  battery_charge: 381,
  battery_discharge: 0,
  house: 192,
  soc: 31,
};
const evening = {
  solar: 6,
  grid_import: 0,
  grid_export: 10,
  battery_charge: 0,
  battery_discharge: 259,
  house: 255,
  soc: 39,
};

test("weather states map onto the sky images", () => {
  assert.equal(normWeather("pouring"), "rainy");
  assert.equal(normWeather("snowy-rainy"), "snowy");
  assert.equal(normWeather("windy-variant"), "cloudy");
  assert.equal(normWeather(undefined), "clear");
  assert.equal(skyKey("sunny", 35), "day-clear");
  assert.equal(skyKey("partlycloudy", 35), "day-cloudy");
  assert.equal(skyKey("sunny", 3), "dusk-clear");
  assert.equal(skyKey("cloudy", 3), "dusk-cloudy");
  assert.equal(skyKey("rainy", 3), "day-rainy");
  assert.equal(skyKey("clear-night", 20), "night-clear");
  assert.equal(skyKey("fog", -12), "night-fog");
});

test("sky state from sun.sun and the weather entity", () => {
  const hass = {
    states: {
      "sun.sun": { state: "below_horizon", attributes: { elevation: -20 } },
      "weather.home": { state: "rainy" },
    },
  };
  assert.deepEqual(skyState(hass, { weather_entity: "weather.home" }), { key: "night-rainy", fx: "rain", night: true });
  assert.deepEqual(skyState(hass, {}), { key: "night-clear", fx: "stars", night: true });
  assert.equal(skyState({ states: {} }, {}).key, "day-clear");
});

test("rounded orthogonal paths and points along them", () => {
  const pts = [
    [0, 0],
    [0, 100],
    [50, 100],
  ];
  assert.equal(roundPath(pts, 10), "M0 0 L0 90 Q0 100 10 100 L50 100");
  assert.deepEqual(along(pts, 0.5), { x: 0, y: 75, ang: 90 });
  assert.deepEqual(along(pts, 1), { x: 50, y: 100, ang: 0 });
});

test("flow parts: threshold and the source that feeds the home most", () => {
  const p = flowParts(evening, 10);
  assert.equal(p.solar, 0);
  assert.equal(p.export, 0);
  assert.equal(p.discharge, 259);
  assert.equal(p.houseColor, "var(--eoc-bat)");
  // Like the ellipse: PV charges the battery first, the grid tops up the rest and feeds the home.
  assert.equal(flowParts(gridCharge, 10).flows.grid_battery, 308);
  assert.equal(flowParts(gridCharge, 10).houseColor, "var(--eoc-imp)");
});

test("house scene: battery leg and symbol blue while charging, green while discharging", () => {
  setFlowAssets({ house: { balcony: { day: "d.webp", night: "n.webp" } }, sky: { "day-clear": "s.webp" } });
  const charging = renderHouse(gridCharge, { ...opts, sky: { key: "day-clear", fx: "", night: false } });
  assert.match(charging, /class="h-bat pulse" filter="url\(#eoc-hsoft\)" style="color:var\(--eoc-gridcharge\)"/);
  assert.match(charging, /src="d\.webp"/);
  assert.match(charging, /url\('s\.webp'\)/);
  const discharging = renderHouse(evening, { ...opts, sky: { key: "day-clear", fx: "", night: true } });
  assert.match(discharging, /class="h-bat pulse" filter="url\(#eoc-hsoft\)" style="color:var\(--eoc-bat\)"/);
  assert.match(discharging, /src="n\.webp"/);
  // Below the threshold nothing moves: no comet on the PV leg (6 W) or the export leg (10 W).
  assert.equal((discharging.match(/class="h-comet"/g) || []).length, 2);
  const still = renderHouse(evening, { ...opts, animations: false });
  assert.doesNotMatch(still, /h-comet|pulse/);
});

test("energy bands: both sides carry the same total", () => {
  const html = renderSankey(gridCharge, opts);
  const heights = (x) =>
    [...html.matchAll(new RegExp(`<rect x="${x}" y="[\\d.]+" width="10" height="([\\d.]+)"`, "g"))].map((m) => +m[1]);
  const sum = (a) => a.reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(sum(heights(96)) - sum(heights(274))) < 0.01);
  assert.match(html, /Akku laden/);
  assert.match(renderSankey({ solar: 0, grid_import: 0, house: 0 }, opts), /Gerade fließt kein Strom/);
});

test("ring: share of own energy and the battery direction", () => {
  const html = renderRing(evening, opts);
  assert.match(html, /100 % eigen/);
  assert.match(html, /↑ 259 W/);
  assert.match(renderRing(gridCharge, opts), /0 % eigen/);
});

test("house scene: the classic family house as a second model", () => {
  setFlowAssets({
    house: { balcony: { day: "d.webp", night: "n.webp" }, classic: { day: "cd.webp", night: "cn.webp" } },
    sky: {},
  });
  const day = { key: "day-clear", fx: "", night: false };
  const night = { key: "night-clear", fx: "", night: true };
  const classic = renderHouse(evening, { ...opts, house: "classic", sky: day });
  assert.match(classic, /src="cd\.webp"/);
  // Its own layout: the grid leg comes down the pole at x 1403.
  assert.match(classic, /M1403 315/);
  assert.match(renderHouse(evening, { ...opts, house: "classic", sky: night }), /src="cn\.webp"/);
  // Default and unknown values: the balcony house.
  assert.match(renderHouse(evening, { ...opts, sky: day }), /src="d\.webp"/);
  assert.match(renderHouse(evening, { ...opts, house: "villa", sky: night }), /src="n\.webp"/);
});
