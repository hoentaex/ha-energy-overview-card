// Fake `hass` for the demo page and the screenshots. A balcony PV system with a 1.6 kWh battery is simulated
// in 5-minute steps over the last 75 days (deterministic, seeded per day); statistics, history, forecast and the
// live states all come from that one simulation, so the numbers agree with each other.
import { sunTimes } from "../src/sun.js";
import { parts, zoned } from "../src/tz.js";

export const TZ = "Europe/Berlin";
const LAT = 52.52;
const LON = 13.405;
const STEP = 5 * 60e3;
const CAP = 1600; // Wh
const PREFS = {
  energy_sources: [
    {
      type: "grid",
      stat_energy_from: "sensor.stromverbrauch_berechnung_neu",
      stat_energy_to: "sensor.einspeisung_berechnung",
      stat_rate: "sensor.netzleistung_kombiniert",
    },
    {
      type: "battery",
      stat_energy_from: "sensor.pv_discharge_battery_energy",
      stat_energy_to: "sensor.pv_charge_battery_energy",
      stat_rate: "sensor.solarbank_2_e1600_ac_akkuleistung_inverted",
    },
    {
      type: "solar",
      stat_energy_from: "sensor.pv_power_from_solar_energy",
      config_entry_solar_forecast: ["demo_forecast"],
      stat_rate: "sensor.pv_power_from_solar",
    },
  ],
  device_consumption: [],
};

export const CONFIG = {
  name: "Energie Zuhause",
  subtitle: "Balkonkraftwerk · Solarbank 2 E1600 AC",
  solar_power_entity: "sensor.pv_power_from_solar",
  grid_power_entity: "sensor.netzleistung_kombiniert",
  battery_power_entity: "sensor.solarbank_2_e1600_ac_akkuleistung",
  house_power_entity: "sensor.stromverbrauch_gesamt_real",
  soc_entity: "sensor.pv_batterie_soc",
  capacity_kwh: 1.6,
  consumption_stat: "sensor.stromverbrauch_gesamt_real_daily",
  battery_grid_charge_stat: "sensor.akkuladung_von_netz_energy_daily",
  forecast_today_entity: "sensor.energy_production_today",
};

// ---------- simulation ----------

const rnd = (seed) => {
  let x = Math.sin(seed * 12.9898) * 43758.5453;
  x -= Math.floor(x);
  return x;
};
const dayNo = (t) => Math.floor((t + 3600e3) / 864e5);
const sunCache = new Map();
const sunOf = (t) => {
  const k = dayNo(t);
  if (!sunCache.has(k)) sunCache.set(k, sunTimes(new Date(t), LAT, LON, TZ));
  return sunCache.get(k);
};

/** PV power (W) at t without clouds noise beyond the day's weather. */
const pvAt = (t, noise = true) => {
  const { rise, set } = sunOf(t);
  if (!rise || t <= rise.getTime() || t >= set.getTime()) return 0;
  const x = (t - rise.getTime()) / (set.getTime() - rise.getTime());
  const weather = 0.25 + 0.75 * rnd(dayNo(t) * 3.1);
  const cloud = noise ? 0.75 + 0.5 * rnd(t / STEP) : 1;
  return Math.max(0, 760 * Math.sin(Math.PI * x) ** 1.4 * weather * cloud);
};

const loadAt = (t) => {
  const p = parts(t, TZ);
  const h = p.h + p.mi / 60;
  const base = 150 + 60 * Math.sin(((h - 6) / 24) * 2 * Math.PI);
  const evening = h >= 17.5 && h < 22.5 ? 260 * Math.sin(((h - 17.5) / 5) * Math.PI) : 0;
  const morning = h >= 6.5 && h < 8.5 ? 180 : 0;
  const r = rnd(t / STEP + 0.5);
  const spike = r > 0.985 ? 1600 : r > 0.95 ? 500 : 0;
  return base + evening + morning + spike + 40 * rnd(t / STEP + 7);
};

let SIM = null;
const simulate = () => {
  const now = Math.floor(Date.now() / STEP) * STEP;
  if (SIM && SIM.now === now) return SIM;
  const start = now - 75 * 864e5;
  const rows = [];
  let e = 0.4 * CAP;
  for (let t = start; t <= now; t += STEP) {
    const pv = pvAt(t);
    const load = loadAt(t);
    const p = parts(t, TZ);
    let ch = 0;
    let gc = 0;
    let dis = 0;
    let imp = 0;
    let exp = 0;
    const surplus = pv - load;
    if (surplus > 0) {
      ch = Math.min(surplus, 800, ((CAP - e) * 12) / 0.95);
      exp = surplus - ch;
    } else {
      dis = Math.min(-surplus, 800, Math.max(0, (e - 0.1 * CAP) * 12));
      imp = -surplus - dis;
    }
    if (p.h >= 3 && p.h < 4 && e < 0.3 * CAP && dayNo(t) % 3 === 0) {
      gc = 400;
      imp += gc;
    }
    e = Math.max(0, Math.min(CAP, e + ((ch + gc) * 0.95 - dis) / 12));
    rows.push({ t, pv, load, ch, gc, dis, imp, exp, soc: (e / CAP) * 100 });
  }
  SIM = { now, start, rows };
  return SIM;
};

