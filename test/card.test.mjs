import assert from "node:assert/strict";
import { test } from "node:test";
import { renderHistory } from "../src/charts.js";
import { powerEntities, powerSeries } from "../src/data.js";
import { splitSlot } from "../src/energy.js";
import { liveFlows } from "../src/flow.js";
import { translator } from "../src/shared.js";

test("live flows: PV surplus charges the battery and exports the rest", () => {
  const f = liveFlows({ solar: 1050, grid_import: 0, grid_export: 300, battery_charge: 520, battery_discharge: 0 });
  assert.deepEqual(f, {
    solar_grid: 300,
    solar_house: 230,
    solar_battery: 520,
    grid_house: 0,
    battery_house: 0,
    grid_battery: 0,
  });
});

test("live flows: grid charging at night", () => {
  const f = liveFlows({ solar: 0, grid_import: 580, grid_export: 0, battery_charge: 400, battery_discharge: 0 });
  assert.equal(f.grid_battery, 400);
  assert.equal(f.grid_house, 180);
  assert.equal(f.solar_battery, 0);
});

test("power entities from config, falling back to the prefs' stat_rate", () => {
  const { ids, map } = powerEntities(
    { soc_entity: "sensor.soc" },
    {
      solar_power_entity: "sensor.pv",
      grid_power_entity: "sensor.grid",
      battery_power_entity: "sensor.bat",
      battery_sign: -1,
    },
  );
  assert.deepEqual(map, { solar: "sensor.pv", grid: "sensor.grid", battery: "sensor.bat", soc: "sensor.soc" });
  assert.equal(ids.length, 4);
  const split = powerEntities({ grid_import_power_entity: "a", grid_export_power_entity: "b", grid_power_entity: "c" });
  assert.deepEqual(split.map, { grid_import: "a", grid_export: "b" });
});

test("power series: grid split by sign, home estimated, gaps stay gaps", () => {
  const raw = {
    cells: [0, 1, 2],
    series: { pv: [500, 0, null], grid: [-100, 300, null], bat: [-200, 100, null] },
  };
  // prefs battery power: positive = discharging
  const s = powerSeries(raw, { solar: "pv", grid: "grid", battery: "bat" }, {}, { battery_sign: -1 });
  assert.deepEqual(s.grid_import, [0, 300, null]);
  assert.deepEqual(s.grid_export, [100, 0, null]);
  // cell 0: 500 PV − 100 export − 200 charge = 200; cell 1: 300 import + 100 discharge
  assert.deepEqual(s.house, [200, 400, null]);
});

test("battery history: charge up, discharge down, SoC line only in the upper part", () => {
  const units = [
    { title: "a", split: splitSlot({ battery_charge: 1, battery_grid_charge: 0.25, battery_discharge: 0 }), soc: 0 },
    { title: "b", split: splitSlot({ battery_discharge: 0.5, consumption: 1 }), soc: 100 },
    { title: "c", future: true, split: null },
  ];
  const html = renderHistory(units, { t: translator("de"), lang: "de", mode: "battery", sel: 0, soc: true });
  assert.match(html, /class="zero" style="top:(\d+)px"/);
  const zeroY = Number(html.match(/class="zero" style="top:(\d+)px"/)[1]);
  const socH = Number(html.match(/class="overlay" style="top:0;height:(\d+)px"/)[1]);
  assert.equal(socH, zeroY, "the SoC overlay ends at the zero line");
  assert.match(html, /M5 100\.0 L15 0\.0/);
  assert.match(html, /−0,5/);
  assert.match(html, /class="col future"/);
});
