import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  byRoom,
  consumerEntities,
  consumerModel,
  consumerName,
  fmtW,
  kindOf,
  onSince,
  prefsConsumers,
  sinceText,
  sparkSeries,
  stackSegments,
  tidyName,
  viewHTML,
} from "../src/consumers.js";
import { translator } from "../src/shared.js";

// The card module defines custom elements: a bare HTMLElement and a registry that has them all are enough to load it.
globalThis.HTMLElement ??= class {};
globalThis.customElements ??= { get: () => true, define() {} };
const { consumersFromForm, consumersToForm } = await import("../src/consumerscard.js");

// Power sensors of a real installation: [entity, state, friendly name, device, device name, area, platform].
const rows = JSON.parse(readFileSync(new URL("./fixtures/power-sensors.json", import.meta.url), "utf8"));
const hass = { states: {}, entities: {}, devices: {}, areas: {} };
for (const [id, state, fn, dev, dn, area, platform] of rows) {
  hass.states[id] = { state, attributes: { device_class: "power", unit_of_measurement: "W", friendly_name: fn } };
  if (dev) {
    const aid = area ? area.toLowerCase() : null;
    hass.devices[dev] = { name: dn, area_id: aid };
    if (aid) hass.areas[aid] = { name: area };
    hass.entities[id] = { entity_id: id, device_id: dev, platform };
  } else hass.entities[id] = { entity_id: id, platform: "template" };
}
const prefs = {
  energy_sources: [
    { type: "grid", stat_rate: "sensor.netzleistung_kombiniert" },
    { type: "solar", stat_rate: "sensor.pv_power_from_solar" },
  ],
};

test("detection: device power sensors, no generation / grid / meters / totals / plug self-use", () => {
  const ids = consumerEntities(hass, {}, prefs).map((e) => e.entity);
  for (const id of [
    "sensor.server_rack_10_power",
    "sensor.athene_server_switch_0_power",
    "sensor.steckdose_wohnzimmer_output_4_hephaistos_leistung",
    "sensor.kuche_sonos_switch_0_power",
    "sensor.wohnzimmer_power",
    "sensor.staubsauger_power",
  ])
    assert.ok(ids.includes(id), id);
  for (const id of [
    "sensor.sum_power_iot_devices",
    "sensor.stromverbrauch_gesamt_real",
    "sensor.server_rack_10_device_power",
    "sensor.shelly_stromzahler_phase_b_active_power",
    "sensor.balkonkraftwerk_power",
    "sensor.balkon_sud_power",
    "sensor.power_production_now",
    "sensor.dach_leistung_ac",
    "sensor.smartmeter_ip_wirkleistung",
    "sensor.system_hausbedarf",
    "sensor.solarbank_2_e1600_ac_ac_steckdose",
    "sensor.stromzahler_dg_netzbezug",
    "sensor.px30_evb_battery_power",
  ])
    assert.ok(!ids.includes(id), id);
});

test("detection: exclude list, explicit entities, Energy dashboard devices", () => {
  const ex = consumerEntities(hass, { exclude: ["sensor.wohnzimmer_schreibtisch_power"] }, prefs);
  assert.ok(!ex.some((e) => e.entity === "sensor.wohnzimmer_schreibtisch_power"));
  assert.deepEqual(consumerEntities(hass, { entities: ["sensor.a", { entity: "sensor.b", name: "B" }] }, prefs), [
    { entity: "sensor.a" },
    { entity: "sensor.b", name: "B" },
  ]);
  const dash = {
    device_consumption: [
      { stat_consumption: "sensor.leiste_kwh", stat_rate: "sensor.leiste_w", name: "Leiste" },
      { stat_consumption: "sensor.pc_kwh", stat_rate: "sensor.pc_w", included_in_stat: "sensor.leiste_kwh" },
      { stat_consumption: "sensor.tv_kwh" },
    ],
  };
  // The power strip is the parent of the PC: only the PC counts; the TV has no power sensor.
  assert.deepEqual(prefsConsumers(dash), [{ entity: "sensor.pc_w", name: undefined }]);
  assert.deepEqual(consumerEntities(hass, {}, dash), [{ entity: "sensor.pc_w", name: undefined }]);
});

