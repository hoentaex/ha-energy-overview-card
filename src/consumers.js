// Consumers card: every device that draws power right now, largest first, with its share of the home, what no
// meter covers ("untracked"), a list / room / tiles view and the illustrated header with a power strip scene.
// Pure functions here (detection, names, history, HTML); the element lives in consumerscard.js.
import { resample } from "./data.js";
import { esc } from "./shared.js";

export const VIEWS = ["list", "room", "tiles"];
export const LAYOUTS = ["full", "mini"];

export const CONSUMER_DEFAULTS = {
  layout: "full",
  view: "list",
  view_switch: true,
  min_power: 1,
  show_untracked: true,
  max_items: 0,
};

/** Hours of history behind "on since" and the sparkline (its last hour). */
export const HISTORY_HOURS = 6;
const SPARK_MIN = 60;
const SPARK_CELLS = 15;

// Rank colours: the five largest consumers in the bar, the legend and their rows; the rest share one colour.
export const RANK_COLORS = ["var(--eoc-c1)", "var(--eoc-c2)", "var(--eoc-c3)", "var(--eoc-c4)", "var(--eoc-c5)"];
const OTHER_COLOR = "var(--eoc-c0)";
const TOP = 5;

// ---------- detection ----------

const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Not consumers: generation, grid, meters, batteries, totals and helpers, and powercalc's self-consumption of the
// smart plugs themselves. Matched on the entity id, the device name and the integration.
const INFRA = [
  "pv_",
  "solar",
  "photovolt",
  "inverter",
  "wechselrichter",
  "balkon",
  "einspeis",
  "feed_in",
  "feedin",
  "grid",
  "netz",
  "zahler",
  "zaehler",
  "meter",
  "3em",
  "forecast",
  "prognose",
  "power_production",
  "battery",
  "batterie",
  "akkuleistung",
  "solarbank",
  "hausbedarf",
  "household",
  "verbrauch",
  "consumption",
  "gesamt",
  "total",
  "standby",
  "helper",
  "mittelwert",
  "average",
  "tibber",
  "vzlogger",
  "volkszahler",
  "_device_power",
];
const INFRA_PLATFORMS = new Set([
  "fronius",
  "solaredge",
  "sma",
  "enphase_envoy",
  "growatt_server",
  "huawei_solar",
  "solarman",
  "opendtu",
  "hoymiles_wifi",
  "ahoy",
  "apsystems",
  "anker_solix",
  "forecast_solar",
  "solcast_solar",
  "tibber",
  "victron",
  "goodwe",
  "kostal_plenticore",
  "sungrow",
  "solax",
  "foxess",
  "deye",
  "sonnen",
  "senec",
  "e3dc",
  "powerwall",
  "zendure_ha",
  "ecoflow_cloud",
]);

const factorOf = (st) => (norm(st?.attributes?.unit_of_measurement) === "kw" ? 1000 : 1);

/** Power of an entity in W, or null (unavailable, not a number). */
export const powerOf = (hass, id) => {
  const st = hass?.states?.[id];
  const v = Number.parseFloat(st?.state);
  return Number.isFinite(v) ? v * factorOf(st) : null;
};

const isPowerSensor = (st, id) => {
  if (!id.startsWith("sensor.")) return false;
  const a = st?.attributes || {};
  const unit = norm(a.unit_of_measurement);
  return a.device_class === "power" || ((unit === "w" || unit === "kw") && !a.device_class);
};

/** Every entity id an energy dashboard or the card itself uses for sources: never a consumer. */
export function sourceIds(prefs, config = {}) {
  const out = new Set();
  for (const s of prefs?.energy_sources || [])
    for (const [k, v] of Object.entries(s)) if (/^stat_/.test(k) && typeof v === "string") out.add(v);
  for (const [k, v] of Object.entries(config)) if (/_entity$/.test(k) && typeof v === "string") out.add(v);
  return out;
}

/**
 * Consumers from the Energy dashboard's individual devices that carry a power sensor (stat_rate). Parents that other
 * devices are counted in (included_in_stat) are left out, so nothing is counted twice.
 */
export function prefsConsumers(prefs) {
  const devs = prefs?.device_consumption || [];
  const parents = new Set(devs.map((d) => d.included_in_stat).filter(Boolean));
  return devs
    .filter((d) => typeof d.stat_rate === "string" && !parents.has(d.stat_consumption))
    .map((d) => ({ entity: d.stat_rate, name: d.name || undefined }));
}

/**
 * The entities the card lists, as [{ entity, name?, icon? }]: `entities` from the config as given; else the Energy
 * dashboard's devices with a power sensor; else every power sensor that belongs to a device and is not generation,
 * grid, battery, meter, total or helper (see INFRA), minus `exclude`.
 */
