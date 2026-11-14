import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  deriveStatus,
  forecastEntries,
  prefsLive,
  prefsSources,
  readLive,
  resolveSources,
  splitSlot,
  summarize,
} from "../src/energy.js";

const prefs = JSON.parse(readFileSync(new URL("./fixtures/prefs-home.json", import.meta.url)));
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

// Haus A, 14.11.2026: PV 4.51 · export 1.92 · charge 1.60 (0.43 of it from the grid) · discharge 1.18 · consumption 6.11 kWh
const DAY_1411 = {
  solar: 4.51,
  grid_export: 1.92,
  battery_charge: 1.6,
  battery_grid_charge: 0.43,
  battery_discharge: 1.18,
  consumption: 6.11,
  grid_import: null,
};

test("split of 14.11.", () => {
  const s = splitSlot(DAY_1411);
  close(s.pv_to_battery, 1.17);
  close(s.grid_to_battery, 0.43);
  close(s.pv_to_house, 1.42);
  close(s.house_from_battery, 1.18);
  close(s.house_from_grid, 3.51);
  close(s.pv_to_house + s.pv_to_battery + s.pv_to_grid, 4.51);
  close(s.house_from_solar + s.house_from_battery + s.house_from_grid, 6.11);
  const t = summarize([s]);
  close(t.autarky, 2.6 / 6.11);
  close(t.self_consumption, 2.59 / 4.51);
  close(t.co2_kg, 2.59 * 0.4);
  close(summarize([s], 0.5).co2_kg, 2.59 * 0.5);
});

test("split clamps at zero and estimates consumption without a statistic", () => {
  const night = splitSlot({ solar: null, grid_import: 0.3, battery_discharge: 0.1, consumption: null });
  close(night.consumption, 0.4);
  close(night.house_from_grid, 0.3);
  assert.equal(night.pv_to_house, 0);
  const odd = splitSlot({
    solar: 0.1,
    grid_export: 0.5,
    battery_charge: 0.2,
    battery_grid_charge: 0.4,
    consumption: 0.2,
  });
  assert.ok(Object.values(odd).every((v) => v >= 0));
  close(odd.grid_to_battery, 0.2);
});

test("summarize sums per-slot splits; ratios are null without data", () => {
  const t = summarize([splitSlot({ solar: 1, consumption: 1 }), splitSlot({ grid_import: 1, consumption: 1 })]);
  close(t.consumption, 2);
  close(t.autarky, 0.5);
  close(t.self_consumption, 1);
  const empty = summarize([]);
  assert.equal(empty.autarky, null);
  assert.equal(empty.self_consumption, null);
});

test("sources from the Energy dashboard prefs (flat and flow_from formats) and overrides", () => {
  const s = prefsSources(prefs);
  assert.deepEqual(s.grid_import, ["sensor.stromverbrauch_berechnung_neu"]);
  assert.deepEqual(s.grid_export, ["sensor.einspeisung_berechnung"]);
  assert.deepEqual(s.battery_charge, ["sensor.pv_charge_battery_energy"]);
  assert.deepEqual(s.battery_discharge, ["sensor.pv_discharge_battery_energy"]);
  assert.deepEqual(s.solar, ["sensor.pv_power_from_solar_energy"]);
  assert.deepEqual(s.consumption, []);
  const legacy = prefsSources({
    energy_sources: [
      {
        type: "grid",
        flow_from: [{ stat_energy_from: "sensor.a" }, { stat_energy_from: "sensor.b" }],
        flow_to: [{ stat_energy_to: "sensor.c" }],
      },
    ],
  });
  assert.deepEqual(legacy.grid_import, ["sensor.a", "sensor.b"]);
  assert.deepEqual(legacy.grid_export, ["sensor.c"]);
  const r = resolveSources(
    {
      consumption_stat: "sensor.stromverbrauch_gesamt_real_daily",
      battery_grid_charge_stat: "sensor.akkuladung_von_netz_energy_daily",
      solar_stat: ["sensor.x", "sensor.y"],
    },
    prefs,
  );
  assert.deepEqual(r.consumption, ["sensor.stromverbrauch_gesamt_real_daily"]);
  assert.deepEqual(r.solar, ["sensor.x", "sensor.y"]);
  assert.deepEqual(r.grid_import, ["sensor.stromverbrauch_berechnung_neu"]);
  assert.deepEqual(resolveSources({}, null).solar, []);
  assert.deepEqual(forecastEntries(prefs), ["27b30f56a98428a56f1c046ba9755737"]);
});

const st = (state, unit = "W") => ({ state: String(state), attributes: { unit_of_measurement: unit } });

test("live values from the prefs' stat_rate (battery positive = discharging there)", () => {
  const hass = {
    states: {
      "sensor.pv_power_from_solar": st(820),
      "sensor.netzleistung_kombiniert": st(-150),
      "sensor.solarbank_2_e1600_ac_akkuleistung_inverted": st(-400),
    },
  };
  const l = readLive(hass, {}, prefsLive(prefs));
  assert.equal(l.solar, 820);
  assert.equal(l.grid_import, 0);
  assert.equal(l.grid_export, 150);
  assert.equal(l.battery_charge, 400);
  assert.equal(l.battery_discharge, 0);
  assert.equal(l.house, 270);
  assert.equal(deriveStatus(l), "pv_charging");
});

test("live values from own entities, kW, invert options, unavailable", () => {
  const hass = {
    states: {
      pv: st(0),
      grid: st(1.2, "kW"),
      bat: st(300),
      house: st("unavailable"),
      soc: st(55, "%"),
    },
  };
  const cfg = {
    solar_power_entity: "pv",
    grid_power_entity: "grid",
    battery_power_entity: "bat",
    invert_battery: true,
    house_power_entity: "house",
    soc_entity: "soc",
    capacity_kwh: 1.6,
  };
  const l = readLive(hass, cfg, prefsLive(prefs));
  assert.equal(l.grid_import, 1200);
  assert.equal(l.battery_discharge, 300);
  assert.equal(l.house, 1500);
  assert.equal(l.soc, 55);
  assert.equal(l.capacity_kwh, 1.6);
  assert.equal(deriveStatus(l), "grid_house");
  const split = readLive(
    { states: { imp: st(0), exp: st(900) } },
    { grid_import_power_entity: "imp", grid_export_power_entity: "exp" },
  );
  assert.equal(split.grid_export, 900);
  assert.equal(readLive({ states: {} }, {}).house, null);
});

test("status pill", () => {
  assert.equal(deriveStatus({ solar: 500, battery_discharge: 0, grid_import: 0, house: 500 }), "pv_house");
  assert.equal(deriveStatus({ solar: 0, battery_discharge: 300, grid_import: 5 }), "battery_house");
  assert.equal(deriveStatus({ solar: 1500, grid_export: 600, battery_charge: 0 }), "export");
  assert.equal(deriveStatus({ grid_import: 400 }), "grid_house");
  assert.equal(deriveStatus({ solar: 0, battery_discharge: 380, grid_import: 30 }), "battery_house");
  assert.equal(deriveStatus({ solar: 0, battery_discharge: 100, grid_import: 300 }), "grid_house");
  assert.equal(deriveStatus({ solar: 0, battery_charge: 400, grid_import: 580 }), "grid_house");
  assert.equal(deriveStatus({ solar: 1050, battery_charge: 520, grid_export: 300 }), "pv_charging");
  assert.equal(deriveStatus({ solar: 8, grid_import: 8 }), "grid_house");
});
