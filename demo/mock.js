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
  weather_entity: "weather.home",
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
    const f = POWER_FIELD[id] || CONS_FIELD[id];
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


// ---------- consumers (custom:energy-overview-consumers-card) ----------

const hourAt = (t) => {
  const p = parts(t, TZ);
  return p.h + p.mi / 60;
};
const wobble = (t, seed, amp) => 1 + amp * (rnd(t / STEP + seed) - 0.5);
const between = (h, a, b) => h >= a && h < b;

// [entity, friendly name, device, area, W at time t (row r)]
const CONSUMERS = [
  ["sensor.athene_server_switch_0_power", "Athene Server Switch 0 power", "Athene Server", "buero", (t) => 11 * wobble(t, 1, 0.1)],
  ["sensor.server_rack_10_power", "Server Rack 10 Power", "Shelly Server Rack 10", "buero", (t) => 27 * wobble(t, 2, 0.08)],
  [
    "sensor.steckdose_wohnzimmer_output_4_hephaistos_leistung",
    "Steckdose Wohnzimmer Output 4 - Hephaistos Leistung",
    "shellypstripg4-98a31679bda8 Output 3",
    "wohnzimmer",
    (t) => 12.5 * wobble(t, 3, 0.15),
  ],
  [
    "sensor.schreibtisch_3d_drucker_output_0_leistung",
    "Schreibtisch 3D Drucker Output 0 Leistung",
    "shellypstripg4-58e6c50d62f8 Output 0",
    "buero",
    (t) => (between(hourAt(t), 9.5, 21) ? 62 * wobble(t, 4, 0.35) : 0.4),
  ],
  ["sensor.kuche_sonos_switch_0_power", "Küche Sonos Switch 0 power", "Shelly-Sonos", "kueche", (t) => (between(hourAt(t), 7, 23) ? 6 : 2.1) * wobble(t, 5, 0.1)],
  [
    "sensor.wled_kuche_unterschranklicht_power",
    "WLED Küche Unterschranklicht Power",
    "WLED-Gledopto",
    "kueche",
    (t) => (between(hourAt(t), 6.5, 8) || between(hourAt(t), 17, 23) ? 5.3 : 0.6),
  ],
  ["sensor.stehlampe_power", "Stehlampe Leistung", "Stehlampe", "buero", (t) => (between(hourAt(t), 16.5, 23.5) ? 4.8 : 0)],
  ["sensor.esszimmer_ambiente_power", "Esszimmer Ambiente Power", "Esszimmer Ambiente", "esszimmer", (t) => (between(hourAt(t), 17, 23) ? 2.9 : 0)],
  ["sensor.staubsauger_power", "Staubsauger Leistung", "Staubsauger", "esszimmer", (t) => 3.6 * wobble(t, 6, 0.2)],
  ["sensor.keller_heizung_power", "Keller Heizung Power", "Shelly Heizung Keller", "keller", (t) => 2.6],
  ["sensor.tv_schalter_haupt_power", "TV Schalter Haupt Leistung", "TV Schalter Haupt", "wohnzimmer", (t) => (between(hourAt(t), 19, 23) ? 78 * wobble(t, 7, 0.2) : 0)],
  ["sensor.wasserkocher_leistung", "Wasserkocher Leistung", "Matter Over WiFi Smart Switch", "kueche", (t, r) => (r && r.load > 1200 ? 1850 : 0)],
  ["sensor.geschirrspuler_current_power", "Geschirrspüler Aktuelle Leistung", "Geschirrspüler", "kueche", () => 0],
  ["sensor.waschmaschine_power", "Waschmaschine Leistung", "Waschmaschine", "keller", () => 0],
  ["sensor.kaffeemaschine_power", "Kaffeemaschine Power", "Kaffeemaschine", "kueche", () => 0],
  // Not consumers: the plug's own use (powercalc) and the balcony plant's inverter.
  ["sensor.server_rack_10_device_power", "Server Rack 10 Device Power", "Shelly Server Rack 10", "buero", () => 1.01],
  ["sensor.balkonkraftwerk_power", "Balkonkraftwerk Leistung", "Balkonkraftwerk", "aussen", (t, r) => (r ? r.pv : 0)],
];
const AREAS = { buero: "Büro", wohnzimmer: "Wohnzimmer", kueche: "Küche", esszimmer: "Esszimmer", keller: "Keller", aussen: "Außen" };
const CONS_FIELD = Object.fromEntries(CONSUMERS.map(([id, , , , f]) => [id, (r) => f(r.t, r)]));

/** Registry the way the frontend sees it: entities, devices and areas. */
const registry = () => {
  const entities = {};
  const devices = {};
  CONSUMERS.forEach(([id, , dev, area], i) => {
    const did = `dev_${dev.replace(/\W/g, "_").toLowerCase()}`;
    devices[did] = { id: did, name: dev, area_id: area };
    entities[id] = { entity_id: id, device_id: did, platform: id.includes("device_power") ? "powercalc" : "mqtt" };
    if (i === 0) entities[id].area_id = area;
  });
  devices.dev_solarbank = { id: "dev_solarbank", name: "Solarbank 2 E1600 AC", area_id: "aussen" };
  entities["sensor.solarbank_2_e1600_ac_akkuleistung"] = { entity_id: "sensor.solarbank_2_e1600_ac_akkuleistung", device_id: "dev_solarbank", platform: "anker_solix" };
  const areas = Object.fromEntries(Object.entries(AREAS).map(([id, name]) => [id, { area_id: id, name }]));
  return { entities, devices, areas };
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

/** Sun elevation (°) and weather per scenario, for the sky of the house scene. */
const SKY = {
  night: [-25, "clear-night"],
  noon: [32, "sunny"],
  evening: [3, "sunny"],
  gridcharge: [12, "rainy"],
};

export function makeHass({ lang = "de", scenario = "sim", minimal = false, weather = "" } = {}) {
  const { rows } = simulate();
  const r = SCENARIOS[scenario] || rows.at(-1);
  const states = {};
  for (const [id, f] of Object.entries(POWER_FIELD)) states[id] = st(f(r).toFixed(0), id.endsWith("_soc") ? "%" : "W");
  const last = rows.at(-1);
  for (const [id, name, , , f] of CONSUMERS)
    states[id] = st(f(Date.now(), { ...last, ...(SCENARIOS[scenario] || {}) }).toFixed(1), "W", { device_class: "power", friendly_name: name });
  for (const id of Object.keys(POWER_FIELD))
    if (!id.endsWith("_soc")) states[id].attributes.device_class = "power";
  const fc = Object.values(forecast().demo_forecast.wh_hours).reduce((a, b) => a + b, 0) / 1000;
  states["sensor.energy_production_today"] = st(fc.toFixed(3), "kWh");
  const sun = sunOf(Date.now());
  const now = Date.now();
  const [elevation, cond] = SKY[scenario] || [sun.rise <= now && now < sun.set ? 25 : -20, "partlycloudy"];
  states["sun.sun"] = {
    state: elevation > 0 ? "above_horizon" : "below_horizon",
    attributes: { next_rising: sun.rise?.toISOString(), next_setting: sun.set?.toISOString(), elevation },
  };
  states["weather.home"] = { state: weather || cond, attributes: { friendly_name: "Home" } };
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
    ...registry(),
    callWS: async (msg) => {
      await new Promise((res) => setTimeout(res, 30));
      const h = handlers[msg.type];
      if (!h) throw new Error(`unknown ${msg.type}`);
      return typeof h === "function" ? h(msg) : h;
    },
    _minimal: minimal,
  };
}