test("names: device name when it is not technical, else a tidied friendly name", () => {
  const n = (id) => consumerName(hass, { entity: id });
  assert.equal(n("sensor.athene_server_switch_0_power"), "Athene Server");
  assert.equal(n("sensor.steckdose_wohnzimmer_output_4_hephaistos_leistung"), "Hephaistos");
  assert.equal(n("sensor.kuche_sonos_switch_0_power"), "Küche Sonos");
  assert.equal(n("sensor.shelly_geschirrspuler_power"), "Geschirrspüler");
  assert.equal(n("sensor.spiegel_licht_power"), "Bad Licht Spiegel");
  assert.equal(
    n("sensor.steckdosenleiste_schreibtisch_3d_drucker_output_0_leistung"),
    "Steckdosenleiste Schreibtisch 3D Drucker",
  );
  assert.equal(consumerName(hass, { entity: "sensor.server_rack_10_power", name: "Rack" }), "Rack");
  assert.equal(tidyName("Shelly Ladestation Wohnzimme Ladestation Leistung"), "Ladestation Wohnzimme Ladestation");
});

test("kinds from names", () => {
  assert.equal(kindOf("Server Rack 10"), "server");
  assert.equal(kindOf("Steckdosenleiste Schreibtisch 3D Drucker"), "printer");
  assert.equal(kindOf("WLED Küche Unterschranklicht"), "light");
  assert.equal(kindOf("Küche Sonos"), "media");
  assert.equal(kindOf("TV Schalter Haupt"), "tv");
  assert.equal(kindOf("Geschirrspüler"), "appliance");
  assert.equal(kindOf("Staubsauger"), "charge");
  assert.equal(kindOf("Sideboard"), "plug");
});

test("model: sorted, threshold, shares of the home, untracked rest, rooms", () => {
  const items = consumerEntities(hass, { exclude: ["sensor.wohnzimmer_schreibtisch_power"] }, prefs);
  const m = consumerModel(hass, { min_power: 1 }, items, { house: 334.7 });
  assert.equal(m.active[0].name, "Steckdosenleiste Schreibtisch 3D Drucker");
  assert.ok(m.active.every((c, i) => i === 0 || m.active[i - 1].w >= c.w));
  assert.ok(m.active.every((c) => c.w >= 1));
  assert.ok(m.idle.some((c) => c.id === "sensor.ladestation_schlafzimmer_leistung"));
  assert.ok(!m.idle.some((c) => c.id === "sensor.midea_ac_152832117159081_power"), "unavailable left out");
  assert.ok(Math.abs(m.untracked - (334.7 - m.sum)) < 1e-9);
  assert.equal(m.active[0].color, "var(--eoc-c1)");
  assert.equal(m.active[6].color, "var(--eoc-c0)");
  const segs = stackSegments(m);
  assert.deepEqual(
    segs.slice(-2).map((s) => s.key),
    ["others", "untracked"],
  );
  const rooms = byRoom(m.active);
  assert.equal(rooms[0].area, "Büro");
  // Untracked off: no rest, shares of the devices' sum.
  const off = consumerModel(hass, { min_power: 1, show_untracked: false }, items, { house: 334.7 });
  assert.equal(off.untracked, null);
  // Home below the sum (meters disagree): shares against the sum, no negative rest.
  const low = consumerModel(hass, { min_power: 1 }, items, { house: 50 });
  assert.equal(low.untracked, 0);
  assert.ok(low.active.every((c) => c.share <= 1));
});

test("on since and sparkline from history", () => {
  const now = Date.UTC(2026, 10, 20, 18, 0);
  const pts = [
    { t: now - 300 * 60e3, v: 60 },
    { t: now - 90 * 60e3, v: 0.4 },
    { t: now - 38 * 60e3, v: 55 },
    { t: now - 10 * 60e3, v: 61 },
  ];
  assert.equal(onSince(pts, 1, now), now - 38 * 60e3);
  assert.equal(onSince([{ t: now - 3e6, v: 20 }], 1, now), Number.NEGATIVE_INFINITY);
  assert.equal(onSince([{ t: now - 3e6, v: 0 }], 1, now), null);
  const t = translator("de");
  assert.equal(sinceText(now - 38 * 60e3, t, now), "seit 38 min");
  assert.equal(sinceText(now - 134 * 60e3, t, now), "seit 2 h 14 min");
  assert.equal(sinceText(Number.NEGATIVE_INFINITY, t, now), "seit über 6 h");
  const s = sparkSeries(pts, now);
  assert.equal(s.length, 15);
  assert.ok(s[0] < 1 && s.at(-1) > 50);
});

