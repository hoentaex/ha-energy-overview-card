// Balance card: grid on the left, today's home consumption as a ring split by source in the middle, own energy
// (solar + battery) on the right. Wires between them carry a moving light while power flows right now.
import { liveFlows } from "./flow.js";
import { svgIcon } from "./icons.js";
import { esc, fmtEnergy, fmtPower } from "./shared.js";

// Ring: r = 48, a 270° arc from bottom left over the top to bottom right. Each segment is its own arc path (dash
// patterns on one circle leave slivers of the track showing at the ends in Chrome). Lengths along the arc in px.
const C = 2 * Math.PI * 48;
const ARC = 0.75 * C;
const CAP = 5; // round cap of the 10 px stroke
const GAP = 4;
const SEGS = [
  ["grid", "var(--eoc-imp)"],
  ["battery", "var(--eoc-bat)"],
  ["solar", "var(--eoc-pv)"],
];

/** Dash pattern of each ring segment: grid, battery, solar from the left. Zero shares are left out. */
export function ringSegments(parts) {
  const total = SEGS.reduce((s, [k]) => s + (parts[k] || 0), 0);
  if (!(total > 0)) return [];
  const out = [];
  let start = 0;
  for (const [key, color] of SEGS) {
    const len = (ARC * (parts[key] || 0)) / total;
    if (len >= ARC * 0.005) {
      // Gaps only between segments; the outer ends line up with the track.
      const a = start + CAP + (start > 0.01 ? GAP / 2 : 0);
      const b = start + len - CAP - (start + len < ARC - 0.01 ? GAP / 2 : 0);
      out.push({ key, color, from: +a.toFixed(2), len: +Math.max(0.1, b - a).toFixed(2) });
    }
    start += len;
  }
  return out;
}

/** SVG arc along the ring from `from` for `len` px (0 = bottom left end of the 270° arc). */
export function arcPath(from, len) {
  const pt = (u) => {
    const a = ((135 + (u / C) * 360) * Math.PI) / 180;
    return `${(60 + 48 * Math.cos(a)).toFixed(2)} ${(60 + 48 * Math.sin(a)).toFixed(2)}`;
  };
  return `M${pt(from)} A48 48 0 ${len > C / 2 ? 1 : 0} 1 ${pt(from + len)}`;
}

/** Light period of a wire: 2.4 s at the threshold, down to 0.9 s from 3 kW. */
const period = (w, byPower) => (byPower ? Math.max(0.9, 2.4 - (1.5 * Math.min(w, 3000)) / 3000) : 1.6).toFixed(2);

/** What flows right now: into the home from the grid (or out as export) and from solar / battery. */
export function balanceLive(live, threshold) {
  const f = liveFlows(live);
  const th = threshold || 0;
  const exp = Number(live.grid_export) || 0;
  const imp = f.grid_house;
  const own = f.solar_house + f.battery_house;
  const left =
    exp > th && exp >= imp
      ? { dir: "out", w: exp, color: "var(--eoc-exp)", cls: "tx-exp", arrow: "↑" }
      : imp > th
        ? { dir: "in", w: imp, color: "var(--eoc-imp)", cls: "tx-imp", arrow: "↓" }
        : null;
  const right =
    own > th
      ? f.battery_house > f.solar_house
        ? { dir: "in", w: own, color: "var(--eoc-bat)", cls: "tx-bat" }
        : { dir: "in", w: own, color: "var(--eoc-pv)", cls: "tx-pv" }
      : null;
  return { left, right, imp, exp, own };
}

const wire = (side, flow, opts) => {
  if (!flow || opts.animations === false) return `<div class="wire" aria-hidden="true"></div>`;
  return `<div class="wire on ${flow.dir} ${side}" style="--c:${flow.color};--d:${period(flow.w, opts.byPower)}s" aria-hidden="true"><i></i><i></i></div>`;
};

/**
 * The card's inner HTML. `today` holds the day's totals (house_from_grid / _battery / _solar, consumption,
 * autarky) or null while loading; `live` the current power values.
 */