const STAT_FIELD = {
  "sensor.pv_power_from_solar_energy": (r) => r.pv,
  "sensor.einspeisung_berechnung": (r) => r.exp,
  "sensor.stromverbrauch_berechnung_neu": (r) => r.imp,
  "sensor.pv_charge_battery_energy": (r) => r.ch + r.gc,
  "sensor.pv_discharge_battery_energy": (r) => r.dis,
  "sensor.akkuladung_von_netz_energy_daily": (r) => r.gc,
  "sensor.stromverbrauch_gesamt_real_daily": (r) => r.load,
};
const POWER_FIELD = {
  "sensor.pv_power_from_solar": (r) => r.pv,
  "sensor.netzleistung_kombiniert": (r) => r.imp - r.exp,
  "sensor.solarbank_2_e1600_ac_akkuleistung": (r) => r.ch + r.gc - r.dis,
  "sensor.solarbank_2_e1600_ac_akkuleistung_inverted": (r) => r.dis - r.ch - r.gc,
  "sensor.stromverbrauch_gesamt_real": (r) => r.load,
  "sensor.pv_batterie_soc": (r) => r.soc,
};

/** Bucket starts between two instants: hours, or days at Berlin midnight. */
const buckets = (from, to, period) => {
  const out = [];
  if (period === "hour") for (let t = from; t < to; t += 3600e3) out.push([t, t + 3600e3]);
  else {
    const p = parts(from, TZ);
    for (let i = 0; ; i++) {
      const a = zoned(p.y, p.m, p.d + i, 0, TZ).getTime();
      if (a >= to) break;
      out.push([a, zoned(p.y, p.m, p.d + i + 1, 0, TZ).getTime()]);
    }
  }
  return out;
};

const statistics = (msg) => {
  const { rows } = simulate();
  const from = Date.parse(msg.start_time);
  const to = Date.parse(msg.end_time);
  const res = {};
  for (const id of msg.statistic_ids) {
    const f = STAT_FIELD[id];
    if (!f) continue;
    res[id] = buckets(from, to, msg.period)
      .map(([a, b]) => {
        const inside = rows.filter((r) => r.t >= a && r.t < b);
        if (!inside.length) return null;
        return { start: a, end: b, change: inside.reduce((s, r) => s + f(r), 0) / 12 / 1000 };
      })
      .filter(Boolean);
  }
  return res;
};

const history = (msg) => {
  const { rows } = simulate();
  const from = Date.parse(msg.start_time);
  const to = Date.parse(msg.end_time);
  const res = {};
  for (const id of msg.entity_ids) {
    const f = POWER_FIELD[id];
    if (!f) continue;
    res[id] = rows.filter((r) => r.t >= from && r.t < to).map((r) => ({ s: f(r).toFixed(1), lu: r.t / 1000 }));
  }
  return res;
};

const forecast = () => {
  const p = parts(Date.now(), TZ);
  const day = zoned(p.y, p.m, p.d, 0, TZ).getTime();
  const wh = {};
  for (let h = 0; h < 24; h++) {
    const t = day + h * 3600e3;
    let sum = 0;
    for (let m = 0; m < 12; m++) sum += pvAt(t + m * STEP, false) / 12;
    wh[new Date(t).toISOString()] = Math.round(sum * (0.85 + 0.3 * rnd(h + dayNo(t))));
  }
  return { demo_forecast: { wh_hours: wh } };
};

// ---------- hass ----------

const st = (state, unit, extra = {}) => ({ state: String(state), attributes: { unit_of_measurement: unit, ...extra } });

/** Live overrides per scenario (W / %); "sim" uses the simulation's latest step. */
export const SCENARIOS = {
  sim: null,
  night: { pv: 0, load: 214, imp: 214, exp: 0, ch: 0, gc: 0, dis: 0, soc: 10 },
  noon: { pv: 1050, load: 230, imp: 0, exp: 300, ch: 520, gc: 0, dis: 0, soc: 64 },
  evening: { pv: 0, load: 410, imp: 30, exp: 0, ch: 0, gc: 0, dis: 380, soc: 55 },
  gridcharge: { pv: 0, load: 180, imp: 580, exp: 0, ch: 0, gc: 400, dis: 0, soc: 22 },
};

export function makeHass({ lang = "de", scenario = "sim", minimal = false } = {}) {
  const { rows } = simulate();
  const r = SCENARIOS[scenario] || rows.at(-1);
  const states = {};
  for (const [id, f] of Object.entries(POWER_FIELD)) states[id] = st(f(r).toFixed(0), id.endsWith("_soc") ? "%" : "W");
  const fc = Object.values(forecast().demo_forecast.wh_hours).reduce((a, b) => a + b, 0) / 1000;
  states["sensor.energy_production_today"] = st(fc.toFixed(3), "kWh");
  const sun = sunOf(Date.now());
  states["sun.sun"] = {
    state: "above_horizon",
    attributes: { next_rising: sun.rise?.toISOString(), next_setting: sun.set?.toISOString() },
  };
  const handlers = {
    "energy/get_prefs": PREFS,
    "recorder/statistics_during_period": statistics,
    "history/history_during_period": history,
    "energy/solar_forecast": forecast,
  };
  return {
    language: lang,
    locale: { language: lang },
    config: { time_zone: TZ, latitude: LAT, longitude: LON },
    states,
    callWS: async (msg) => {
      await new Promise((res) => setTimeout(res, 30));
      const h = handlers[msg.type];
      if (!h) throw new Error(`unknown ${msg.type}`);
      return typeof h === "function" ? h(msg) : h;
    },
    _minimal: minimal,
  };
}