export function consumerEntities(hass, config = {}, prefs = null) {
  const exclude = new Set((config.exclude || []).map((e) => (typeof e === "string" ? e : e?.entity)));
  if (Array.isArray(config.entities) && config.entities.length)
    return config.entities
      .map((e) => (typeof e === "string" ? { entity: e } : e))
      .filter((e) => e?.entity && !exclude.has(e.entity));
  const fromPrefs = prefsConsumers(prefs).filter((e) => !exclude.has(e.entity));
  if (fromPrefs.length) return fromPrefs;
  const sources = sourceIds(prefs, config);
  const reg = hass?.entities;
  const out = [];
  for (const [id, st] of Object.entries(hass?.states || {})) {
    if (!isPowerSensor(st, id) || exclude.has(id) || sources.has(id)) continue;
    const e = reg?.[id];
    // With the registry at hand (Home Assistant), only sensors of a device: templates and helpers have none.
    if (reg && (!e?.device_id || e.hidden || e.entity_category)) continue;
    if (e?.platform && INFRA_PLATFORMS.has(e.platform)) continue;
    const dev = e?.device_id ? hass.devices?.[e.device_id] : null;
    const hay = `${norm(id)} ${norm(dev?.name_by_user || dev?.name)}`;
    if (INFRA.some((w) => hay.includes(w))) continue;
    out.push({ entity: id });
  }
  return out;
}

// ---------- names, rooms, kinds ----------

const SUFFIX =
  /\s*\b(device power|aktuelle leistung|current power|active power|leistungsaufnahme|wirkleistung|leistung|power|watt)\s*$/i;
const TECHNICAL = /^(shelly|tasmota|esp|sonoff|tuya|matter over|zigbee)|[0-9a-f]{8,}|output \d/i;

