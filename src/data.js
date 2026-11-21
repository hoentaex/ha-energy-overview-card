// Websocket fetchers with a cache: energy prefs, long-term statistics per period, the day's power history
// (history, falling back to 5-minute / hourly statistics) and today's solar forecast.
import { entityList, resolveSources, splitSlot, STAT_KEYS, summarize } from "./energy.js";
import { isCurrent } from "./period.js";

const MIN = 60e3;
const CURRENT_TTL = 5 * MIN;

const ms = (t) => (typeof t === "number" ? t : Date.parse(t));

/** Expiry of a cached result: past periods never expire, the current one after 5 min or at the full hour. */
export function expiryFor(range, now = Date.now()) {
  if (!isCurrent(range, new Date(now)))
    return range.end.getTime() <= now ? Number.POSITIVE_INFINITY : now + CURRENT_TTL;
  const nextHour = Math.ceil((now + 1) / (60 * MIN)) * 60 * MIN;
  return Math.min(now + CURRENT_TTL, nextHour);
}

/** Small promise cache: in-flight requests are shared, failures are not kept. */
export class Cache {
  constructor(now = () => Date.now()) {
    this._map = new Map();
    this._now = now;
  }

  get(key, expires, load) {
    const hit = this._map.get(key);
    if (hit && hit.expires > this._now()) return hit.promise;
    const promise = Promise.resolve()
      .then(load)
      .catch((err) => {
        if (this._map.get(key)?.promise === promise) this._map.delete(key);
        throw err;
      });
    this._map.set(key, { promise, expires });
    return promise;
  }

  clear() {
    this._map.clear();
  }
}

export const prefsRequest = () => ({ type: "energy/get_prefs" });

/** Energy prefs, or null when the Energy dashboard is not set up (the websocket call then fails). */
export const fetchPrefs = (hass, cache) =>
  cache.get("prefs", Date.now() + 10 * MIN, () => hass.callWS(prefsRequest()).catch(() => null));

export const statsRequest = (ids, range, types = ["change"], period = range.statPeriod) => ({
  type: "recorder/statistics_during_period",
  start_time: range.start.toISOString(),
  end_time: range.end.toISOString(),
  statistic_ids: ids,
  period,
  types,
  units: { energy: "kWh", power: "W" },
});

/** Maps statistic rows onto the period's slots (sum of `field` per slot; null where no row falls in). */
export function toSlots(rows, slots, field = "change") {
  const out = slots.map(() => null);
  for (const row of rows || []) {
    const t = ms(row.start);
    const v = row[field] === null || row[field] === undefined ? Number.NaN : Number(row[field]);
    if (!Number.isFinite(v)) continue;
    const i = slots.findIndex((s) => t >= s.start.getTime() && t < s.end.getTime());
    if (i >= 0) out[i] = (out[i] ?? 0) + v;
  }
  return out;
}

/**
 * Energy of the period: per key the summed kWh per slot, the split per slot and the totals.
 * Keys without a source are null per slot; a key with sources but no rows (e.g. a future hour) too.
 */
export async function fetchPeriodEnergy(hass, cache, config, prefs, range, now = Date.now()) {
  const sources = resolveSources(config, prefs);
  const ids = [...new Set(Object.values(sources).flat())];
  const series = Object.fromEntries(STAT_KEYS.map((k) => [k, range.slots.map(() => null)]));
  if (ids.length) {
    const req = statsRequest(ids, range);
    const res = await cache.get(JSON.stringify(req), expiryFor(range, now), () => hass.callWS(req));
    for (const k of STAT_KEYS) {
      for (const id of sources[k]) {
        toSlots(res?.[id], range.slots).forEach((v, i) => {
          if (v !== null) series[k][i] = (series[k][i] ?? 0) + v;
        });
      }
    }
  }
  const hasData = range.slots.map((_, i) => STAT_KEYS.some((k) => series[k][i] !== null));
  const split = range.slots.map((_, i) =>
    hasData[i] ? splitSlot(Object.fromEntries(STAT_KEYS.map((k) => [k, series[k][i]]))) : null,
  );
  return {
    sources,
    series,
    split,
    total: summarize(split.filter(Boolean), config.co2_factor ?? 0.4),
    hasData: hasData.some(Boolean),
  };
}

