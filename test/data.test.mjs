// Runs with TZ=Europe/Berlin (see package.json).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  Cache,
  expiryFor,
  fetchForecast,
  fetchPeriodEnergy,
  fetchPowerDay,
  forecastSlots,
  grid,
  historyPoints,
  resample,
  toSlots,
} from "../src/data.js";
import { periodRange } from "../src/period.js";

const prefs = JSON.parse(readFileSync(new URL("./fixtures/prefs-home.json", import.meta.url)));
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const t = (s) => new Date(s).getTime();
const NOW = t("2026-11-14T13:20");

/** Fake hass whose callWS answers by message type and records the calls. */
const fakeHass = (handlers, extra = {}) => {
  const calls = [];
  return {
    calls,
    ...extra,
    callWS: async (msg) => {
      calls.push(msg);
      const h = handlers[msg.type];
      if (!h) throw new Error(`unexpected ${msg.type}`);
      return typeof h === "function" ? h(msg) : h;
    },
  };
};

const row = (start, change) => ({ start: t(start), end: t(start) + 3600e3, change });

test("expiry: past periods never, the current one after 5 min or at the full hour", () => {
  const day = periodRange("day", new Date(NOW));
  assert.equal(expiryFor(periodRange("day", new Date("2026-11-13")), NOW), Number.POSITIVE_INFINITY);
  assert.equal(expiryFor(day, NOW), NOW + 5 * 60e3);
  assert.equal(expiryFor(day, t("2026-11-14T13:58")), t("2026-11-14T14:00"));
});

test("cache shares in-flight requests, keeps until expiry, drops failures", async () => {
  let clock = 0;
  const cache = new Cache(() => clock);
  let n = 0;
  const load = async () => ++n;
  const [a, b] = await Promise.all([cache.get("k", 100, load), cache.get("k", 100, load)]);
  assert.deepEqual([a, b, n], [1, 1, 1]);
  clock = 150;
  assert.equal(await cache.get("k", 300, load), 2);
  await assert.rejects(cache.get("bad", 1e9, async () => Promise.reject(new Error("x"))));
  assert.equal(await cache.get("bad", 1e9, async () => "ok"), "ok");
});

test("toSlots matches rows by time (ms or ISO), sums, leaves gaps null", () => {
  const range = periodRange("day", new Date(NOW));
  const out = toSlots(
    [row("2026-11-14T00:00", 0.2), { start: "2026-11-14T01:00:00+01:00", change: 0.3 }, row("2026-11-14T03:00", null)],
    range.slots,
  );
  assert.equal(out[0], 0.2);
  assert.equal(out[1], 0.3);
  assert.equal(out[2], null);
  assert.equal(out[3], null);
});

test("period energy of 14.11. from the statistics: one request, summed split, overrides", async () => {
  const range = periodRange("day", new Date(NOW));
  const res = {
    "sensor.pv_power_from_solar_energy": [row("2026-11-14T11:00", 2.51), row("2026-11-14T12:00", 2.0)],
    "sensor.einspeisung_berechnung": [row("2026-11-14T12:00", 1.92)],
    "sensor.pv_charge_battery_energy": [row("2026-11-14T03:00", 0.43), row("2026-11-14T11:00", 1.17)],
    "sensor.akkuladung_von_netz_energy_daily": [row("2026-11-14T03:00", 0.43)],
    "sensor.pv_discharge_battery_energy": [row("2026-11-14T19:00", 1.18)],
    "sensor.stromverbrauch_berechnung_neu": [row("2026-11-14T03:00", 0.43)],
    "sensor.stromverbrauch_gesamt_real_daily": [
      row("2026-11-14T11:00", 1.34),
      row("2026-11-14T12:00", 0.08),
      row("2026-11-14T19:00", 1.18),
      row("2026-11-14T20:00", 3.51),
    ],
  };
  const hass = fakeHass({ "recorder/statistics_during_period": res });
  const cache = new Cache(() => NOW);
  const config = {
    consumption_stat: "sensor.stromverbrauch_gesamt_real_daily",
    battery_grid_charge_stat: "sensor.akkuladung_von_netz_energy_daily",
  };
  const e = await fetchPeriodEnergy(hass, cache, config, prefs, range, NOW);
  assert.equal(hass.calls.length, 1);
  assert.equal(hass.calls[0].period, "hour");
  assert.deepEqual(hass.calls[0].types, ["change"]);
  assert.equal(hass.calls[0].statistic_ids.length, 7);
  close(e.total.solar, 4.51);
  close(e.total.consumption, 6.11);
  close(e.total.pv_to_battery, 1.17);
  close(e.total.grid_to_battery, 0.43);
  close(e.total.pv_to_house, 1.42);
  close(e.total.house_from_battery, 1.18);
  close(e.total.house_from_grid, 3.51);
  close(e.total.autarky, 2.6 / 6.11);
  assert.equal(e.split[5], null);
  assert.ok(e.hasData);
  await fetchPeriodEnergy(hass, cache, config, prefs, range, NOW);
  assert.equal(hass.calls.length, 1, "second call is served from the cache");
});