/** "Steckdose Wohnzimmer Output 4 - Hephaistos Leistung" → "Hephaistos", "Küche Sonos Switch 0 power" → "Küche Sonos". */
export function tidyName(s) {
  let x = String(s || "").trim();
  const dash = x.match(/\b(?:output|switch|channel|kanal)\s*_?\d+\s*-\s*(.+)$/i);
  if (dash) x = dash[1];
  x = x.replace(SUFFIX, "");
  x = x
    .replace(/\b(output|switch|channel|kanal)[ _]?\d+\b/gi, "")
    .replace(/\bshelly\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  x = x.replace(SUFFIX, "").trim();
  const w = x.split(" ");
  if (w.length % 2 === 0) {
    const h = w.length / 2;
    if (norm(w.slice(0, h).join(" ")) === norm(w.slice(h).join(" "))) x = w.slice(0, h).join(" ");
  }
  return x || String(s || "").trim();
}

/**
 * Display name: the configured one; else the device name when the entity carries it and it is not a technical one
 * (shellyplus2pm-…); else the friendly name without "Leistung", "Switch 0" and the like.
 */
export function consumerName(hass, item) {
  if (item.name) return item.name;
  const id = item.entity;
  const fn = String(hass?.states?.[id]?.attributes?.friendly_name || id.replace(/^sensor\./, "").replace(/_/g, " "));
  const e = hass?.entities?.[id];
  const dev = e?.device_id ? hass?.devices?.[e.device_id] : null;
  const dn = String(dev?.name_by_user || dev?.name || "").trim();
  if (dn && !TECHNICAL.test(dn) && norm(fn).startsWith(norm(dn))) return tidyName(dn);
  return tidyName(fn);
}

/** Area name of the entity, else of its device, else null. */
export function areaOf(hass, id) {
  const e = hass?.entities?.[id];
  const dev = e?.device_id ? hass?.devices?.[e.device_id] : null;
  const a = e?.area_id || dev?.area_id;
  return a ? hass?.areas?.[a]?.name || null : null;
}

const KINDS = [
  ["printer", /drucker|printer|\b3d\b|bambu|prusa/],
  ["tv", /\btv\b|fernseh|beamer|television/],
  ["media", /sonos|speaker|lautsprecher|\becho\b|radio|receiver|peripherie|soundbar|music/],
  ["server", /server|rack|\bnas\b|\bpc\b|computer|gaming|router|proxmox|mac\s?mini|homelab/],
  [
    "appliance",
    /wasch|geschirr|spul|dish|wash|trockner|dryer|kuhl|fridge|gefrier|freezer|herd|ofen|oven|kocher|kettle|toaster|kaffee|coffee|mikrowelle|microwave/,
  ],
  ["charge", /lade|charger|charging|staubsauger|vacuum|bike|wallbox/],
  ["light", /licht|light|lamp|leuchte|wled|\bhue\b|strip|kerze|ambiente|\bled\b|spiegel/],
];

/** Icon kind from the name and the entity id. */
export function kindOf(name, id = "") {
  const s = `${norm(name)} ${norm(id).replace(/_/g, " ")}`;
  return KINDS.find(([, re]) => re.test(s))?.[0] || "plug";
}

// ---------- history: on since, sparkline ----------

/**
 * When the consumer last crossed the threshold upwards, from its history points ([{ t, v }], sorted). Returns the
 * time in ms, `-Infinity` when it was on for the whole window, or null when it is not on now.
 */
export function onSince(points, min, now = Date.now()) {
  if (!points?.length) return null;
  const last = points.at(-1);
  if (!(last.v >= min)) return null;
  for (let i = points.length - 1; i >= 0; i--) {
    const p = points[i];
    if (p.v !== null && p.v < min) return points[i + 1]?.t ?? now;
  }
  return Number.NEGATIVE_INFINITY;
}

/** The last hour on SPARK_CELLS cells (time-weighted means), or null without data. */
export function sparkSeries(points, now = Date.now()) {
  if (!points?.length) return null;
  const step = SPARK_MIN / SPARK_CELLS;
  const start = now - SPARK_MIN * 60e3;
  const cells = Array.from({ length: SPARK_CELLS }, (_, i) => start + i * step * 60e3);
  const s = resample(points, cells, step, now);
  return s.some((v) => v !== null) ? s : null;
}

/** SVG path of a sparkline in a 56 × 22 box (area and line), scaled to its own peak. */
export function sparkPaths(series) {
  const vals = series.map((v) => (Number.isFinite(v) ? v : 0));
  const max = Math.max(...vals, 0.1) * 1.1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * 56).toFixed(1)},${(21 - (v / max) * 19).toFixed(1)}`);
  return { line: `M${pts.join(" L")}`, area: `M0,22 L${pts.join(" L")} L56,22Z` };
}

// ---------- model ----------

/**
 * Everything the card shows: the consumers above `min_power` sorted by power (with rank colour, share, room, kind,
 * on-since and sparkline from `hist`), the idle ones, their sum, the home and the untracked rest.
 */
export function consumerModel(hass, config, items, { house = null, hist = {}, now = Date.now() } = {}) {
  const min = Number(config.min_power ?? CONSUMER_DEFAULTS.min_power) || 0;
  const all = items.map((it) => {
    const name = consumerName(hass, it);
    return {
      id: it.entity,
      name,
      icon: it.icon || hass?.entities?.[it.entity]?.icon || hass?.states?.[it.entity]?.attributes?.icon || null,
      kind: kindOf(name, it.entity),
      area: it.area || areaOf(hass, it.entity),
      w: powerOf(hass, it.entity),
    };
  });
  const active = all.filter((c) => c.w !== null && c.w >= min && c.w > 0).sort((a, b) => b.w - a.w);
  const idle = all
    .filter((c) => c.w !== null && !(c.w >= min && c.w > 0))
    .sort((a, b) => (b.w || 0) - (a.w || 0) || a.name.localeCompare(b.name));
  const sum = active.reduce((s, c) => s + c.w, 0);
  const home = Number.isFinite(house) && house > 0 ? house : null;
  const base = home && home >= sum ? home : sum;
  active.forEach((c, i) => {
    c.color = i < TOP ? RANK_COLORS[i] : OTHER_COLOR;
    c.share = base > 0 ? c.w / base : 0;
    const pts = hist[c.id];
    c.since = pts ? onSince(pts, min, now) : null;
    c.spark = pts ? sparkSeries(pts, now) : null;
  });
  const untracked = home !== null && config.show_untracked !== false ? Math.max(0, home - sum) : null;
  return { active, idle, sum, home, base, untracked, min };
}

/** The bar: the top five, the others together, the untracked rest. */
export function stackSegments(model) {
  const segs = model.active.slice(0, TOP).map((c) => ({ key: c.id, name: c.name, w: c.w, color: c.color }));
  const others = model.active.slice(TOP);
  if (others.length)
    segs.push({ key: "others", n: others.length, w: others.reduce((s, c) => s + c.w, 0), color: OTHER_COLOR });
  if (model.untracked > 0) segs.push({ key: "untracked", w: model.untracked, color: "var(--eoc-untracked)" });
  return segs;
}

/** Rooms with their consumers, the largest room first; consumers without a room last. */
export function byRoom(active) {
  const map = new Map();
  for (const c of active) {
    const k = c.area || "";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(c);
  }
  return [...map.entries()]
    .map(([area, list]) => ({ area, list, w: list.reduce((s, c) => s + c.w, 0) }))
    .sort((a, b) => !a.area - !b.area || b.w - a.w);
}

// ---------- formatting ----------

/** W with one decimal below 10 W, kW from 1000 W. */
export const fmtW = (w, lang) => {
  if (!Number.isFinite(w)) return "–";
  const loc = lang === "de" ? "de-DE" : "en-US";
  if (Math.abs(w) >= 1000)
    return `${(w / 1000).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kW`;
  const d = Math.abs(w) < 10 ? 1 : 0;
  return `${w.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d })} W`;
};

/** "seit 38 min", "seit 2 h 14 min", "seit über 6 h"; "" when unknown. */
export function sinceText(since, t, now = Date.now()) {
  if (since === null || since === undefined) return "";
  if (since === Number.NEGATIVE_INFINITY) return t("cons_since_long", { h: HISTORY_HOURS });
  const min = Math.max(0, Math.round((now - since) / 60e3));
  if (min < 1) return t("cons_just_on");
  const h = Math.floor(min / 60);
  const m = min % 60;
  return t("cons_since", { v: h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min` });
}

