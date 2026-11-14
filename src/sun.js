// Sunrise / sunset for any day (after the well-known SunCalc formulas, ~1 min accuracy) and the night
// blocks of a day for the history chart. Today prefers sun.sun's next_rising / next_setting.

const rad = Math.PI / 180;
const DAY = 864e5;
const J1970 = 2440588;
const J2000 = 2451545;
const J0 = 0.0009;
const e = rad * 23.4397;

const toDays = (t) => t / DAY - 0.5 + J1970 - J2000;
const fromJulian = (j) => new Date((j + 0.5 - J1970) * DAY);

/**
 * Sunrise and sunset of the local calendar day of `date`.
 * { rise, set } as Dates, or { rise: null, set: null, polar: "day" | "night" } when the sun does not cross the horizon.
 */
export function sunTimes(date, lat, lon) {
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
  const lw = rad * -lon;
  const phi = rad * lat;
  const n = Math.round(toDays(noon) - J0 - lw / (2 * Math.PI));
  const ds = J0 + lw / (2 * Math.PI) + n;
  const M = rad * (357.5291 + 0.98560028 * ds);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const transit = (a) => J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
  const jNoon = transit(ds);
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosW > 1) return { rise: null, set: null, polar: "night" };
  if (cosW < -1) return { rise: null, set: null, polar: "day" };
  const jSet = transit(J0 + (Math.acos(cosW) + lw) / (2 * Math.PI) + n);
  return { rise: fromJulian(jNoon - (jSet - jNoon)), set: fromJulian(jSet) };
}

const within = (iso, range) => {
  const t = iso ? Date.parse(iso) : Number.NaN;
  return Number.isFinite(t) && t >= range.start.getTime() && t < range.end.getTime() ? new Date(t) : null;
};

/** Sunrise / sunset for a day range: sun.sun when its next_* fall on that day, else computed from the home location. */
export function daySun(hass, range) {
  const lat = Number(hass?.config?.latitude);
  const lon = Number(hass?.config?.longitude);
  const calc = Number.isFinite(lat) && Number.isFinite(lon) ? sunTimes(range.start, lat, lon) : null;
  const sun = hass?.states?.["sun.sun"]?.attributes;
  const rise = within(sun?.next_rising, range) ?? calc?.rise ?? null;
  const set = within(sun?.next_setting, range) ?? calc?.set ?? null;
  return { rise, set, polar: calc?.polar };
}

/** Night blocks [{ start, end }] of a day range: before sunrise and after sunset. */
export function nightBlocks(range, { rise, set, polar } = {}) {
  if (polar === "night") return [{ start: range.start, end: range.end }];
  if (polar === "day" || !rise || !set) return [];
  const out = [];
  if (rise > range.start) out.push({ start: range.start, end: rise });
  if (set < range.end) out.push({ start: set, end: range.end });
  return out;
}
