// Energy sources (Energy dashboard prefs + overrides), the per-slot split, the live values and the status.

/** Statistic keys of the card, each overridable by a `<key>_stat` option. */
export const STAT_KEYS = [
  "solar",
  "grid_import",
  "grid_export",
  "battery_charge",
  "battery_discharge",
  "battery_grid_charge",
  "consumption",
];

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter((s) => typeof s === "string" && s);
const push = (map, key, ...ids) => map[key].push(...ids.filter(Boolean));

/**
 * Statistic ids per key from the Energy dashboard prefs (`energy/get_prefs`).
 * Grid sources come in two shapes: flat `stat_energy_from` / `stat_energy_to` (newer cores) or
 * `flow_from[]` / `flow_to[]` (older cores). Battery: `stat_energy_to` = charge, `stat_energy_from` = discharge.
 */
export function prefsSources(prefs) {
  const out = Object.fromEntries(STAT_KEYS.map((k) => [k, []]));
  for (const src of prefs?.energy_sources || []) {
    if (src.type === "solar") push(out, "solar", src.stat_energy_from);
    else if (src.type === "battery") {
      push(out, "battery_charge", src.stat_energy_to);
      push(out, "battery_discharge", src.stat_energy_from);
    } else if (src.type === "grid") {
      push(out, "grid_import", src.stat_energy_from, ...(src.flow_from || []).map((f) => f.stat_energy_from));
      push(out, "grid_export", src.stat_energy_to, ...(src.flow_to || []).map((f) => f.stat_energy_to));
    }
  }
  return out;
}

/** Final statistic ids per key: a `<key>_stat` option (string or list) wins over the prefs. */
export function resolveSources(config, prefs) {
  const fromPrefs = prefsSources(prefs);
  return Object.fromEntries(
    STAT_KEYS.map((k) => {
      const own = list(config?.[`${k}_stat`]);
      return [k, own.length ? own : fromPrefs[k]];
    }),
  );
}

/** Solar forecast config entries from the prefs (for `energy/solar_forecast`). */
export const forecastEntries = (prefs) =>
  (prefs?.energy_sources || []).filter((s) => s.type === "solar").flatMap((s) => s.config_entry_solar_forecast || []);

/**
 * Live power entities from the prefs (`stat_rate`, newer cores). The Energy dashboard counts battery power
 * positive while discharging; the card counts it positive while charging, hence `battery_sign: -1`.
 */
export function prefsLive(prefs) {
  const out = {};
  for (const src of prefs?.energy_sources || []) {
    if (!src.stat_rate) continue;
    if (src.type === "solar" && !out.solar_power_entity) out.solar_power_entity = src.stat_rate;
    if (src.type === "grid" && !out.grid_power_entity) out.grid_power_entity = src.stat_rate;
    if (src.type === "battery" && !out.battery_power_entity) {
      out.battery_power_entity = src.stat_rate;
      out.battery_sign = -1;
    }
  }
  return out;
}

const pos = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
const num = (v) => (Number.isFinite(v) ? v : 0);

/**
 * Splits one slot (kWh). Inputs may be null (no statistic). Without `consumption` it is estimated as
 * PV + import − export + discharge − charge. `battery_charge` already contains the grid charge.
 */
export function splitSlot(v) {
  const solar = pos(v.solar);
  const gridExport = pos(v.grid_export);
  const charge = pos(v.battery_charge);
  const gridCharge = Math.min(pos(v.battery_grid_charge), charge);
  const discharge = pos(v.battery_discharge);
  const consumption = Number.isFinite(v.consumption)
    ? pos(v.consumption)
    : pos(solar + num(v.grid_import) - gridExport + discharge - charge);
  const pvToBattery = pos(charge - gridCharge);
  const pvToHouse = pos(solar - gridExport - pvToBattery);
  const houseFromBattery = Math.min(discharge, consumption);
  const houseFromGrid = pos(consumption - pvToHouse - houseFromBattery);
  return {
    solar,
    consumption,
    grid_import: pos(v.grid_import),
    grid_export: gridExport,
    battery_charge: charge,
    battery_discharge: discharge,
    pv_to_house: pvToHouse,
    pv_to_battery: pvToBattery,
    pv_to_grid: gridExport,
    grid_to_battery: gridCharge,
    house_from_solar: pvToHouse,
    house_from_battery: houseFromBattery,
    house_from_grid: houseFromGrid,
  };
}