const pct = (share) => `${Math.round(share * 100)} %`;

// ---------- HTML ----------

const ICON_PATHS = {
  plug: "M16,7V3H14V7H10V3H8V7C7,7 6,8 6,9V14.5L9.5,18V21H14.5V18L18,14.5V9C18,8 17,7 16,7Z",
  server:
    "M4,1H20A1,1 0 0,1 21,2V6A1,1 0 0,1 20,7H4A1,1 0 0,1 3,6V2A1,1 0 0,1 4,1M4,9H20A1,1 0 0,1 21,10V14A1,1 0 0,1 20,15H4A1,1 0 0,1 3,14V10A1,1 0 0,1 4,9M4,17H20A1,1 0 0,1 21,18V22A1,1 0 0,1 20,23H4A1,1 0 0,1 3,22V18A1,1 0 0,1 4,17M9,5H10V3H9V5M9,13H10V11H9V13M9,21H10V19H9V21M5,3V5H7V3H5M5,11V13H7V11H5M5,19V21H7V19H5Z",
  light:
    "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  printer: "M4,3H20V6H18V5H6V6H4V3M11,7H13V9L12,11L11,9V7M3,19H21V21H3V19M5,17V13H19V17H5M7,15V16H17V15H7Z",
  media:
    "M7,2H17A2,2 0 0,1 19,4V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V4A2,2 0 0,1 7,2M12,4A2,2 0 0,0 10,6A2,2 0 0,0 12,8A2,2 0 0,0 14,6A2,2 0 0,0 12,4M12,10A4,4 0 0,0 8,14A4,4 0 0,0 12,18A4,4 0 0,0 16,14A4,4 0 0,0 12,10M12,12A2,2 0 0,1 14,14A2,2 0 0,1 12,16A2,2 0 0,1 10,14A2,2 0 0,1 12,12Z",
  tv: "M21,17H3V5H21M21,3H3A2,2 0 0,0 1,5V17A2,2 0 0,0 3,19H8V21H16V19H21A2,2 0 0,0 23,17V5A2,2 0 0,0 21,3Z",
  appliance:
    "M5,2H19A2,2 0 0,1 21,4V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V4A2,2 0 0,1 5,2M6,4V6H8V4H6M10,4V6H12V4H10M12,8A5,5 0 0,0 7,13A5,5 0 0,0 12,18A5,5 0 0,0 17,13A5,5 0 0,0 12,8M12,10A3,3 0 0,1 15,13A3,3 0 0,1 12,16A3,3 0 0,1 9,13A3,3 0 0,1 12,10Z",
  charge:
    "M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4M11,20V14.5H9L13,7V12.5H15L11,20Z",
  untracked:
    "M10,19H13V22H10V19M12,2C17.35,2.22 19.68,7.62 16.5,11.67C15.67,12.67 14.33,13.33 13.67,14.17C13,15 13,16 13,17H10C10,15.33 10,13.92 10.67,12.92C11.33,11.92 12.67,11.33 13.5,10.67C15.92,8.43 15.32,5.26 12,5A3,3 0 0,0 9,8H6A6,6 0 0,1 12,2Z",
  list: "M3,4H7V8H3V4M9,5V7H21V5H9M3,10H7V14H3V10M9,11V13H21V11H9M3,16H7V20H3V16M9,17V19H21V17H9Z",
};
export const consIcon = (kind) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATHS[kind] || ICON_PATHS.plug}"></path></svg>`;
const iconOf = (c, haIcon) => (c.icon && haIcon ? `<ha-icon icon="${esc(c.icon)}"></ha-icon>` : consIcon(c.kind));

const spark = (s) => {
  if (!s) return "";
  const p = sparkPaths(s);
  return `<svg class="spark" viewBox="0 0 56 22" aria-hidden="true"><path class="a" d="${p.area}"/><path class="l" d="${p.line}"/></svg>`;
};

const row = (c, ctx) => {
  const { t, lang, now } = ctx;
  const since = sinceText(c.since, t, now);
  const meta = [ctx.view === "room" ? "" : c.area, since].filter(Boolean).join(" · ");
  return `<button type="button" class="cr" data-more="${esc(c.id)}" style="--c:${c.color}" title="${esc(c.id)}">
    <span class="fill" style="width:${Math.min(100, Math.max(1.5, c.share * 100)).toFixed(1)}%"></span>
    <span class="ci">${iconOf(c, ctx.haIcon)}</span>
    <span class="cn"><span class="nm">${esc(c.name)}</span>${meta ? `<span class="mt">${esc(meta)}</span>` : ""}</span>
    <span class="cv">${spark(c.spark)}<span class="nums"><b>${esc(fmtW(c.w, lang))}</b><span>${esc(pct(c.share))}</span></span></span>
  </button>`;
};

