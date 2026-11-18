// Illustrated header ("banner") in the style of juju35's cards: the title, the status pill and the subtitle on the sky
// at the left, one of three scenes at the right (`illustration_scene`), standing on a 10 px ground strip in the state
// colour. sun: the day arc of the sun with the PV power now and today's yield; balcony: two panels on a balcony
// railing feeding the Solarbank; curve: today's PV production as a landscape with the forecast. Night picture with
// Home Assistant's dark theme.
import { periodRange } from "./period.js";
import { esc, fmtEnergy, fmtPower, fmtTime } from "./shared.js";
import { daySun } from "./sun.js";
import { parts } from "./tz.js";

export const SCENES = ["sun", "balcony", "curve"];

/** The scene of the banner: `illustration_scene`, else the sun arc. */
export const sceneOf = (config) => (SCENES.includes(config?.illustration_scene) ? config.illustration_scene : "sun");

/** Night picture: forced by illustration_theme, else Home Assistant's dark theme alone. */
export const isNight = (hass, config) => {
  if (config.illustration_theme === "night") return true;
  if (config.illustration_theme === "day") return false;
  return !!hass?.themes?.darkMode;
};

/**
 * Ground strip colour from the live values: pv (yellow) while PV covers the home or feeds the battery or the grid,
 * imp (blue) while the grid supplies the home, bat (green) while the battery does, idle (grey) when nothing flows.
 */
export function groundOf(live, status, threshold = 10) {
  const on = (v) => Number.isFinite(v) && v > threshold;
  if (
    !status ||
    !["solar", "grid_import", "grid_export", "battery_charge", "battery_discharge"].some((k) => on(live?.[k]))
  )
    return "idle";
  if (status === "battery_house") return "bat";
  if (status === "grid_house") return "imp";
  return "pv";
}

// ---------- sun arc ----------

const ARC = { cx: 130, rx: 62, ry: 64, yb: 74 };

/** Position of the day between sunrise and sunset (0–1), or null when the sun is down (or the times are unknown). */
export function dayProgress(now, rise, set) {
  if (!rise || !set) return null;
  const t = now.getTime();
  const a = rise.getTime();
  const b = set.getTime();
  if (!(b > a) || t < a || t > b) return null;
  return (t - a) / (b - a);
}

/** Point on the arc for a day progress (0 = sunrise at the left, 1 = sunset at the right). */
export function arcPoint(p) {
  const a = Math.PI * (1 - p);
  return { x: ARC.cx + ARC.rx * Math.cos(a), y: ARC.yb - ARC.ry * Math.sin(a) };
}

// A crescent that reads at banner size: an outer circle with a large bite taken off its right side.
const moon = (x, y, r = 7) => {
  // The lit limb is a half circle; the terminator a shallower arc (radius 1.3 r), so the crescent is about half the
  // moon's radius wide in its middle.
  const R = (r * 1.3).toFixed(2);
  return `<path class="eb-moon" d="M${x} ${y - r}A${r} ${r} 0 0 0 ${x} ${y + r}A${R} ${R} 0 0 1 ${x} ${y - r}Z" transform="rotate(-20 ${x} ${y})"/>`;
};
const stars = (pts) =>
  pts.map(([x, y], i) => `<circle class="eb-star s${i % 3}" cx="${x}" cy="${y}" r=".9"/>`).join("");