/** Sums split slots and adds self-sufficiency, self-consumption and CO₂ saved. Ratios are null without data. */
export function summarize(slots, co2Factor = 0.4) {
  const total = {};
  for (const s of slots) for (const [k, val] of Object.entries(s)) total[k] = (total[k] || 0) + val;
  const consumption = total.consumption || 0;
  const solar = total.solar || 0;
  const used = pos(solar - (total.grid_export || 0));
  return {
    ...total,
    autarky:
      consumption > 0 ? Math.min(1, ((total.pv_to_house || 0) + (total.house_from_battery || 0)) / consumption) : null,
    self_consumption: solar > 0 ? used / solar : null,
    co2_kg: used * co2Factor,
  };
}

// ---- live ----

const numState = (hass, id) => {
  const s = id && hass?.states?.[id];
  if (!s) return null;
  const n = Number.parseFloat(s.state);
  if (!Number.isFinite(n)) return null;
  const unit = String(s.attributes?.unit_of_measurement || "").toLowerCase();
  return unit === "kw" ? n * 1000 : unit === "mw" ? n * 1e6 : n;
};

/**
 * Live values in W (all ≥ 0) from the config, falling back to the prefs' `stat_rate` entities.
 * grid: + import / − export (`invert_grid`); battery: + charge / − discharge (`invert_battery`).
 */
export function readLive(hass, config, live = {}) {
  const c = { ...live, ...config };
  const solar = numState(hass, c.solar_power_entity);
  let gridImport = null;
  let gridExport = null;
  if (config.grid_import_power_entity || config.grid_export_power_entity) {
    gridImport = numState(hass, config.grid_import_power_entity);
    gridExport = numState(hass, config.grid_export_power_entity);
  } else {
    const g = numState(hass, c.grid_power_entity);
    if (g !== null) {
      const v = config.invert_grid ? -g : g;
      gridImport = pos(v);
      gridExport = pos(-v);
    }
  }
  let charge = null;
  let discharge = null;
  const b = numState(hass, c.battery_power_entity);
  if (b !== null) {
    const sign = config.battery_power_entity ? 1 : live.battery_sign || 1;
    const v = (config.invert_battery ? -1 : 1) * sign * b;
    charge = pos(v);
    discharge = pos(-v);
  }
  let house = numState(hass, c.house_power_entity);
  if (house === null && (solar !== null || gridImport !== null))
    house = pos(num(solar) + num(gridImport) - num(gridExport) + num(discharge) - num(charge));
  const soc = numState(hass, c.soc_entity);
  const capacity = numState(hass, c.capacity_entity) ?? (Number(c.capacity_kwh) || null);
  return {
    solar: solar === null ? null : pos(solar),
    grid_import: gridImport,
    grid_export: gridExport,
    battery_charge: charge,
    battery_discharge: discharge,
    house,
    soc,
    capacity_kwh: capacity,
  };
}

/**
 * Status pill: grid_house | pv_charging | pv_house | battery_house | export. The dominant source wins, so a
 * battery covering 380 W with 30 W from the grid still reads "battery supplies home".
 */
export function deriveStatus(l, threshold = 10) {
  const on = (v) => Number.isFinite(v) && v > threshold;
  const w = (v) => (Number.isFinite(v) ? v : 0);
  if (on(l.solar) && on(l.battery_charge) && w(l.solar) >= w(l.grid_import)) return "pv_charging";
  if (on(l.grid_export)) return "export";
  if (on(l.battery_discharge) && w(l.battery_discharge) >= w(l.grid_import)) return "battery_house";
  if (on(l.grid_import)) return "grid_house";
  if (on(l.solar)) return "pv_house";
  return "grid_house";
}