const untrackedRow = (m, ctx) =>
  `<div class="cr rest" style="--c:var(--eoc-untracked)">
    <span class="fill" style="width:${Math.min(100, (m.untracked / m.base) * 100).toFixed(1)}%"></span>
    <span class="ci">${consIcon("untracked")}</span>
    <span class="cn"><span class="nm">${esc(ctx.t("cons_untracked"))}</span><span class="mt">${esc(ctx.t("cons_untracked_sub"))}</span></span>
    <span class="cv"><span class="nums"><b>${esc(fmtW(m.untracked, ctx.lang))}</b><span>${esc(pct(m.untracked / m.base))}</span></span></span>
  </div>`;

const tile = (c, ctx, max, wide) =>
  `<button type="button" class="ct${wide ? " wide" : ""}" data-more="${esc(c.id)}" style="--c:${c.color}" title="${esc(c.id)}">
    <span class="ci">${iconOf(c, ctx.haIcon)}</span>
    <span class="tn">${esc(c.name)}</span>
    <b>${esc(fmtW(c.w, ctx.lang))}</b>
    <span class="bar"><i style="width:${((c.w / max) * 100).toFixed(1)}%"></i></span>
  </button>`;

/** The consumers in the chosen view. */
export function viewHTML(m, ctx) {
  const { t, view } = ctx;
  const shown = ctx.maxItems > 0 ? m.active.slice(0, ctx.maxItems) : m.active;
  const rest = m.untracked > 0.5 ? untrackedRow(m, ctx) : "";
  if (!m.active.length && !rest) return `<div class="empty">${esc(t("cons_none"))}</div>`;
  if (view === "tiles") {
    const max = shown[0]?.w || 1;
    const tiles = shown.map((c, i) => tile(c, ctx, max, i === 0 && shown.length > 2)).join("");
    const un =
      m.untracked > 0.5
        ? `<div class="ct rest" style="--c:var(--eoc-untracked)"><span class="ci">${consIcon("untracked")}</span><span class="tn">${esc(t("cons_untracked"))}</span><b>${esc(fmtW(m.untracked, ctx.lang))}</b><span class="bar"><i style="width:100%"></i></span></div>`
        : "";
    return `<div class="tiles">${tiles}${un}</div>`;
  }
  if (view === "room") {
    const rooms = byRoom(shown)
      .map(
        (r) =>
          `<div class="room"><div class="rh"><b>${esc(r.area || t("cons_no_room"))}</b><span>${esc(fmtW(r.w, ctx.lang))} · ${esc(t(r.list.length === 1 ? "cons_n_dev_1" : "cons_n_dev", { n: r.list.length }))}</span></div>${r.list.map((c) => row(c, ctx)).join("")}</div>`,
      )
      .join("");
    return `<div class="list">${rooms}${rest ? `<div class="room"><div class="rh"><b>${esc(t("cons_unmetered"))}</b></div>${rest}</div>` : ""}</div>`;
  }
  return `<div class="list">${shown.map((c) => row(c, ctx)).join("")}${rest}</div>`;
}

/** Bar with legend. */
export function stackHTML(m, ctx, legend = true) {
  const segs = stackSegments(m);
  if (!segs.length) return "";
  const label = (s) =>
    s.key === "others"
      ? ctx.t("cons_more", { n: s.n })
      : s.key === "untracked"
        ? ctx.t("cons_untracked_short")
        : s.name;
  const bar = `<div class="cbar" aria-hidden="true">${segs.map((s) => `<i class="${s.key === "untracked" ? "ut" : ""}" style="flex-grow:${s.w.toFixed(2)};--c:${s.color}" title="${esc(label(s))}"></i>`).join("")}</div>`;
  if (!legend) return bar;
  return `${bar}<div class="clegend">${segs.map((s) => `<span><i style="--c:${s.color}" class="${s.key === "untracked" ? "ut" : ""}"></i>${esc(label(s))}</span>`).join("")}</div>`;
}

/** Home now, its sources and the bar. */
export function heroHTML(m, live, ctx) {
  const { t, lang } = ctx;
  const total = m.home ?? m.sum;
  const src = (cls, label, w) =>
    Number.isFinite(w)
      ? `<span class="src${w > (ctx.threshold || 0) ? "" : " off"}" style="--c:var(--eoc-${cls})"><i></i>${esc(label)} <b>${esc(fmtW(w, lang))}</b></span>`
      : "";
  return `<div class="hero">
    <div class="ht">
      <div><div class="hk">${esc(t(m.home !== null ? "cons_home_now" : "cons_sum_now"))}</div><div class="big" data-p="total">${esc(fmtW(total, lang))}</div></div>
      <div class="srcs">${src("imp", t("grid"), live.grid_import)}${src("pv", t("pv"), live.solar)}${src("bat", t("battery"), live.battery_discharge)}</div>
    </div>
    ${stackHTML(m, ctx)}
  </div>`;
}