test("period energy without any source does not call the websocket", async () => {
  const hass = fakeHass({});
  const e = await fetchPeriodEnergy(hass, new Cache(), {}, null, periodRange("week", new Date(NOW)), NOW);
  assert.equal(hass.calls.length, 0);
  assert.equal(e.hasData, false);
  assert.equal(e.total.autarky, null);
});

test("resample: time-weighted mean, null after now and in gaps", () => {
  const range = periodRange("day", new Date(NOW));
  const cells = grid(range, 15);
  assert.equal(cells.length, 96);
  assert.equal(grid(periodRange("day", new Date("2026-10-25T12:00")), 15).length, 100);
  const pts = [
    { t: t("2026-11-14T00:00"), v: 100 },
    { t: t("2026-11-14T00:05"), v: 400 },
    { t: t("2026-11-14T00:30"), v: null },
    { t: t("2026-11-14T00:45"), v: 50 },
  ];
  const out = resample(pts, cells, 15, NOW);
  close(out[0], (100 * 5 + 400 * 10) / 15);
  close(out[1], 400);
  assert.equal(out[2], null);
  close(out[3], 50);
  assert.equal(out[54], null); // 13:30 lies after now (13:20)
  close(out[53], 50);
  assert.equal(out[55], null);
});

test("history points from the compressed format, kW converted", () => {
  const p = historyPoints(
    [
      { s: "1.5", lu: 1763100000 },
      { s: "unavailable", lu: 1763100060.5 },
    ],
    1000,
  );
  assert.deepEqual(p, [
    { t: 1763100000000, v: 1500 },
    { t: 1763100060500, v: null },
  ]);
});

test("power day: history first, then 5-minute statistics for entities without history", async () => {
  const range = periodRange("day", new Date("2026-11-10T12:00"));
  const hass = fakeHass(
    {
      "history/history_during_period": {
        "sensor.pv": [{ s: "200", lu: t("2026-11-10T00:00") / 1000 }],
        "sensor.grid": [],
      },
      "recorder/statistics_during_period": (msg) => {
        assert.equal(msg.period, "5minute");
        assert.deepEqual(msg.types, ["mean"]);
        return {
          "sensor.grid": [
            { start: t("2026-11-10T00:00"), end: t("2026-11-10T00:05"), mean: 300 },
            { start: t("2026-11-10T00:05"), end: t("2026-11-10T00:10"), mean: 600 },
          ],
        };
      },
    },
    { states: {} },
  );
  const p = await fetchPowerDay(hass, new Cache(() => NOW), ["sensor.pv", "sensor.grid"], range, 5, NOW);
  assert.equal(p.cells.length, 288);
  assert.equal(p.source["sensor.pv"], "history");
  assert.equal(p.source["sensor.grid"], "5minute");
  assert.equal(p.series["sensor.pv"][287], 200);
  assert.equal(p.series["sensor.grid"][1], 600);
  assert.equal(p.series["sensor.grid"][2], null);
});

test("forecast: hourly kWh for today's slots, only configured entries", async () => {
  const range = periodRange("day", new Date(NOW));
  const res = {
    "27b30f56a98428a56f1c046ba9755737": {
      wh_hours: {
        "2026-11-14T10:00:00+01:00": 450,
        "2026-11-14T11:00:00+01:00": 620,
        "2026-11-15T10:00:00+01:00": 999,
      },
    },
    other: { wh_hours: { "2026-11-14T10:00:00+01:00": 1000 } },
  };
  const slots = forecastSlots(res, range, ["27b30f56a98428a56f1c046ba9755737"]);
  close(slots[10], 0.45);
  close(slots[11], 0.62);
  close(
    slots.reduce((a, b) => a + b, 0),
    1.07,
  );
  assert.equal(forecastSlots({}, range), null);
  const hass = fakeHass({ "energy/solar_forecast": res });
  assert.equal(await fetchForecast(hass, new Cache(), range, []), null);
  assert.equal(hass.calls.length, 0);
  close((await fetchForecast(hass, new Cache(), range, ["other"]))[10], 1);
});