test("formatting and views", () => {
  assert.equal(fmtW(5.28, "de"), "5,3 W");
  assert.equal(fmtW(64.2, "de"), "64 W");
  assert.equal(fmtW(1980, "de"), "1,98 kW");
  const items = consumerEntities(hass, {}, prefs);
  const m = consumerModel(hass, {}, items, { house: 400 });
  const ctx = { t: translator("de"), lang: "de", view: "list", now: Date.now(), maxItems: 0 };
  assert.match(viewHTML(m, ctx), /Nicht erfasst/);
  assert.match(viewHTML(m, { ...ctx, view: "room" }), /class="rh"><b>Büro/);
  assert.match(viewHTML(m, { ...ctx, view: "tiles" }), /class="ct wide"/);
  assert.equal((viewHTML(m, { ...ctx, maxItems: 3 }).match(/data-more=/g) || []).length, 3);
});

test("editor: entity objects from YAML survive, defaults are dropped", () => {
  const original = { entities: [{ entity: "sensor.a", name: "A" }, "sensor.b"], view: "room" };
  assert.deepEqual(consumersToForm({ include: [{ entity: "sensor.g", name: "Garten" }] }).include, ["sensor.g"]);
  const form = consumersToForm(original);
  assert.deepEqual(form.entities, ["sensor.a", "sensor.b"]);
  assert.equal(form.min_power, 1);
  const back = consumersFromForm({ ...form, entities: ["sensor.a", "sensor.c"] }, original);
  assert.deepEqual(back, { entities: [{ entity: "sensor.a", name: "A" }, "sensor.c"], view: "room" });
});

test("detection: sensors without a device but with a room (legacy Homematic), include for a sub-meter", () => {
  const st = (fn) => ({
    state: "50",
    attributes: { device_class: "power", unit_of_measurement: "W", friendly_name: fn },
  });
  const z = {
    states: {
      "sensor.0001d3c99c350c_power": st("Keller Serverschrank POWER"),
      "sensor.serverschrank_keller_stats": st("Serverschrank Keller Stats"),
      "sensor.stromzahler_garten_leistung": st("Stromzähler Garten Leistung"),
      "sensor.stromzahler_garten_phase_b_leistung": st("Stromzähler Garten Phase B Leistung"),
      "sensor.alpha_ess_total_power_inverter": st("AlphaESS Inverter Inverter Power"),
      "sensor.balkon_weihnachtsbeleuchtung_power": st("Balkon Weihnachtsbeleuchtung Leistung"),
    },
    entities: {
      "sensor.0001d3c99c350c_power": { platform: "homematic", area_id: "buro_keller" },
      "sensor.serverschrank_keller_stats": { platform: "template" },
      "sensor.stromzahler_garten_leistung": { platform: "shelly", device_id: "g" },
      "sensor.stromzahler_garten_phase_b_leistung": { platform: "shelly", device_id: "gb" },
      "sensor.alpha_ess_total_power_inverter": { platform: "alpha_ess", device_id: "a" },
      "sensor.balkon_weihnachtsbeleuchtung_power": { platform: "shelly", device_id: "w" },
    },
    devices: {
      g: { name: "Stromzähler Garten" },
      gb: { name: "Stromzähler Garten Phase B" },
      a: { name: "AlphaESS Inverter" },
      w: { name: "Balkon Weihnachtsbeleuchtung" },
    },
    areas: { buro_keller: { name: "Büro Keller" } },
  };
  const ids = (config) => consumerEntities(z, config, null).map((e) => e.entity);
  assert.deepEqual(ids({}), ["sensor.0001d3c99c350c_power", "sensor.balkon_weihnachtsbeleuchtung_power"]);
  assert.deepEqual(ids({ include: ["sensor.stromzahler_garten_leistung"] }), [
    "sensor.0001d3c99c350c_power",
    "sensor.balkon_weihnachtsbeleuchtung_power",
    "sensor.stromzahler_garten_leistung",
  ]);
  // include with a name, never twice, exclude wins.
  const withName = consumerEntities(
    z,
    { include: [{ entity: "sensor.stromzahler_garten_leistung", name: "Garten" }, "sensor.0001d3c99c350c_power"] },
    null,
  );
  assert.deepEqual(
    withName.map((e) => e.name || e.entity),
    ["sensor.0001d3c99c350c_power", "sensor.balkon_weihnachtsbeleuchtung_power", "Garten"],
  );
  assert.deepEqual(
    ids({ include: ["sensor.stromzahler_garten_leistung"], exclude: ["sensor.stromzahler_garten_leistung"] }),
    ["sensor.0001d3c99c350c_power", "sensor.balkon_weihnachtsbeleuchtung_power"],
  );
  assert.equal(consumerName(z, { entity: "sensor.0001d3c99c350c_power" }), "Keller Serverschrank");
  assert.equal(kindOf("Keller Serverschrank"), "server");
});
