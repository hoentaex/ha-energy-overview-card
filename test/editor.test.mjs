import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The editor module defines custom element classes: a bare HTMLElement is enough to load it.
globalThis.HTMLElement ??= class {};
const { detectConfig, editorSchema, fromFormData, helperFor, toFormData } = await import("../src/editor.js");

const prefs = JSON.parse(readFileSync(new URL("./fixtures/prefs-home.json", import.meta.url)));
const names = (schema) => schema.flatMap((s) => (s.schema ? names(s.schema) : s.name ? [s.name] : []));

test("the editor covers every option; statistics use the statistic selector", () => {
  const schema = editorSchema("de");
  const n = names(schema);
  for (const k of [
    "solar_power_entity",
    "grid_power_entity",
    "grid_import_power_entity",
    "battery_power_entity",
    "invert_battery",
    "house_power_entity",
    "soc_entity",
    "capacity_kwh",
    "solar_stat",
    "consumption_stat",
    "battery_grid_charge_stat",
    "forecast_today_entity",
    "sections",
    "week_mode",
    "history_view",
    "power_resolution",
    "animations",
    "co2_factor",
    "threshold_w",
  ])
    assert.ok(n.includes(k), k);
  assert.ok(!n.includes("popup"), "popup only in the mini card editor");
  assert.ok(names(editorSchema("en", { mini: true })).includes("popup"));
  const stat = JSON.stringify(schema).match(/"name":"consumption_stat","selector":\{"statistic":\{\}\}/);
  assert.ok(stat);
  assert.equal(helperFor("de", "solar_stat"), "Leer = aus dem Energie-Dashboard");
  assert.equal(helperFor("de", "name"), undefined);
});

test("form data round trip keeps the YAML minimal", () => {
  const config = { consumption_stat: "sensor.c", week_mode: "rolling", power_resolution: 5, co2_factor: 0.35 };
  const data = toFormData(config);
  assert.equal(data.week_mode, "rolling");
  assert.equal(data.power_resolution, "5");
  assert.equal(data.threshold_w, 10);
  assert.deepEqual(fromFormData(data), config);
  assert.deepEqual(fromFormData(toFormData({})), {});
  assert.deepEqual(fromFormData(toFormData({}, true), true), {});
  assert.deepEqual(fromFormData({ ...toFormData({}, true), popup: false }, true), { popup: false });
  // sections keep the card's order, the full list is dropped
  assert.deepEqual(fromFormData({ ...toFormData({}), sections: ["footer", "flow"] }), { sections: ["flow", "footer"] });
});

test("a list of statistics from YAML survives the editor while its first entry is unchanged", () => {
  const original = { solar_stat: ["sensor.a", "sensor.b"] };
  const data = toFormData(original);
  assert.equal(data.solar_stat, "sensor.a");
  assert.deepEqual(fromFormData(data, false, original), original);
  assert.deepEqual(fromFormData({ ...data, solar_stat: "sensor.x" }, false, original), { solar_stat: "sensor.x" });
});

test("new cards take the live sensors from the Energy dashboard and find SoC and forecast", () => {
  const st = (state, attributes = {}) => ({ state, attributes });
  const hass = {
    states: {
      "sensor.phone_battery_level": st("80", { unit_of_measurement: "%", device_class: "battery" }),
      "sensor.solarbank_2_e1600_ac_ladestand": st("55", { unit_of_measurement: "%", device_class: "battery" }),
      "sensor.energy_production_today": st("3.4", { unit_of_measurement: "kWh" }),
    },
  };
  const c = detectConfig(hass, prefs);
  assert.equal(c.solar_power_entity, "sensor.pv_power_from_solar");
  assert.equal(c.grid_power_entity, "sensor.netzleistung_kombiniert");
  assert.equal(c.battery_power_entity, "sensor.solarbank_2_e1600_ac_akkuleistung_inverted");
  assert.equal(c.invert_battery, true);
  assert.equal(c.soc_entity, "sensor.solarbank_2_e1600_ac_ladestand");
  assert.equal(c.forecast_today_entity, "sensor.energy_production_today");
  assert.deepEqual(detectConfig({ states: {} }, null), {});
});
