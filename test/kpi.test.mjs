import assert from "node:assert/strict";
import { test } from "node:test";
import { fillRows, kpiGrid } from "../src/kpi.js";

test("rows are always full: the last tile of a short row widens", () => {
  // Tank: level (wide) + four tiles in three columns.
  assert.deepEqual(fillRows([2, 1, 1, 1, 1], 3), [2, 1, 1, 1, 1]);
  // Without the price: the last delivery takes the free column.
  assert.deepEqual(fillRows([2, 1, 1, 1], 3), [2, 1, 1, 2]);
  // Without price and range.
  assert.deepEqual(fillRows([2, 1, 1], 3), [2, 1, 3]);
  // Two columns: level alone, then pairs; an odd one out spans both.
  assert.deepEqual(fillRows([2, 1, 1, 1], 2), [2, 1, 1, 2]);
  assert.deepEqual(fillRows([1, 1, 1], 2), [1, 1, 2]);
  assert.deepEqual(fillRows([1], 3), [3]);
  assert.deepEqual(fillRows([], 3), []);
});

test("a wide tile that does not fit the rest of a row: the tile before it closes the row", () => {
  // 1 + 1 + wide in three columns: the wide tile moves on, the second tile widens to fill row one.
  assert.deepEqual(fillRows([1, 1, 2, 1], 3), [1, 2, 2, 1]);
});

test("tiles without a value are left out, spans for two and three columns", () => {
  const html = kpiGrid([
    { k: "A", v: "1", icon: "drop", c: "red", wide: true },
    { k: "B", v: null, icon: "drop", c: "red" },
    { k: "C", v: "3", icon: "drop", c: "red" },
    { k: "D", v: "", icon: "drop", c: "red" },
  ]);
  assert.equal((html.match(/class="kpi[ "]/g) || []).length, 2);
  assert.doesNotMatch(html, /"kk">B</);
  // A (wide) + C: in three columns C takes the last one; in two columns C fills its own row.
  assert.match(html, /--s2:2;--s3:2[^>]*>\s*<span class="ki">[\s\S]*?>A</);
  assert.match(html, /--s2:2;--s3:1/);
  assert.equal(kpiGrid([{ k: "X", v: null }]), "");
});

test("a tile with an entity is a button for Home Assistant's dialog; values are escaped", () => {
  const html = kpiGrid([{ k: "Preis", v: "<b>", icon: "solar", c: "blue", more: "sensor.heizol_tagespreis" }]);
  assert.match(html, /<button class="kpi" type="button" data-more="sensor.heizol_tagespreis"/);
  assert.match(html, /&lt;b&gt;/);
});

import { footer, powerNow } from "../src/sections.js";
import { translator } from "../src/shared.js";

const base = {
  t: translator("de"),
  lang: "de",
  tz: "Europe/Berlin",
  kind: "day",
  isCurrentPeriod: true,
  more: {},
  energy: { hasData: true, total: { grid_import: 2.98, grid_export: 0, battery_charge: 0.74, solar: 2.26 } },
};

test("footer: the kWh tiles; without a forecast the PV tile is left out and battery fills the row", () => {
  const html = footer({ ...base, forecastToday: 2.4 });
  assert.equal((html.match(/class="kpi[ "]/g) || []).length, 4);
  assert.match(html, /94 % der Prognose/);
  const week = footer({ ...base, kind: "week", isCurrentPeriod: false });
  assert.equal((week.match(/class="kpi[ "]/g) || []).length, 3);
  assert.match(week, /--s2:2;--s3:2[^"]*">\s*<span class="ki">[\s\S]*?Akku geladen/);
});

test("power now: live values against today's peak; another day shows its peak", () => {
  const cells = [0, 1, 2].map((h) => Date.UTC(2026, 10, 20, h));
  const power = { cells, last: 2, series: { grid_import: [100, 640, 200], pv: [0, 0, 0], house: [300, 898, 391] } };
  const live = { grid_import: 391, solar: 0, house: 391 };
  const html = powerNow({ ...base, power, live });
  assert.match(html, /Spitze heute 640 W · 02:00/);
  assert.equal((html.match(/class="kpi[ "]/g) || []).length, 3);
  const past = powerNow({ ...base, power, live, isCurrentPeriod: false });
  assert.match(past, /<span class="kv num">898<small>W/);
  assert.match(past, /Spitze um 02:00/);
  assert.equal(powerNow({ ...base, kind: "week", power, live }), "");
});
