// Live energy flow: four nodes (solar top, grid left, home right, battery bottom) on one ellipse through all
// four centres. The four outer links are arcs of that ellipse, broken at each node; two straight links cross it.
import { esc, fmtEnergy, fmtNum, fmtPower } from "./shared.js";

// Stage 388 × 324; ellipse centre (192, 149), rx 154, ry 75.
const W = 388;
const H = 324;
const NODES = { solar: [192, 74], grid: [38, 149], house: [346, 149], battery: [192, 224] };
const PATHS = {
  solar_grid: "M 156 76.1 A 154 75 0 0 0 53.4 116.4",
  solar_house: "M 228 76.1 A 154 75 0 0 1 330.6 116.4",
  solar_battery: "M 192 106 L 192 192",
  grid_house: "M 70 149 L 314 149",
  battery_house: "M 228 221.9 A 154 75 0 0 0 330.6 181.6",
  grid_battery: "M 53.4 181.6 A 154 75 0 0 0 156 221.9",
};

const pos = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

/** Live flows in W between the nodes, from the live values (all ≥ 0). */
export function liveFlows(l) {
  const solar = pos(l.solar);
  const pvToBattery = Math.min(pos(l.battery_charge), solar);
  const pvToGrid = Math.min(pos(l.grid_export), solar - pvToBattery);
  const gridToBattery = pos(pos(l.battery_charge) - pvToBattery);
  return {
    solar_grid: pvToGrid,
    solar_house: pos(solar - pvToBattery - pvToGrid),
    solar_battery: pvToBattery,
    grid_house: pos(pos(l.grid_import) - gridToBattery),
    battery_house: pos(l.battery_discharge),
    grid_battery: Math.min(gridToBattery, pos(l.grid_import)),
  };
}

const COLORS = {
  solar_grid: "var(--eoc-exp)",
  solar_house: "var(--eoc-pv)",
  solar_battery: "var(--eoc-pv)",
  grid_house: "var(--eoc-imp)",
  battery_house: "var(--eoc-bat)",
  grid_battery: "var(--eoc-imp)",
};

/** Animation period: 1.6 s at the threshold, down to 0.4 s from 2 kW. */
const duration = (w, byPower) => (byPower ? Math.max(0.4, 1.6 - (1.2 * Math.min(w, 2000)) / 2000) : 0.9);

const ICONS = {
  solar:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  grid: '<path d="M8 22l4-20 4 20M6 8h12M5 14h14M9 14l6 8M15 14l-6 8"/>',
  house: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 11v2"/>',
};
export const icon = (name, size = 20) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

const at = ([x, y]) => `left:${((x / W) * 100).toFixed(2)}%;top:${y}px`;
const atX = (x, y) => `left:${((x / W) * 100).toFixed(2)}%;top:${y}px`;

export const socColor = (soc) => (soc >= 50 ? "var(--eoc-bat)" : soc >= 20 ? "var(--eoc-pv)" : "var(--eoc-imp)");

/**
 * The flow tile. `live` from readLive, `opts`: { t, lang, threshold, animations, byPower, time, forecastToday }.
 */
export function renderFlow(live, opts) {
  const { t, lang, threshold = 10 } = opts;
  const flows = liveFlows(live);
  const active = Object.fromEntries(Object.entries(flows).map(([k, w]) => [k, w > threshold]));
  const lines = Object.keys(PATHS)
    .map((k) => {
      if (!active[k]) return "";
      const cls = opts.animations === false ? "flowline static" : "flowline";
      return `<path class="${cls}" d="${PATHS[k]}" stroke="${COLORS[k]}" style="--dur:${duration(flows[k], opts.byPower !== false).toFixed(2)}s"/>`;
    })
    .join("");
  const exporting = pos(live.grid_export) > threshold && pos(live.grid_export) >= pos(live.grid_import);
  const gridColor = exporting ? "var(--eoc-exp)" : "var(--eoc-imp)";
  const gridW = exporting ? live.grid_export : live.grid_import;
  const batW =
    live.battery_charge === null
      ? null
      : pos(live.battery_charge) > threshold
        ? live.battery_charge
        : pos(live.battery_discharge) > threshold
          ? -live.battery_discharge
          : 0;
  const batText = batW === null ? "–" : `${batW > 0 ? "+" : batW < 0 ? "−" : ""}${fmtPower(Math.abs(batW), lang)}`;
  const on = {
    solar: active.solar_grid || active.solar_house || active.solar_battery,
    grid: active.grid_house || active.grid_battery || active.solar_grid,
    house: pos(live.house) > threshold,
    battery: active.solar_battery || active.battery_house || active.grid_battery,
  };
  const node = (k, color, val) =>
    `<div class="node${on[k] ? " on" : ""}" style="${at(NODES[k])};--c:${color}">${icon(k)}<b>${esc(val)}</b></div>`;
  const soc = Number.isFinite(live.soc) ? Math.max(0, Math.min(100, live.soc)) : null;
  const cap = live.capacity_kwh;
  const gridSub = exporting ? t("export") : t("import");
  const aria =
    t("flow_aria", {
      solar: fmtPower(live.solar, lang),
      grid: fmtPower(gridW, lang),
      gridSub,
      house: fmtPower(live.house, lang),
      bat: batText,
    }) + (soc === null ? "" : t("flow_aria_soc", { soc: Math.round(soc) }));
  const fc = opts.forecastToday;
  return `
  <div class="tile flow">
    <div class="flow-head"><span class="live">${esc(t("live"))}</span><span class="muted small">${esc(opts.time || "")}</span></div>
    <div class="stage" role="img" aria-label="${esc(aria)}">
      <svg class="lines" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        ${Object.values(PATHS)
          .map((d) => `<path class="track" d="${d}"/>`)
          .join("")}
        ${lines}
      </svg>
      ${node("solar", "var(--eoc-pv)", fmtPower(live.solar, lang))}
      ${node("grid", gridColor, fmtPower(gridW, lang))}
      ${node("house", "var(--eoc-house)", fmtPower(live.house, lang))}
      ${node("battery", "var(--eoc-bat)", batText)}
      <div class="label" style="${atX(192, 2)}">
        <div class="t">${esc(t("solar"))}</div>
        ${Number.isFinite(fc) ? `<div class="s">${esc(t("forecast_today", { v: fmtEnergy(fc, lang) }))}</div>` : ""}
      </div>
      <div class="label" style="${atX(40, 186)}">
        <div class="t">${esc(t("grid"))}</div>
        <div class="s ${exporting ? "tx-exp" : "tx-imp"}">${esc(gridSub)}</div>
      </div>
      <div class="label" style="${atX(346, 186)}">
        <div class="t">${esc(t("house"))}</div>
        <div class="s">${esc(t("consumption"))}</div>
      </div>
      <div class="label" style="${atX(192, 262)}">
        <div class="t">${esc(t("battery"))}${soc === null ? "" : ` · ${fmtNum(soc, lang, 0)} %`}</div>
        ${soc === null ? "" : `<div class="socbar" style="--c:${socColor(soc)}"><div style="width:${soc.toFixed(1)}%"></div></div>`}
        ${
          soc !== null && Number.isFinite(cap)
            ? `<div class="s">${esc(t("of", { a: fmtNum((soc / 100) * cap, lang, 2), b: fmtEnergy(cap, lang) }))}</div>`
            : ""
        }
      </div>
    </div>
  </div>`;
}