// ---- power chart (day view) ----

export const historyRequest = (ids, range) => ({
  type: "history/history_during_period",
  start_time: range.start.toISOString(),
  end_time: range.end.toISOString(),
  entity_ids: ids,
  minimal_response: true,
  no_attributes: true,
  significant_changes_only: false,
});

/** Grid start times from the period start in `stepMin` steps up to the end (absolute minutes, DST-safe). */
export const grid = (range, stepMin) => {
  const out = [];
  for (let t = range.start.getTime(); t < range.end.getTime(); t += stepMin * MIN) out.push(t);
  return out;
};

/**
 * Time-weighted mean of a step series per grid cell. `points` are [{ t (ms), v (number|null) }], sorted;
 * a value holds until the next point. Cells after `until` (now) or without any numeric coverage are null.
 */
export function resample(points, cells, stepMin, until = Number.POSITIVE_INFINITY) {
  const step = stepMin * MIN;
  let first = 0;
  return cells.map((c0) => {
    const c1 = Math.min(c0 + step, until);
    if (c1 <= c0) return null;
    while (first + 1 < points.length && points[first + 1].t <= c0) first++;
    let area = 0;
    let covered = 0;
    for (let i = first; i < points.length && points[i].t < c1; i++) {
      const p = points[i];
      if (p.v === null) continue;
      const a = Math.max(p.t, c0);
      const b = Math.min(points[i + 1]?.t ?? until, c1);
      if (b > a) {
        area += p.v * (b - a);
        covered += b - a;
      }
    }
    return covered > 0 ? area / covered : null;
  });
}

/** Compressed history rows ({ s, lu } with lu in seconds) → [{ t, v }]. kW entities are converted to W. */
export const historyPoints = (rows, factor = 1) =>
  (rows || []).map((r) => {
    const v = Number.parseFloat(r.s ?? r.state);
    return {
      t: r.lu !== undefined ? r.lu * 1000 : ms(r.last_updated ?? r.last_changed),
      v: Number.isFinite(v) ? v * factor : null,
    };
  });

const unitFactor = (hass, id) => {
  const u = String(hass?.states?.[id]?.attributes?.unit_of_measurement || "").toLowerCase();
  return u === "kw" ? 1000 : 1;
};

/**
 * Power series of the day on a `stepMin` grid: { cells, series: { [entityId]: (number|null)[] }, source }.
 * History first; entities without history in that range (older than the recorder keeps) come from the
 * 5-minute statistics, else the hourly ones (mean).
 */
export async function fetchPowerDay(hass, cache, ids, range, stepMin = 5, now = Date.now()) {
  const cells = grid(range, stepMin);
  const series = {};
  const source = {};
  if (!ids.length) return { cells, series, source };
  const until = Math.min(range.end.getTime(), now);
  const exp = expiryFor(range, now);
  const req = historyRequest(ids, range);
  const hist = await cache.get(JSON.stringify(req), exp, () => hass.callWS(req)).catch(() => ({}));
  const missing = [];
  for (const id of ids) {
    const pts = historyPoints(hist?.[id], unitFactor(hass, id));
    if (pts.some((p) => p.v !== null)) {
      series[id] = resample(pts, cells, stepMin, until);
      source[id] = "history";
    } else missing.push(id);
  }
  for (const period of ["5minute", "hour"]) {
    if (!missing.length) break;
    const sreq = statsRequest([...missing], range, ["mean"], period);
    const res = await cache.get(JSON.stringify(sreq), exp, () => hass.callWS(sreq)).catch(() => ({}));
    const len = period === "hour" ? 60 : 5;
    for (const id of [...missing]) {
      const rows = (res?.[id] || []).filter((r) => Number.isFinite(Number(r.mean)));
      if (!rows.length) continue;
      const pts = rows.flatMap((r) => [
        { t: ms(r.start), v: Number(r.mean) },
        { t: ms(r.end ?? ms(r.start) + len * MIN), v: null },
      ]);
      series[id] = resample(pts, cells, stepMin, until);
      source[id] = period;
      missing.splice(missing.indexOf(id), 1);
    }
  }
  return { cells, series, source };
}