export function renderBalance(today, live, opts) {
  const { t, lang } = opts;
  const parts = {
    grid: today?.house_from_grid || 0,
    battery: today?.house_from_battery || 0,
    solar: today?.house_from_solar || 0,
  };
  const has = !!today;
  const home = has ? (today.consumption ?? parts.grid + parts.battery + parts.solar) : null;
  const own = parts.battery + parts.solar;
  const now = balanceLive(live, opts.threshold);
  const segs = ringSegments(parts);
  const autarky = has && Number.isFinite(today.autarky) ? Math.round(today.autarky * 100) : null;
  const leftNow = now.left
    ? `<span class="${now.left.cls}">${now.left.arrow} ${esc(fmtPower(now.left.w, lang))}</span>`
    : `${esc(fmtPower(0, lang))}`;
  const ownNow = now.right
    ? `<span class="${now.right.cls}">${esc(fmtPower(now.right.w, lang))}</span>`
    : esc(fmtPower(0, lang));
  const ring = segs
    .map(
      (s) =>
        `<path class="seg" data-p="seg-${s.key}" d="${arcPath(s.from, s.len)}" stroke="${s.color}" style="--l:${s.len}"/>`,
    )
    .join("");
  const label = t("bal_aria", {
    home: fmtEnergy(home, lang),
    grid: fmtEnergy(parts.grid, lang),
    own: fmtEnergy(own, lang),
  });
  return {
    // Same shape → the card patches values in place, so running animations and the ring transition keep going.
    shape: [segs.map((s) => s.key).join(","), now.left?.dir, now.left?.color, now.right?.color, has].join("|"),
    html: `<div class="side l">
        <div class="logo" style="--c:var(--eoc-imp)">${svgIcon("tower")}</div>
        <div class="txt">
          <div class="v tx-imp" data-p="grid">${esc(has ? fmtEnergy(parts.grid, lang) : "–")}</div>
          <div class="lb">${esc(t("bal_from_grid"))}</div>
          ${wire("l", now.left, opts)}
          <div class="now" data-p="grid-now">${leftNow}</div>
        </div>
      </div>
      <div class="ringbox">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <path class="track" d="${arcPath(CAP, ARC - 2 * CAP)}"/>
          <g class="segs${opts.intro && opts.animations !== false ? " intro" : ""}">${ring}</g>
        </svg>
        <div class="center">
          <span class="hicon">${svgIcon("home")}</span>
          <b data-p="home">${esc(has ? fmtEnergy(home, lang) : "–")}</b>
          <span>${esc(t("bal_home"))}</span>
        </div>
        ${autarky === null ? "" : `<div class="aut" data-p="aut">${esc(t("mini_autarky", { v: autarky }))}</div>`}
      </div>
      <div class="side r">
        <div class="txt">
          <div class="v tx-pv" data-p="own">${esc(has ? fmtEnergy(own, lang) : "–")}</div>
          <div class="lb">${esc(t(parts.battery > 0 ? "bal_own" : "bal_from_pv"))}</div>
          ${wire("r", now.right, opts)}
          <div class="now" data-p="own-now">${ownNow}</div>
        </div>
        <div class="logo" style="--c:var(--eoc-pv)">${svgIcon("panel")}</div>
      </div>`,
    label,
  };
}

/** Copies values of a freshly rendered tree into the live one (text, ring arcs) without rebuilding it. */
export function patchBalance(root, fresh) {
  for (const el of fresh.querySelectorAll("[data-p]")) {
    const cur = root.querySelector(`[data-p="${el.dataset.p}"]`);
    if (!cur) return false;
    if (el.tagName.toLowerCase() === "path") {
      cur.setAttribute("d", el.getAttribute("d"));
    } else if (cur.innerHTML !== el.innerHTML) cur.innerHTML = el.innerHTML;
  }
  return true;
}