export function switchHTML(view, t) {
  return `<div class="seg" role="group" aria-label="${esc(t("view"))}">${VIEWS.map(
    (v) => `<button type="button" data-view="${v}" aria-pressed="${v === view}">${esc(t(`cons_view_${v}`))}</button>`,
  ).join("")}</div>`;
}

/** Idle and below-threshold consumers behind a toggle. */
export function idleHTML(m, ctx) {
  const { t, lang } = ctx;
  if (!m.idle.length) return "";
  const cov = m.home ? `<span>${esc(t("cons_coverage", { v: Math.round((m.sum / m.home) * 100) }))}</span>` : "";
  return `<div class="foot">
      <button type="button" class="more" data-idle aria-expanded="${!!ctx.idleOpen}">${consIcon("list")}<span>${esc(t("cons_idle", { n: m.idle.length, w: fmtW(m.min, lang) }))}</span></button>
      ${cov}
    </div>
    ${ctx.idleOpen ? `<div class="idle">${m.idle.map((c) => `<button type="button" data-more="${esc(c.id)}">${esc(c.name)} ${esc(fmtW(c.w, lang))}</button>`).join("")}</div>` : ""}`;
}

// ---------- banner scene: a power strip with a floor lamp, a server and a 3D printer ----------

export function consumersScene({ total, lang, t, animate = true, lit = true }) {
  const a = animate ? " anim" : "";
  return `
  <rect class="vc-wall" x="182" y="40" width="14" height="20" rx="2"/><circle class="vc-hole" cx="187" cy="50" r="1.2"/><circle class="vc-hole" cx="191" cy="50" r="1.2"/>
  <path class="vc-cable" d="M184,52 C176,62 172,72 160,73"/>
  ${lit ? `<path class="vc-flow${a}" d="M184,52 C176,62 172,72 160,73"/>` : ""}
  <rect class="vc-strip" x="62" y="70" width="100" height="8" rx="3"/>
  <circle class="vc-led${lit ? " on" : ""}${a}" cx="156" cy="74" r="1.6"/>
  <rect class="vc-hole" x="74" y="72.5" width="6" height="3" rx="1"/><rect class="vc-hole" x="98" y="72.5" width="6" height="3" rx="1"/><rect class="vc-hole" x="124" y="72.5" width="6" height="3" rx="1"/>
  ${lit ? `<ellipse class="vc-glow${a}" cx="77" cy="24" rx="16" ry="12"/>` : ""}
  <path class="vc-shade${lit ? " on" : ""}" d="M69,16 L85,16 L89,28 L65,28 Z"/>
  <rect class="vc-dev" x="76" y="28" width="2" height="40"/><rect class="vc-dev" x="70" y="67" width="14" height="3" rx="1"/>
  <rect class="vc-dev" x="93" y="38" width="16" height="31" rx="2"/>
  <rect class="vc-dev2" x="95" y="41" width="12" height="5" rx="1"/><rect class="vc-dev2" x="95" y="49" width="12" height="5" rx="1"/><rect class="vc-dev2" x="95" y="57" width="12" height="5" rx="1"/>
  <circle class="vc-srv" cx="104.5" cy="43.5" r="1"/><circle class="vc-srv b${a}" cx="104.5" cy="51.5" r="1"/><circle class="vc-srv c${a}" cx="104.5" cy="59.5" r="1"/>
  <rect class="vc-dev" x="116" y="34" width="3" height="35"/><rect class="vc-dev" x="142" y="34" width="3" height="35"/><rect class="vc-dev" x="116" y="33" width="29" height="3" rx="1"/>
  <rect class="vc-dev2" x="118" y="44" width="25" height="2"/>
  <g class="vc-move${a}"><rect class="vc-head" x="127" y="45" width="7" height="6" rx="1"/><path class="vc-head" d="M129.5,51 L131.5,51 L130.5,53 Z"/></g>
  <path class="vc-obj" d="M124,66 L137,66 L135,60 L126,60 Z"/>
  <rect class="vc-dev" x="114" y="66" width="33" height="3" rx="1"/>
  <text class="eb-rd" x="196" y="15" text-anchor="end" data-p="scene-total">${esc(fmtW(total, lang))}</text><text class="eb-rd2" x="196" y="24" text-anchor="end">${esc(t("cons_scene_now"))}</text>`;
}

