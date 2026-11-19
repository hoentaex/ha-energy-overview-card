import assert from "node:assert/strict";
import { test } from "node:test";
import { moreAttrs, moreIds, moreSpan } from "../src/more.js";

test("entities behind the values: config first, Energy dashboard as fallback, external statistics left out", () => {
  const prefs = {
    energy_sources: [
      { type: "solar", stat_energy_from: "sensor.pv_energy" },
      { type: "grid", stat_energy_from: "sensor.grid_in", stat_energy_to: "sensor.grid_out" },
      { type: "battery", stat_energy_to: "external:bat_charge", stat_energy_from: "sensor.bat_out" },
    ],
  };
  const ids = moreIds(
    {
      solar_power_entity: "sensor.pv_w",
      grid_import_power_entity: "sensor.imp_w",
      grid_export_power_entity: "sensor.exp_w",
      soc_entity: "sensor.soc",
      forecast_today_entity: "sensor.fc",
    },
    { battery_power_entity: "sensor.bat_w" },
    prefs,
  );
  assert.equal(ids.solar, "sensor.pv_w");
  assert.equal(ids.grid_import, "sensor.imp_w");
  assert.equal(ids.grid_export, "sensor.exp_w");
  assert.equal(ids.battery, "sensor.bat_w");
  assert.equal(ids.e_grid_import, "sensor.grid_in");
  assert.equal(ids.e_solar, "sensor.pv_energy");
  assert.equal(ids.e_battery_charge, undefined);
  assert.equal(ids.e_battery_discharge, "sensor.bat_out");
  assert.equal(ids.forecast, "sensor.fc");
  assert.equal(ids.house, undefined);
});

test("one grid entity serves import and export; a *_stat option wins over the dashboard", () => {
  const ids = moreIds(
    { grid_power_entity: "sensor.grid_w", solar_stat: "sensor.mine" },
    {},
    { energy_sources: [{ type: "solar", stat_energy_from: "sensor.pv_energy" }] },
  );
  assert.equal(ids.grid_import, "sensor.grid_w");
  assert.equal(ids.grid_export, "sensor.grid_w");
  assert.equal(ids.e_solar, "sensor.mine");
});

test("links only for entity ids", () => {
  assert.equal(moreAttrs(undefined), "");
  assert.match(moreAttrs("sensor.a"), /data-more="sensor\.a" role="button" tabindex="0"/);
  assert.equal(moreSpan(null, "x"), "x");
  assert.match(moreSpan("sensor.a", "PV 1 kW"), /<span class="more" data-more="sensor\.a"[^>]*>PV 1 kW<\/span>/);
});

test("the readout over the power chart links each value to its entity", async () => {
  const { powerReadoutHTML } = await import("../src/sections.js");
  const t = (k) =>
    ({ consumption: "Verbrauch", pv: "PV", battery: "Akku", grid_import: "Netzbezug", grid_export: "Einspeisung" })[
      k
    ] || k;
  const series = { house: [200], pv: [340], soc: [35], grid_import: [0], grid_export: [0] };
  const [l1, l2] = powerReadoutHTML(series, 0, {
    t,
    lang: "de",
    more: { solar: "sensor.pv", grid_import: "sensor.imp" },
  });
  assert.match(l1, /data-more="sensor\.pv"[^>]*>PV 340 W</);
  assert.match(l1, /^Verbrauch 200 W · /);
  assert.match(l2, /data-more="sensor\.imp"[^>]*>Netzbezug 0 W</);
  assert.match(l2, / · Einspeisung 0 W$/);
});

test("house_info_entity only names the consumption's dialog", () => {
  assert.equal(moreIds({ house_info_entity: "sensor.meter" }).house, "sensor.meter");
  assert.equal(moreIds({ house_power_entity: "sensor.home", house_info_entity: "sensor.meter" }).house, "sensor.home");
});