export const BALANCE_STYLE = `
.bal { padding: 14px 16px; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0; cursor: pointer; container-type: inline-size; }
.bal:focus-visible { outline: 2px solid var(--eoc-accent); outline-offset: -2px; }
.bal .side { display: flex; align-items: center; gap: 12px; min-width: 0; }
.bal .side.r { justify-content: flex-end; text-align: right; }
.bal .logo { width: 44px; height: 44px; }
.bal .logo .icon { width: 24px; height: 24px; }
.bal .txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 auto; }
.bal .side.r .txt { align-items: flex-end; }
.bal .v { font-size: 20px; font-weight: 500; line-height: 1.2; white-space: nowrap; font-variant-numeric: tabular-nums; }
.bal .lb { font-size: 13px; color: var(--eoc-sub); white-space: nowrap; }
.bal .now { font-size: 12px; color: var(--eoc-sub); white-space: nowrap; margin-top: 2px; font-variant-numeric: tabular-nums; }
.bal .wire { align-self: stretch; height: 2px; margin: 7px 0 5px; position: relative; border-radius: 1px; background: var(--eoc-line); opacity: .7; }
.bal .wire.on { opacity: 1; background: linear-gradient(90deg, color-mix(in srgb, var(--c) 10%, transparent), color-mix(in srgb, var(--c) 45%, transparent)); box-shadow: 0 0 6px color-mix(in srgb, var(--c) 35%, transparent); }
.bal .wire.on.r { background: linear-gradient(270deg, color-mix(in srgb, var(--c) 10%, transparent), color-mix(in srgb, var(--c) 45%, transparent)); }
.bal .wire i { position: absolute; top: 50%; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px; border-radius: 50%; background: var(--c); box-shadow: 0 0 8px 2px color-mix(in srgb, var(--c) 70%, transparent); opacity: 0; animation: eoc-wire var(--d) linear infinite; }
.bal .wire i:nth-child(2) { animation-delay: calc(var(--d) / -2); }
.bal .wire.l.out i, .bal .wire.r.in i { animation-name: eoc-wire-rev; }
@keyframes eoc-wire { 0% { left: 0; opacity: 0; } 15%, 80% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
@keyframes eoc-wire-rev { 0% { left: 100%; opacity: 0; } 15%, 80% { opacity: 1; } 100% { left: 0; opacity: 0; } }
.bal .ringbox { position: relative; width: 128px; height: 128px; margin: -4px 10px; }
.bal .ringbox > svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.bal .track { fill: none; stroke: var(--eoc-line); stroke-width: 10; stroke-linecap: round; }
.bal .seg { fill: none; stroke-width: 10; stroke-linecap: round; }
.bal .segs { filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.08)); }
.bal .segs.intro .seg { animation: eoc-sweep 1.1s cubic-bezier(.3, .7, .2, 1) both; }
.bal .segs.intro .seg:nth-child(2) { animation-delay: .12s; }
.bal .segs.intro .seg:nth-child(3) { animation-delay: .24s; }
@keyframes eoc-sweep { from { stroke-dasharray: 0 400; } to { stroke-dasharray: calc(var(--l) * 1px) 400; } }
.bal .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; padding-bottom: 4px; text-align: center; }
.bal .center b { font-size: 16px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.bal .center span:last-child { font-size: 12px; color: var(--eoc-sub); }
.bal .hicon { color: var(--eoc-house); display: block; width: 20px; height: 20px; margin-bottom: 1px; animation: eoc-breathe 4s ease-in-out infinite; }
.bal .hicon .icon { display: block; width: 20px; height: 20px; }
@keyframes eoc-breathe { 50% { opacity: .55; } }
.bal .aut { position: absolute; left: 50%; bottom: 2px; transform: translateX(-50%); font-size: 11px; font-weight: 500; white-space: nowrap; padding: 1px 8px; border-radius: 10px; color: color-mix(in srgb, var(--eoc-bat) 62%, var(--eoc-text)); background: color-mix(in srgb, var(--eoc-bat) 15%, transparent); }
@container (max-width: 470px) { .bal .side { gap: 7px; } .bal .logo { width: 34px; height: 34px; } .bal .logo .icon { width: 19px; height: 19px; } .bal .v { font-size: 16px; } .bal .lb { font-size: 12px; } .bal .now { font-size: 11px; } .bal .ringbox { width: 112px; height: 112px; margin: -4px 4px; } }
@container (max-width: 330px) { .bal .logo, .bal .now { display: none; } }
@media (prefers-reduced-motion: reduce) { .bal .wire i, .bal .hicon { animation: none; } .bal .wire i { display: none; } .bal .segs.intro .seg { animation: none; } }
`;