export const CONSUMERS_STYLE = `
:host {
  --eoc-c1: var(--eoc-consumer-1-color, #fab387);
  --eoc-c2: var(--eoc-consumer-2-color, #b4befe);
  --eoc-c3: var(--eoc-consumer-3-color, #89dceb);
  --eoc-c4: var(--eoc-consumer-4-color, #f9c74f);
  --eoc-c5: var(--eoc-consumer-5-color, #a6e3a1);
  --eoc-c0: var(--eoc-consumer-other-color, #9399b2);
  --eoc-untracked: var(--eoc-untracked-color, #9399b2);
}
ha-card.cons { gap: 16px; }
ha-card.cons [data-banner] > .banner { margin: -16px -16px 0; }
.cons .cr, .cons .ct { box-sizing: border-box; }
.cons .hero { border-radius: 12px; background: var(--eoc-tile); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.cons .ht { display: flex; align-items: flex-end; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; }
.cons .hk { font-size: 12px; color: var(--eoc-sub); margin-bottom: 4px; }
.cons .big { font-size: 30px; font-weight: 500; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; }
.cons .srcs { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.cons .src { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; padding: 2px 8px; border-radius: 10px; white-space: nowrap;
             background: color-mix(in srgb, var(--c) 14%, transparent); color: color-mix(in srgb, var(--c) 62%, var(--eoc-text)); }
.cons .src b { font-weight: 500; font-variant-numeric: tabular-nums; }
.cons .src i, .clegend i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex: none; display: inline-block; }
.cons .src.off { opacity: .6; --c: var(--eoc-sub); }
.cbar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; gap: 2px; }
.cbar i { display: block; height: 100%; min-width: 3px; background: var(--c); transition: flex-grow .6s ease; }
.cbar i.ut, .clegend i.ut { background: repeating-linear-gradient(135deg, var(--c) 0 3px, color-mix(in srgb, var(--c) 35%, transparent) 3px 6px); }
.clegend { display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: 12px; color: var(--eoc-sub); }
.clegend span { display: inline-flex; align-items: center; gap: 5px; min-width: 0; max-width: 100%; }
.clegend i { border-radius: 2px; width: 8px; height: 8px; }
.cons .sec-h { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: var(--eoc-sub); }
.cons .sec-h .icon { width: 16px; height: 16px; }
.cons .seg { margin-left: auto; display: inline-flex; padding: 2px; gap: 2px; border-radius: 9px; background: var(--eoc-tile); text-transform: none; letter-spacing: 0; }
.cons .seg button { border: 0; background: none; cursor: pointer; font-size: 12px; font-weight: 400; padding: 3px 9px; min-height: 26px; border-radius: 7px; color: var(--eoc-sub); }
.cons .seg button[aria-pressed="true"] { background: var(--eoc-card); color: var(--eoc-text); font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,.14); }
.cons .list { display: flex; flex-direction: column; gap: 6px; }
.cons .cr { position: relative; overflow: hidden; display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; width: 100%;
            padding: 7px 10px; border: 0; border-radius: 12px; background: var(--eoc-tile); text-align: left; cursor: pointer; }
.cons div.cr { cursor: default; }
.cons .cr > :not(.fill) { position: relative; }
.cons .cr .fill { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--c) 12%, transparent); border-right: 2px solid color-mix(in srgb, var(--c) 45%, transparent); transition: width .6s ease; }
.cons .ci { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: color-mix(in srgb, var(--c) 80%, var(--eoc-text)); background: color-mix(in srgb, var(--c) 20%, var(--eoc-card)); --mdc-icon-size: 18px; }
.cons .ci .icon { width: 18px; height: 18px; }
.cons .rest .ci { background: transparent; box-shadow: inset 0 0 0 1.5px var(--c); }
.cons .cn { display: flex; flex-direction: column; min-width: 0; }
.cons .nm { font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cons .mt { font-size: 12px; color: var(--eoc-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cons .cv { display: flex; align-items: center; gap: 10px; }
.cons .nums { display: flex; flex-direction: column; align-items: flex-end; min-width: 58px; }
.cons .nums b { font-size: 15px; font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; }
.cons .nums span { font-size: 11px; color: var(--eoc-sub); font-variant-numeric: tabular-nums; }
.cons .spark { width: 56px; height: 22px; flex: none; }
.cons .spark .l { fill: none; stroke: var(--c); stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round; }
.cons .spark .a { fill: color-mix(in srgb, var(--c) 18%, transparent); }
.cons .room { display: flex; flex-direction: column; gap: 6px; }
.cons .room + .room { margin-top: 6px; }
.cons .rh { display: flex; justify-content: space-between; gap: 8px; padding: 0 4px; font-size: 12px; color: var(--eoc-sub); }
.cons .rh b { font-size: 13px; font-weight: 500; color: var(--eoc-text); }
.cons .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
.cons .ct { display: flex; flex-direction: column; align-items: flex-start; gap: 5px; min-width: 0; padding: 10px 11px; border: 0; border-radius: 12px; background: var(--eoc-tile); text-align: left; cursor: pointer; }
.cons div.ct { cursor: default; }
.cons .ct.wide { grid-column: span 2; }
.cons .ct .ci { width: 30px; height: 30px; }
.cons .ct .tn { font-size: 12px; color: var(--eoc-sub); max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cons .ct b { font-size: 19px; font-weight: 500; line-height: 1.1; white-space: nowrap; font-variant-numeric: tabular-nums; }
.cons .ct .bar { align-self: stretch; height: 4px; border-radius: 2px; background: var(--eoc-line); }
.cons .ct .bar i { display: block; height: 100%; border-radius: 2px; background: var(--c); }
.cons .ct.rest .bar i { opacity: .5; }
.cons .foot { display: flex; align-items: center; justify-content: space-between; gap: 6px 12px; flex-wrap: wrap; font-size: 12px; color: var(--eoc-sub); }
.cons .more { display: inline-flex; align-items: center; gap: 5px; border: 0; background: none; padding: 4px 0; cursor: pointer; font-size: 12px; color: var(--eoc-sub); min-height: 28px; }
.cons .more:hover { color: var(--eoc-text); }
.cons .more .icon { width: 16px; height: 16px; }
.cons .idle { display: flex; flex-wrap: wrap; gap: 6px; margin-top: -8px; }
.cons .idle button { border: 0; cursor: pointer; font-size: 12px; padding: 2px 9px; border-radius: 10px; background: var(--eoc-tile); color: var(--eoc-sub); }
.cons .cr:hover, .cons .ct:hover, .cons .idle button:hover { filter: brightness(1.04); }
.cons .empty { padding: 4px 2px; }
@container (max-width: 380px) { .cons .spark { display: none; } .cons .big { font-size: 26px; } }
/* mini */
ha-card.cons-mini { padding: 0; gap: 0; container-type: inline-size; }
ha-card.cons-mini [data-banner] > .banner { margin: 0; }
ha-card.cons-mini [data-banner] > .header { padding: 12px 14px 0; }
.cons-mini .pills { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 14px 0; }
.cons-mini .pills button { display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer; font-size: 12px; padding: 3px 9px; border-radius: 12px; white-space: nowrap; max-width: 100%;
                           background: color-mix(in srgb, var(--c) 15%, transparent); color: color-mix(in srgb, var(--c) 55%, var(--eoc-text)); }
.cons-mini .pills b { font-weight: 500; font-variant-numeric: tabular-nums; }
.cons-mini .pills .empty { font-size: 12px; }
.cons-mini .ms { padding: 10px 14px 12px; }
.cons-mini .cbar { height: 8px; }
/* scene */
.vc-wall { fill: #ffffff; stroke: #b9c4d0; stroke-width: 1; } .night .vc-wall { fill: #2a3a58; stroke: #4c5f80; }
.vc-hole { fill: #7d8894; } .night .vc-hole { fill: #0f1a2e; }
.vc-strip { fill: #f4f6f9; stroke: #9eabb9; stroke-width: 1; } .night .vc-strip { fill: #33425f; stroke: #5b6d8e; }
.vc-led { fill: #9aa4b0; } .vc-led.on { fill: #ff8a4c; } .vc-led.on.anim { animation: vc-blink 1.6s ease-in-out infinite; }
.vc-cable { fill: none; stroke: #5d6672; stroke-width: 1.5; stroke-linecap: round; } .night .vc-cable { stroke: #7a8494; }
.vc-flow { fill: none; stroke: #ff8a4c; stroke-width: 1.8; stroke-dasharray: 3 4; stroke-linecap: round; } .vc-flow.anim { animation: vc-dash .8s linear infinite; }
.vc-dev { fill: #3a4452; } .night .vc-dev { fill: #1a2230; stroke: #4a5670; stroke-width: .8; }
.vc-dev2 { fill: #56616f; } .night .vc-dev2 { fill: #2a3446; }
.vc-shade { fill: #e4e7ec; stroke: #a6b0bc; stroke-width: .8; } .vc-shade.on { fill: #f3d9a4; stroke: #c9a865; } .night .vc-shade.on { fill: #ffd27a; stroke: #e0a640; }
.vc-glow { fill: #ffd27a; opacity: .35; } .vc-glow.anim { animation: vc-pulse 3s ease-in-out infinite; }
.vc-srv { fill: #5fd08a; } .vc-srv.b.anim { animation: vc-blink 1.1s steps(2) infinite; } .vc-srv.c.anim { animation: vc-blink 1.7s steps(2) .4s infinite; }
.vc-head { fill: #ff8a4c; } .vc-move.anim { animation: vc-print 2.4s ease-in-out infinite alternate; }
.vc-obj { fill: #a58cff; }
.scene.vc .eb-rd { fill: #d9682b; } .night .scene.vc .eb-rd { fill: #ffad80; }
.banner:has(> .zoom) .eb-rd, .banner:has(> .zoom) .eb-rd2 { display: none; }
@keyframes vc-dash { to { stroke-dashoffset: -14; } }
@keyframes vc-blink { 50% { opacity: .25; } }
@keyframes vc-pulse { 50% { opacity: .12; } }
@keyframes vc-print { from { transform: translateX(-7px); } to { transform: translateX(7px); } }
@media (prefers-reduced-motion: reduce) { .cons *, .cons-mini * { animation: none !important; transition: none !important; } }
`;