const sunDisc = (x, y, r = 5.5) =>
  `<circle class="eb-glow" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 1.8).toFixed(1)}"/><circle class="eb-sun" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;

function sunScene(d) {
  const { cx, rx, ry, yb } = ARC;
  const p = dayProgress(d.now, d.rise, d.set);
  const all = `<path class="eb-arc" d="M${cx - rx} ${yb}A${rx} ${ry} 0 0 1 ${cx + rx} ${yb}"/>`;
  let body;
  if (p === null)
    body = `${moon(178, 14, 7.5)}${stars([
      [86, 10],
      [150, 6],
      [168, 30],
      [110, 18],
    ])}`;
  else {
    const s = arcPoint(p);
    body = `<path class="eb-arc-done" d="M${cx - rx} ${yb}A${rx} ${ry} 0 0 1 ${s.x.toFixed(1)} ${s.y.toFixed(1)}"/>${sunDisc(s.x, s.y)}`;
  }
  const tick = (date, x) =>
    date
      ? `<text class="eb-tick" x="${x}" y="79.5" text-anchor="middle">${esc(fmtTime(date, d.lang, d.tz))}</text>`
      : "";
  return `${all}${body}<line class="eb-horizon" x1="58" y1="${yb}" x2="200" y2="${yb}"/>${tick(d.rise, cx - rx)}${tick(d.set, cx + rx)}`;
}

// ---------- balcony ----------

function balconyScene(d) {
  const up = d.sunUp;
  const producing = Number.isFinite(d.live.solar) && d.live.solar > d.threshold;
  const charging = Number.isFinite(d.live.battery_charge) && d.live.battery_charge > d.threshold;
  const soc = Number.isFinite(d.live.soc) ? Math.max(0, Math.min(100, d.live.soc)) : null;
  const lit = soc === null ? 0 : Math.max(soc > 0 ? 1 : 0, Math.round(soc / 20));
  const sky = up
    ? `<g class="eb-rays${d.animate ? " anim" : ""}"><path d="M58 1.5V4.5M58 21.5V24.5M46.5 13H49.5M66.5 13H69.5M49.9 4.9L52 7M64 19L66.1 21.1M49.9 21.1L52 19M64 7L66.1 4.9"/></g>${sunDisc(58, 13)}${producing ? `<path class="eb-beam${d.animate ? " anim" : ""}" d="M64 18L78 40M66 16L118 40"/>` : ""}`
    : `${moon(64, 13, 7)}${stars([
        [90, 8],
        [120, 5],
        [146, 14],
      ])}`;
  const balusters = Array.from(
    { length: 18 },
    (_, k) => `<line x1="${44 + k * 9}" y1="35" x2="${44 + k * 9}" y2="78"/>`,
  ).join("");
  const panel = (x) => {
    const cells = [0, 1, 2]
      .map((r) =>
        [0, 1, 2]
          .map((c) => `<rect x="${x + 2 + c * 10.8}" y="${39 + r * 10.8}" width="10" height="10" rx=".5"/>`)
          .join(""),
      )
      .join("");
    return `<path class="eb-hook" d="M${x + 6} 32.5V38M${x + 30} 32.5V38"/><rect class="eb-pnl" x="${x}" y="37" width="36" height="36" rx="1.4"/><g class="eb-cell">${cells}</g><polygon class="eb-glare" points="${x + 2},39 ${x + 12},39 ${x + 4},71 ${x + 2},71"/>`;
  };
  const segs = [0, 1, 2, 3, 4]
    .map(
      (k) =>
        `<rect class="eb-seg${k < lit ? " on" : ""}${charging && d.animate && k === lit - 1 ? " pulse" : ""}" x="${166 + k * 5}" y="66" width="3.8" height="3" rx="1"/>`,
    )
    .join("");
  const cable = "M146 74C152 79 156 78 160 72";
  return `${sky}<g class="eb-baluster">${balusters}<line x1="40" y1="77" x2="200" y2="77"/></g>
    <rect class="eb-rail" x="38" y="31" width="162" height="3.4" rx="1.7"/>${panel(68)}${panel(110)}
    <path class="eb-cable" d="${cable}"/>${producing ? `<path class="eb-flow${d.animate ? " anim" : ""}" d="${cable}"/>` : ""}
    <ellipse class="eb-shadow" cx="178" cy="79.4" rx="20" ry="2"/>
    <rect class="eb-box" x="160" y="58" width="36" height="20" rx="4"/><rect class="eb-box-top" x="163" y="59.2" width="30" height="1.6" rx=".8"/>${segs}`;
}

// ---------- curve ----------

const CURVE = { h0: 4, h1: 22, x0: 58, x1: 198, base: 74, height: 50 };
const hx = (h) => CURVE.x0 + ((h - CURVE.h0) / (CURVE.h1 - CURVE.h0)) * (CURVE.x1 - CURVE.x0);

/**
 * Today's PV production as points { h, v } (hour of day, kW): the mean of every finished hour at its middle, then
 * the live power at `nowH`. The forecast (kWh per hour, the same as its mean kW) at the middle of every hour.
 * `slots` are the day's hours, `solar` / `forecast` their kWh (null when unknown).
 */
export function curvePoints({ slots, solar, forecast, nowH, liveKw, hourOf }) {
  const mid = (i) => hourOf(slots[i].start) + 0.5;
  const measured = [];
  if (solar)
    for (let i = 0; i < slots.length; i++) {
      const h = mid(i);
      if (h + 0.5 > nowH) break;
      if (Number.isFinite(solar[i])) measured.push({ h, v: Math.max(0, solar[i]) });
    }
  if (Number.isFinite(nowH) && Number.isFinite(liveKw)) measured.push({ h: nowH, v: Math.max(0, liveKw) });
  const fc = forecast ? forecast.map((v, i) => ({ h: mid(i), v: Math.max(0, Number(v) || 0) })) : [];
  return { measured, forecast: fc };
}

/** SVG paths of the curve scene: the filled area and line of the measured part, the dashed forecast line. */
export function curvePaths({ measured, forecast }) {
  const inWin = (p) => p.h >= CURVE.h0 && p.h <= CURVE.h1;
  const m = measured.filter(inWin);
  const f = forecast.filter(inWin);
  const peak = Math.max(0.3, ...m.map((p) => p.v), ...f.map((p) => p.v)) * 1.08;
  const y = (v) => CURVE.base - (v / peak) * CURVE.height;
  const line = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${hx(p.h).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
  const area = m.length
    ? `M${hx(m[0].h).toFixed(1)} ${CURVE.base}${line(m).replace(/^M/, "L")}L${hx(m.at(-1).h).toFixed(1)} ${CURVE.base}Z`
    : "";
  const last = m.at(-1);
  return {
    area,
    line: m.length > 1 ? line(m) : "",
    forecast: f.length > 1 ? line(f) : "",
    now: last ? { x: hx(last.h), y: y(last.v) } : null,
  };
}

function curveScene(d) {
  const c = d.curve ? curvePaths(d.curve) : { area: "", line: "", forecast: "", now: null };
  const sky = d.sunUp
    ? ""
    : `${moon(112, 14, 7)}${stars([
        [96, 8],
        [132, 6],
        [166, 34],
      ])}`;
  const marker = c.now
    ? `<line class="eb-now" x1="${c.now.x.toFixed(1)}" y1="${CURVE.base}" x2="${c.now.x.toFixed(1)}" y2="${(c.now.y - 6).toFixed(1)}"/>${
        d.sunUp
          ? sunDisc(c.now.x, c.now.y, 3.6)
          : `<circle class="eb-dot" cx="${c.now.x.toFixed(1)}" cy="${c.now.y.toFixed(1)}" r="2.4"/>`
      }`
    : "";
  const ticks = [6, 12, 18]
    .map((h) => `<text class="eb-tick" x="${hx(h).toFixed(1)}" y="79.5" text-anchor="middle">${h}</text>`)
    .join("");
  return `${sky}${c.forecast ? `<path class="eb-fc" d="${c.forecast}"/>` : ""}${c.area ? `<path class="eb-area" d="${c.area}"/>` : ""}${
    c.line ? `<path class="eb-line" d="${c.line}"/>` : ""
  }${marker}<line class="eb-horizon" x1="58" y1="${CURVE.base}" x2="200" y2="${CURVE.base}"/>${ticks}`;
}

// ---------- readouts ----------

/** The two readout lines of a scene: [big, small]. */
export function readout(scene, d) {
  const { t, lang, live, todayKwh, forecastKwh, threshold } = d;
  const today = Number.isFinite(todayKwh) ? fmtEnergy(todayKwh, lang) : null;
  const fc = Number.isFinite(forecastKwh) && forecastKwh > 0 ? fmtEnergy(forecastKwh, lang) : null;
  if (scene === "curve") {
    return [
      today ?? fmtPower(live.solar, lang),
      fc ? t("hb_forecast", { v: fc }) : t("hb_today_pv", { v: fmtPower(live.solar, lang) }),
    ];
  }
  if (scene === "balcony") {
    const on = (v) => Number.isFinite(v) && v > threshold;
    const bat = on(live.battery_charge)
      ? t("hb_bat_charge", { v: fmtPower(live.battery_charge, lang) })
      : on(live.battery_discharge)
        ? t("hb_bat_discharge", { v: fmtPower(live.battery_discharge, lang) })
        : t("hb_bat_idle");
    return [fmtPower(live.solar, lang), bat];
  }
  return [
    fmtPower(live.solar, lang),
    today ? (fc ? t("hb_today_of", { a: today, b: fc }) : t("hb_today", { v: today })) : "",
  ];
}

/**
 * The scene SVG with its readout drawn last. `d`: { scene, now, rise, set, sunUp, live, threshold, curve, todayKwh,
 * forecastKwh, t, lang, tz, animate }.
 */
export function sceneSVG(d) {
  const scene = d.scene;
  const art = scene === "balcony" ? balconyScene(d) : scene === "curve" ? curveScene(d) : sunScene(d);
  const [big, small] = readout(scene, d);
  const center = scene === "sun";
  const x = center ? ARC.cx : 196;
  const anchor = center ? "middle" : "end";
  const y1 = center ? 54 : 15;
  return `<svg class="scene eb-${scene}${d.animate ? " anim" : ""}" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
    ${art}
    <text class="eb-rd" x="${x}" y="${y1}" text-anchor="${anchor}">${esc(big)}</text>
    ${small ? `<text class="eb-rd2" x="${x}" y="${y1 + 9}" text-anchor="${anchor}">${esc(small)}</text>` : ""}
  </svg>`;
}

/**
 * The banner: badge, title with the status pill, subtitle, the scene and the ground strip. `button` is the open
 * (mini card) or close (dialog) button, drawn as a frosted round button top right.
 */
export function bannerHTML({ night, logo, color, name, sub, pill, ground, scene, button }) {
  return `<div class="banner${night ? " night" : ""}">
    ${scene}
    <div class="head">
      <div class="logo" style="--c:${color}">${logo}</div>
      <div class="titles">
        <div class="trow"><div class="name" title="${esc(name)}">${esc(name)}</div>${pill}</div>
        ${sub ? `<div class="sub" title="${esc(sub)}">${esc(sub)}</div>` : ""}
      </div>
    </div>
    <div class="ground g-${ground}"></div>
    ${button || ""}
  </div>`;
}

/**
 * The status pill in the banner: right after the title when the title and the whole pill fit on that row, else on its
 * own line under the subtitle; when even that runs into the ground strip, its dot alone. Measured after each render.
 */
export function fitPill(root) {
  for (const t of root?.querySelectorAll?.(".banner .titles") || []) {
    t.classList.remove("below", "dotonly");
    const name = t.querySelector(".name");
    const pill = t.querySelector(".pill");
    if (!name || !pill || !t.clientWidth) continue;
    if (name.scrollWidth + 8 + pill.scrollWidth <= t.clientWidth + 0.5) continue;
    t.classList.add("below");
    const floor = t.closest(".banner").getBoundingClientRect().bottom - 10 + 0.5;
    if (pill.getBoundingClientRect().bottom > floor) t.classList.add("dotonly");
  }
}

const tick = (a, b) =>
  `repeating-linear-gradient(90deg, var(--t) 0 1px, transparent 1px 12px), linear-gradient(90deg, ${a}, ${b})`;

export const BANNER_STYLE = `
.banner { position: relative; overflow: hidden; height: 90px; flex: none; --g: 10px; --sw: min(200px, 54cqw); color: #0d2a45; --sky-muted: #3b5b78;
          background: linear-gradient(90deg, #f1f8ff 0%, #e2f1fd 34%, #b9def8 70%, #9fd0f3 100%); }
.banner.night { color: #fff; --sky-muted: rgba(255,255,255,.78); background: linear-gradient(90deg, #1b2f52 0%, #15284a 36%, #0f1f3d 72%, #0a1830 100%); }
ha-card > .sec > .banner, ha-card > .banner { margin: -16px -16px 0; }
.banner .scene { position: absolute; right: 0; bottom: var(--g); height: calc(100% - var(--g)); width: var(--sw); overflow: visible;
                 -webkit-mask-image: linear-gradient(90deg, rgba(0,0,0,.35) 0, rgba(0,0,0,.35) 12%, #000 42%);
                 mask-image: linear-gradient(90deg, rgba(0,0,0,.35) 0, rgba(0,0,0,.35) 12%, #000 42%); }
.banner .ground { position: absolute; left: 0; right: 0; bottom: 0; height: var(--g); --t: rgba(255,255,255,.55); }
.banner.night .ground { --t: rgba(255,255,255,.22); }
.ground.g-pv { background-image: ${tick("#ffd978", "#f2a516")}; box-shadow: inset 0 2px 0 #ffe9a8; }
.night .ground.g-pv { background-image: ${tick("#6b5420", "#4d3a12")}; box-shadow: inset 0 2px 0 #7d6428; }
.ground.g-imp { background-image: ${tick("#8cc0f5", "#2f80ed")}; box-shadow: inset 0 2px 0 #b9d8fa; }
.night .ground.g-imp { background-image: ${tick("#1f3e66", "#16304f")}; box-shadow: inset 0 2px 0 #2a4d7a; }
.ground.g-bat { background-image: ${tick("#8fd47a", "#43a047")}; box-shadow: inset 0 2px 0 #b5e3a5; }
.night .ground.g-bat { background-image: ${tick("#2a5a2c", "#1c4220")}; box-shadow: inset 0 2px 0 #356a38; }
.ground.g-idle { background-image: ${tick("#d3d8de", "#aab2bb")}; box-shadow: inset 0 2px 0 #e6e9ed; }
.night .ground.g-idle { background-image: ${tick("#3a414b", "#2b3139")}; box-shadow: inset 0 2px 0 #4a525d; }
.banner .head { position: absolute; z-index: 1; left: 0; top: 0; bottom: var(--g); right: calc(var(--sw) - 60px); display: flex; align-items: center;
                gap: 10px; padding: 8px 8px 8px 14px; min-width: 0; }
.banner .logo { background: rgba(255,255,255,.62); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 28%, transparent);
                color: color-mix(in srgb, var(--c) 82%, #0d2a45); --mdc-icon-size: 24px; }
.banner .logo .icon { width: 24px; height: 24px; }
.banner.night .logo { background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); color: color-mix(in srgb, var(--c) 75%, #fff); }
.banner .titles { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-self: stretch; }
.banner .trow { display: flex; align-items: center; gap: 8px; min-width: 0; }
.banner .name { flex: 0 1 auto; min-width: 0; font-size: 16px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.banner .sub { font-size: 13px; color: var(--sky-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.banner .pill { flex: none; align-self: center; margin: 0; max-width: 100%; padding: 1px 8px; font-size: 11px; line-height: 16px; gap: 4px;
                background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
.banner.night .pill { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #fff); }
.banner .titles.below .trow { display: contents; }
.banner .titles.below .pill { order: 9; align-self: flex-start; margin-top: 3px; }
.banner .titles.dotonly .pill { padding: 4px; } .banner .titles.dotonly .pill > span:last-child { display: none; }
.banner .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; margin: 0; width: 24px; height: 24px; border-radius: 50%; color: #33506b;
                background: rgba(255,255,255,.55); box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.banner .zoom .icon { width: 15px; height: 15px; }
.banner .zoom:hover { background: rgba(255,255,255,.75); color: #33506b; }
.banner.night .zoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
.banner.night .zoom:hover { background: rgba(255,255,255,.22); }
.banner:has(> .zoom) .scene { right: 34px; }
.banner:has(> .zoom) .head { right: calc(var(--sw) - 24px); }
@container (max-width: 280px) { .banner .scene { display: none; } .banner .head, .banner:has(> .zoom) .head { right: 30px; } }
@container (max-width: 200px) { .banner .pill { padding: 4px; } .banner .pill > span:last-child { display: none; } }
/* The mini card under its banner */
ha-card.mini-b { padding: 0; gap: 0; container-type: inline-size; }
ha-card.mini-b > .banner { margin: 0; }
.mini-b .row2 { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 10px 16px 12px; font-size: 13px; color: var(--eoc-sub); align-items: center; }
.mini-b .row2 b { font-weight: 500; }
.mini-b .socmini { font-weight: 600; color: var(--eoc-text); }
/* Scenes */
.eb-sun { fill: #ffc533; } .eb-glow { fill: #ffc533; opacity: .25; }
.anim .eb-glow { animation: eb-pulse 3s ease-in-out infinite; }
.eb-moon { fill: #f3e9c6; } .banner:not(.night) .eb-moon { fill: #fff7d6; stroke: #c8b98a; stroke-width: .6; }
.eb-star { fill: #fff; } .banner:not(.night) .eb-star { fill: #8fb3d6; }
.anim .eb-star { animation: eb-blink 2.6s ease-in-out infinite; } .eb-star.s1 { animation-delay: .9s; } .eb-star.s2 { animation-delay: 1.7s; }
.eb-arc { fill: none; stroke: #9bb7d4; stroke-width: 1; stroke-dasharray: 2 3; } .night .eb-arc { stroke: #4b5f80; }
.eb-arc-done { fill: none; stroke: #f2b632; stroke-width: 1.6; }
.eb-horizon { stroke: #9bb0c6; stroke-width: .8; } .night .eb-horizon { stroke: #3e4f6c; }
.eb-tick { font: 500 5.2px var(--paper-font-body1_-_font-family, Roboto, sans-serif); fill: #5d7590; } .night .eb-tick { fill: #8fa3c0; }
.eb-rays { stroke: #ffc533; stroke-width: 1.6; stroke-linecap: round; transform-box: fill-box; transform-origin: center; }
.eb-rays.anim { animation: eb-spin 14s linear infinite; }
.eb-beam { stroke: #ffd977; stroke-width: 1; stroke-dasharray: 2 3; opacity: .8; }
.eb-beam.anim { animation: eb-dash 1.4s linear infinite; }
.eb-baluster line { stroke: #c4ced9; stroke-width: 1.2; } .night .eb-baluster line { stroke: #34445c; }
.eb-rail { fill: #aab6c3; } .night .eb-rail { fill: #4a5b75; }
.eb-hook { fill: none; stroke: #7d8894; stroke-width: 1.4; }
.eb-pnl { fill: #1b3560; stroke: #c9d2dc; stroke-width: 1.2; } .night .eb-pnl { fill: #11223f; stroke: #56688a; }
.eb-cell rect { fill: #2c5aa0; } .night .eb-cell rect { fill: #1d3d70; }
.eb-glare { fill: rgba(255,255,255,.16); } .night .eb-glare { fill: rgba(255,255,255,.06); }
.eb-cable { fill: none; stroke: #5d6672; stroke-width: 1.6; stroke-linecap: round; } .night .eb-cable { stroke: #7a8494; }
.eb-flow { fill: none; stroke: #f2b632; stroke-width: 2; stroke-dasharray: 3 4; stroke-linecap: round; }
.eb-flow.anim { animation: eb-dash .8s linear infinite; }
.eb-shadow { fill: #000; opacity: .14; } .night .eb-shadow { opacity: .35; }
.eb-box { fill: #2f3540; } .night .eb-box { fill: #1c2129; stroke: #3c4452; stroke-width: .8; }
.eb-box-top { fill: rgba(255,255,255,.18); }
.eb-seg { fill: #4a525e; } .eb-seg.on { fill: #5fd08a; } .eb-seg.pulse { animation: eb-blink 1.4s ease-in-out infinite; }
.eb-fc { fill: none; stroke: #e0a21c; stroke-width: 1; stroke-dasharray: 2.5 2.5; opacity: .75; }
.eb-area { fill: #f6c44b; opacity: .45; } .night .eb-area { fill: #9b7a26; opacity: .5; }
.eb-line { fill: none; stroke: #e09a00; stroke-width: 1.4; stroke-linejoin: round; } .night .eb-line { stroke: #ffc54d; }
.eb-now { stroke: #e09a00; stroke-width: .8; stroke-dasharray: 1.5 1.5; }
.eb-dot { fill: #ffc54d; }
.eb-rd { font: 700 12.5px var(--paper-font-body1_-_font-family, Roboto, sans-serif); fill: #c98400; } .night .eb-rd { fill: #ffc54d; }
.eb-rd2 { font: 500 6.6px var(--paper-font-body1_-_font-family, Roboto, sans-serif); fill: #3b5b78; } .night .eb-rd2 { fill: rgba(255,255,255,.78); }
@keyframes eb-pulse { 50% { opacity: .1; } }
@keyframes eb-blink { 50% { opacity: .3; } }
@keyframes eb-spin { to { transform: rotate(360deg); } }
@keyframes eb-dash { to { stroke-dashoffset: -14; } }
@media (prefers-reduced-motion: reduce) { .banner * { animation: none !important; } }
`;

/** Hour of the day (with minutes as a fraction) in the server's time zone. */
export const hourOf = (date, tz) => {
  const p = parts(date.getTime(), tz);
  return p.h + p.mi / 60;
};

/**
 * The whole banner from the card's state. `today`: { slots, solar, forecast, total, forecastKwh } of the current day
 * (null until loaded); `pill` its HTML, `color` the status colour of the badge, `button` the corner button.
 */
export function renderBanner({
  hass,
  config,
  live,
  status,
  today,
  t,
  lang,
  tz,
  now = new Date(),
  logo,
  color,
  name,
  sub,
  pill,
  button,
}) {
  const scene = sceneOf(config);
  const threshold = Number(config.threshold_w) || 0;
  const sun = daySun(hass, periodRange("day", now, { tz }));
  const sunUp = sun.polar === "day" || dayProgress(now, sun.rise, sun.set) !== null;
  const nowH = hourOf(now, tz);
  const curve =
    scene === "curve" && today?.slots
      ? curvePoints({
          slots: today.slots,
          solar: today.solar,
          forecast: today.forecast,
          nowH,
          liveKw: Number.isFinite(live.solar) ? live.solar / 1000 : null,
          hourOf: (d) => hourOf(d, tz),
        })
      : null;
  const art = sceneSVG({
    scene,
    now,
    rise: sun.rise,
    set: sun.set,
    sunUp,
    live,
    threshold,
    curve,
    todayKwh: today?.total ?? null,
    forecastKwh: today?.forecastKwh ?? null,
    t,
    lang,
    tz,
    animate: config.animations !== false,
  });
  return bannerHTML({
    night: isNight(hass, config),
    logo,
    color,
    name,
    sub,
    pill,
    ground: groundOf(live, status, threshold),
    scene: art,
    button,
  });
}