// ---- solar forecast (today only) ----

export const forecastRequest = () => ({ type: "energy/solar_forecast" });

/** Hourly forecast in kWh per day slot, summed over the given config entries (all when none given). */
export function forecastSlots(res, range, entries = []) {
  const out = range.slots.map(() => 0);
  let any = false;
  for (const [entry, data] of Object.entries(res || {})) {
    if (entries.length && !entries.includes(entry)) continue;
    for (const [time, wh] of Object.entries(data?.wh_hours || {})) {
      const t = Date.parse(time);
      const i = range.slots.findIndex((s) => t >= s.start.getTime() && t < s.end.getTime());
      if (i >= 0 && Number.isFinite(Number(wh))) {
        out[i] += Number(wh) / 1000;
        any = true;
      }
    }
  }
  return any ? out : null;
}

export async function fetchForecast(hass, cache, range, entries, now = Date.now()) {
  if (!entries?.length) return null;
  const res = await cache.get("forecast", now + 30 * MIN, () => hass.callWS(forecastRequest())).catch(() => null);
  return forecastSlots(res, range, entries);
}

/**
 * Live entities used by the power chart, from the config with the prefs' `stat_rate` entities as fallback.
 * Returns { ids, map } where map tells which entity feeds which chart series.
 */
export function powerEntities(config, live = {}) {
  const c = { ...live, ...config };
  const map = {
    solar: c.solar_power_entity,
    grid: config.grid_import_power_entity || config.grid_export_power_entity ? null : c.grid_power_entity,
    grid_import: config.grid_import_power_entity,
    grid_export: config.grid_export_power_entity,
    battery: c.battery_power_entity,
    house: c.house_power_entity,
    soc: c.soc_entity,
  };
  for (const k of Object.keys(map)) if (!entityList(map[k]).length) delete map[k];
  return { ids: [...new Set(Object.values(map).flatMap(entityList))], map };
}

/**
 * Chart series (W, soc in %) from the resampled entity series: grid split into import / export, home from its
 * own entity or PV + import − export + discharge − charge. Signs as in readLive.
 */
export function powerSeries(raw, map, config, live = {}) {
  const n = raw.cells.length;
  // One entity, or the cell-wise sum of several (a cell counts once any of them has a value).
  const get = (k) => {
    const list = entityList(map[k])
      .map((id) => raw.series[id])
      .filter(Boolean);
    if (list.length < 2) return list[0] || null;
    return Array.from({ length: n }, (_, i) => {
      const v = list.map((a) => a[i]).filter(Number.isFinite);
      return v.length ? v.reduce((a, b) => a + b, 0) : null;
    });
  };
  const pos = (v) => (Number.isFinite(v) ? Math.max(0, v) : v);
  const neg = (v) => (Number.isFinite(v) ? Math.max(0, -v) : v);
  const out = { pv: get("solar"), soc: get("soc"), house: get("house") };
  const g = get("grid");
  if (g) {
    const sg = config.invert_grid ? -1 : 1;
    out.grid_import = g.map((v) => (Number.isFinite(v) ? pos(v * sg) : null));
    out.grid_export = g.map((v) => (Number.isFinite(v) ? neg(v * sg) : null));
  } else {
    out.grid_import = get("grid_import");
    out.grid_export = get("grid_export");
  }
  const b = get("battery");
  const sb = (config.invert_battery ? -1 : 1) * (config.battery_power_entity ? 1 : live.battery_sign || 1);
  if (!out.house && (out.pv || out.grid_import)) {
    const at = (arr, i) => (arr && Number.isFinite(arr[i]) ? arr[i] : 0);
    out.house = Array.from({ length: n }, (_, i) => {
      const any = [out.pv, out.grid_import, out.grid_export, b].some((a) => a && Number.isFinite(a[i]));
      if (!any) return null;
      const bat = b && Number.isFinite(b[i]) ? b[i] * sb : 0;
      return Math.max(0, at(out.pv, i) + at(out.grid_import, i) - at(out.grid_export, i) - bat);
    });
  }
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}
