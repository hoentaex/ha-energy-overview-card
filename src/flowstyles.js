// Alternative live-flow styles next to the ellipse (flow.js): a house scene on a weather sky, energy bands
// (sources → sinks) and a ring of the home consumption by source. Pure functions; the images come in through
// setFlowAssets() so that this module stays importable without a bundler (tests).
import { liveFlows } from "./flow.js";
import { svgIcon } from "./icons.js";
import { esc, fmtNum, fmtPower } from "./shared.js";

let ASSETS = { house: {}, sky: {} };
/** Registers the image URLs: { house: { day, night }, sky: { "day-clear": url, … } }. */
export const setFlowAssets = (a) => {
  ASSETS = a;
};

export const FLOW_STYLES = ["ellipse", "house", "sankey", "ring"];

const C = {
  pv: "var(--eoc-pv)",
  bat: "var(--eoc-bat)",
  imp: "var(--eoc-imp)",
  exp: "var(--eoc-exp)",
  gc: "var(--eoc-gridcharge)",
  house: "var(--eoc-house)",
};
const pos = (v) => (Number.isFinite(v) && v > 0 ? v : 0);

// ---------- sky ----------

/** HA weather condition → one of clear, partly, cloudy, rainy, snowy, fog. */
export function normWeather(state) {
  if (!state) return "clear";
  if (["sunny", "clear-night"].includes(state)) return "clear";
  if (state === "partlycloudy") return "partly";
  if (["rainy", "pouring", "lightning", "lightning-rainy", "hail"].includes(state)) return "rainy";
  if (["snowy", "snowy-rainy"].includes(state)) return "snowy";
  if (state === "fog") return "fog";
  return "cloudy";
}

/** Background image key from the weather and the sun's elevation (°): day, dusk (−4…8°) or night. */
export function skyKey(weather, elevation) {
  const w = normWeather(weather);
  const night = weather === "clear-night" || elevation < -4;
  const dusk = !night && elevation < 8;
  const clear = w === "clear" || w === "partly";
  if (night) return `night-${clear ? "clear" : w}`;
  if (dusk && (clear || w === "cloudy")) return clear ? "dusk-clear" : "dusk-cloudy";
  return `day-${w === "partly" ? "cloudy" : w}`;
}

/** Weather condition and sun elevation from the states (sun.sun; without it: day). */
export function skyState(hass, config) {
  const sun = hass?.states?.["sun.sun"];
  let elevation = Number(sun?.attributes?.elevation);
  if (!Number.isFinite(elevation)) elevation = sun?.state === "below_horizon" ? -10 : 30;
  const weather = config.weather_entity ? hass?.states?.[config.weather_entity]?.state : null;
  const key = skyKey(weather, elevation);
  const w = normWeather(weather);
  const fx = w === "rainy" ? "rain" : w === "snowy" ? "snow" : key === "night-clear" ? "stars" : "";
  return { key, fx, night: elevation < 6 || weather === "clear-night" };
}

/** Sky layer; `data-keep` lets the card keep the node (and its canvas) across live updates. */
const skyLayer = (sky, animations) =>
  `<div class="sky" data-keep="sky:${sky.key}:${animations ? sky.fx : ""}" aria-hidden="true">
    <div class="sky-img" style="background-image:url('${ASSETS.sky[sky.key] || ""}')"></div>
    ${sky.fx && animations ? `<canvas class="sky-fx" data-kind="${sky.fx}"></canvas>` : ""}
    <div class="sky-shade"></div>
  </div>`;

const tile = (cls, opts, inner) =>
  `<div class="tile flow ${cls}${opts.sky ? " skyed" : ""}">
    ${opts.sky ? skyLayer(opts.sky, opts.animations !== false) : ""}
    <div class="flow-head"><span class="tile-title live">${esc(opts.t("live"))}</span><span class="muted small">${esc(opts.time || "")}</span></div>
    ${inner}
  </div>`;

// ---------- shared flow numbers ----------

/** Flows with the threshold applied, plus the colour of whatever feeds the home most. */
export function flowParts(live, threshold = 0) {
  const f = liveFlows(live);
  const on = (w) => (w > threshold ? w : 0);
  const flows = Object.fromEntries(Object.entries(f).map(([k, w]) => [k, on(w)]));
  const house = pos(live.house);
  const toHouse = [
    ["solar", flows.solar_house, C.pv],
    ["battery", flows.battery_house, C.bat],
    ["grid", flows.grid_house, C.imp],
  ];
  const main = toHouse.slice().sort((a, b) => b[1] - a[1])[0];
  return {
    flows,
    house,
    toHouse: Object.fromEntries(toHouse.map(([k, w]) => [k, w])),
    houseColor: main[1] > 0 ? main[2] : C.house,
    solar: on(pos(live.solar)),
    charge: on(pos(live.battery_charge)),
    discharge: on(pos(live.battery_discharge)),
    import: on(pos(live.grid_import)),
    export: on(pos(live.grid_export)),
  };
}

const dur = (w, byPower) => (byPower ? Math.max(1.2, 4 - Math.log10(w + 1) * 0.95) : 2.2).toFixed(2);

// ---------- house scene ----------

// Pixels of the 1536 × 1024 render. Each leg runs from its node to the meter box (the hub), listed node → hub.
const HOUSE = {
  legs: {
    solar: [
      [850, 334],
      [850, 545],
      [940, 545],
    ],
    house: [
      [735, 630],
      [860, 630],
      [860, 578],
      [940, 578],
    ],
    battery: [
      [1040, 740],
      [985, 740],
      [985, 600],
    ],
    grid: [
      [1403, 315],
      [1403, 555],
      [1003, 555],
    ],
  },
  chips: { solar: [770, 62, "c"], house: [560, 905, "c"], battery: [1160, 915, "c"], grid: [1500, 170, "r"] },
  batIcon: [1100, 734, 36, 72],
};

/** Orthogonal polyline → path with rounded corners. */
export function roundPath(pts, r = 24) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(cx - px, cy - py);
    const l2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [cx - ((cx - px) / l1) * rr, cy - ((cy - py) / l1) * rr];
    const b = [cx + ((nx - cx) / l2) * rr, cy + ((ny - cy) / l2) * rr];
    d += ` L${a[0]} ${a[1]} Q${cx} ${cy} ${b[0]} ${b[1]}`;
  }
  const e = pts[pts.length - 1];
  return `${d} L${e[0]} ${e[1]}`;
}

/** Point and direction (degrees) at a fraction of a polyline's length. */
export function along(pts, frac) {
  const segs = pts.slice(1).map((p, i) => [pts[i], p, Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])]);
  let rest = segs.reduce((a, s) => a + s[2], 0) * frac;
  for (let i = 0; i < segs.length; i++) {
    const [a, b, l] = segs[i];
    if (rest <= l || i === segs.length - 1) {
      const f = l ? Math.min(1, rest / l) : 0;
      return {
        x: a[0] + (b[0] - a[0]) * f,
        y: a[1] + (b[1] - a[1]) * f,
        ang: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
      };
    }
    rest -= l;
  }
  return { x: pts[0][0], y: pts[0][1], ang: 0 };
}

function leg(pts, w, color, outward, opts) {
  const base = `<path class="h-track" d="${roundPath(pts)}"/>`;
  if (!w) return base;
  const p = outward ? pts : [...pts].reverse();
  const d = roundPath(p);
  const sw = Math.min(9, 5 + Math.log10(w + 1));
  const arrow = (f) => {
    const a = along(p, f);
    return `<path class="h-arrow" filter="url(#eoc-hsoft)" d="M-13 -11 L5 0 L-13 11" transform="translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${a.ang.toFixed(0)})"/>`;
  };
  const comet =
    opts.animations === false
      ? ""
      : `<path class="h-comet" d="${d}" pathLength="1000" stroke-width="${(sw * 0.55).toFixed(1)}" style="--dur:${dur(w, opts.byPower !== false)}s"/>`;
  return `<g style="color:${color}">
    <path class="h-glow" filter="url(#eoc-hglow)" d="${d}" stroke-width="${(sw * 3.2).toFixed(1)}"/>
    <path class="h-line" filter="url(#eoc-hsoft)" d="${d}" stroke-width="${sw.toFixed(1)}"/>
    ${comet}${arrow(0.5)}${arrow(0.985)}
  </g>`;
}

function batteryGlow(p, soc, animations) {
  if (!p.charge && !p.discharge) return "";
  const [x, y, w, h] = HOUSE.batIcon;
  const lit = Number.isFinite(soc) ? Math.max(1, Math.ceil(soc / 33.4)) : 3;
  const bars = [0, 1, 2]
    .map(
      (i) =>
        `<rect x="-11" y="${15 - i * 16}" width="22" height="12" rx="1.5" fill="currentColor" opacity="${i < lit ? 1 : 0.18}"/>`,
    )
    .join("");
  return `<g class="h-bat${animations === false ? "" : " pulse"}" filter="url(#eoc-hsoft)" style="color:${p.charge ? C.gc : C.bat}" transform="translate(${x} ${y}) scale(${w / 36} ${h / 72})">
    <rect x="-6" y="-36" width="12" height="6" rx="1.5" fill="currentColor"/>
    <rect x="-16" y="-30" width="32" height="64" rx="4" fill="none" stroke="currentColor" stroke-width="3.5"/>${bars}</g>`;
}

export function renderHouse(live, opts) {
  const { t, lang } = opts;
  const p = flowParts(live, opts.threshold);
  const soc = Number.isFinite(live.soc) ? Math.max(0, Math.min(100, live.soc)) : null;
  const L = HOUSE.legs;
  const exporting = p.export > 0 && p.export >= p.import;
  const legs = [
    leg(L.solar, p.solar, C.pv, true, opts),
    leg(L.house, p.house > (opts.threshold || 0) ? p.house : 0, p.houseColor, false, opts),
    leg(L.battery, p.charge || p.discharge, p.discharge ? C.bat : C.gc, !!p.discharge && !p.charge, opts),
    leg(L.grid, exporting ? p.export : p.import, exporting ? C.exp : C.imp, !exporting, opts),
  ].join("");
  const chip = (k, title, val, sub, color) => {
    const [x, y, al] = HOUSE.chips[k];
    return `<div class="h-chip ${al}" style="left:${((x / 1536) * 100).toFixed(2)}%;top:${((y / 1024) * 100).toFixed(2)}%;--c:${color}">
      <i></i><div><small>${esc(title)}</small><b>${esc(val)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div></div>`;
  };
  const batW = p.charge || p.discharge;
  const batSub = p.charge ? t("charging") : p.discharge ? t("discharging") : t("standby");
  const img = opts.sky?.night ? ASSETS.house.night : ASSETS.house.day;
  const aria = t("flow_aria", {
    solar: fmtPower(live.solar, lang),
    grid: fmtPower(exporting ? live.grid_export : live.grid_import, lang),
    gridSub: exporting ? t("export") : t("import"),
    house: fmtPower(live.house, lang),
    bat: batSub,
  });
  return tile(
    "fs-house",
    opts,
    `<div class="scene" role="img" aria-label="${esc(aria)}">
      ${img ? `<img data-keep="house:${opts.sky?.night ? "n" : "d"}" src="${img}" alt="" width="1536" height="1024">` : ""}
      <svg viewBox="0 0 1536 1024" aria-hidden="true">
        <defs>
          <filter id="eoc-hglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
          <filter id="eoc-hsoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        ${legs}${batteryGlow(p, soc, opts.animations)}
      </svg>
      ${chip("solar", t("solar"), fmtPower(live.solar, lang), "", C.pv)}
      ${chip("house", t("house"), fmtPower(live.house, lang), "", p.houseColor)}
      ${chip("battery", soc === null ? t("battery") : `${t("battery")} · ${fmtNum(soc, lang, 0)} %`, fmtPower(batW, lang), batSub, C.bat)}
      ${chip("grid", exporting ? t("export") : t("grid"), fmtPower(exporting ? live.grid_export : live.grid_import, lang), "", exporting ? C.exp : C.imp)}
    </div>`,
  );
}

// ---------- energy bands ----------

export function renderSankey(live, opts) {
  const { t, lang } = opts;
  const p = flowParts(live, opts.threshold);
  const f = p.flows;
  const list = [
    ["solar", "house", f.solar_house, C.pv],
    ["solar", "battery", f.solar_battery, C.pv],
    ["solar", "export", f.solar_grid, C.pv],
    ["battery", "house", f.battery_house, C.bat],
    ["grid", "house", f.grid_house, C.imp],
    ["grid", "battery", f.grid_battery, C.gc],
  ].filter((x) => x[2] > 0);
  const W = 380;
  const H = 230;
  const top = 26;
  const x0 = 96;
  const x1 = 274;
  const nodeW = 10;
  const gap = 10;
  const total = list.reduce((a, x) => a + x[2], 0);
  const usable = H - top - 6 - gap * 2;
  const h = (w) => Math.max(3, (w / (total || 1)) * usable);
  const srcs = [
    ["solar", t("solar"), C.pv, p.solar],
    ["battery", t("battery"), C.bat, p.discharge],
    ["grid", t("grid"), C.imp, p.import],
  ];
  const gridCharge = f.grid_battery > f.solar_battery;
  const snks = [
    ["house", t("house"), C.house, p.house],
    ["battery", t("charging_label"), gridCharge ? C.gc : C.bat, p.charge],
    ["export", t("export"), C.exp, p.export],
  ];
  const lay = (nodes, side) => {
    let y = top;
    return nodes
      .map(([id, label, color, w]) => {
        const hh = list.filter((x) => x[side] === id).reduce((a, x) => a + h(x[2]), 0);
        const n = { id, label, color, w, y, h: hh };
        if (hh) y += hh + gap;
        return n;
      })
      .filter((n) => n.h);
  };
  const Ls = lay(srcs, 0);
  const Rs = lay(snks, 1);
  const oL = Object.fromEntries(Ls.map((n) => [n.id, n.y]));
  const oR = Object.fromEntries(Rs.map((n) => [n.id, n.y]));
  const order = ["house", "battery", "export"];
  const mx = (x0 + nodeW + x1) / 2;
  const bands = list
    .slice()
    .sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]))
    .map(([from, to, w, color]) => {
      const hh = h(w);
      const ya = oL[from];
      const yb = oR[to];
      oL[from] += hh;
      oR[to] += hh;
      const a = x0 + nodeW;
      return `<path class="band" d="M${a} ${ya} C${mx} ${ya} ${mx} ${yb} ${x1} ${yb} L${x1} ${yb + hh} C${mx} ${yb + hh} ${mx} ${ya + hh} ${a} ${ya + hh}Z" fill="${color}"/>`;
    })
    .join("");
  const rect = (x, n) => `<rect x="${x}" y="${n.y}" width="${nodeW}" height="${n.h}" rx="3" fill="${n.color}"/>`;
  const lab = (n, side) =>
    `<div class="nlab ${side}" style="${side === "l" ? `right:${(((W - x0 + 8) / W) * 100).toFixed(2)}%` : `left:${(((x1 + nodeW + 8) / W) * 100).toFixed(2)}%`};top:${(((n.y + n.h / 2) / H) * 100).toFixed(2)}%"><small>${esc(n.label)}</small><b>${esc(fmtPower(n.w, lang))}</b></div>`;
  const heads = `<div class="nhead" style="left:${(((x0 + nodeW / 2) / W) * 100).toFixed(2)}%">${esc(t("from"))}</div><div class="nhead" style="left:${(((x1 + nodeW / 2) / W) * 100).toFixed(2)}%">${esc(t("to"))}</div>`;
  const body = list.length
    ? `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${bands}${Ls.map((n) => rect(x0, n)).join("")}${Rs.map((n) => rect(x1, n)).join("")}</svg>${heads}${Ls.map((n) => lab(n, "l")).join("")}${Rs.map((n) => lab(n, "r")).join("")}`
    : `<div class="fs-idle">${esc(t("no_flow"))}</div>`;
  return tile(
    "fs-sankey",
    opts,
    `<div class="bands" role="img" aria-label="${esc(t("bands_aria", { house: fmtPower(live.house, lang) }))}">${body}</div>`,
  );
}

// ---------- ring ----------

export function renderRing(live, opts) {
  const { t, lang } = opts;
  const p = flowParts(live, opts.threshold);
  const soc = Number.isFinite(live.soc) ? Math.max(0, Math.min(100, live.soc)) : null;
  const cx = 190;
  const cy = 120;
  const r = 82;
  const sw = 14;
  const circ = 2 * Math.PI * r;
  const fed = p.toHouse.solar + p.toHouse.battery + p.toHouse.grid;
  let off = 0;
  const segs = [
    ["solar", C.pv],
    ["battery", C.bat],
    ["grid", C.imp],
  ]
    .map(([k, c]) => {
      const frac = fed ? p.toHouse[k] / fed : 0;
      if (frac <= 0) return "";
      const len = Math.max(0, frac * circ - 3);
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-off).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      off += frac * circ;
      return el;
    })
    .join("");
  const r2 = 66;
  const c2 = 2 * Math.PI * r2;
  const own = fed ? Math.round(((p.toHouse.solar + p.toHouse.battery) / fed) * 100) : null;
  const exporting = p.export > 0 && p.export >= p.import;
  const sat = (x, y, icon, color, title, val) =>
    `<div class="sat" style="left:${((x / 380) * 100).toFixed(2)}%;top:${((y / 250) * 100).toFixed(2)}%;--c:${color}">
      <div class="logo">${svgIcon(icon)}</div><small>${esc(title)}</small><b>${esc(val)}</b></div>`;
  const batW = p.charge || p.discharge;
  const share = (k, c) =>
    `<div class="tile"><div class="k">${esc(t(`from_${k}`))}</div><div class="v" style="color:color-mix(in srgb, ${c} 62%, var(--eoc-text))">${esc(fmtPower(p.toHouse[k], lang))}</div></div>`;
  return tile(
    "fs-ring",
    opts,
    `<div class="ringstage" role="img" aria-label="${esc(t("ring_aria", { house: fmtPower(live.house, lang), own: own ?? "–" }))}">
      <svg viewBox="0 0 380 250" aria-hidden="true">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--eoc-line)" stroke-width="${sw}"/>
        ${segs}
        ${
          soc === null
            ? ""
            : `<circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="var(--eoc-line)" stroke-width="4"/>
        <circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="${C.bat}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${((c2 * soc) / 100).toFixed(1)} ${c2.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`
        }
      </svg>
      <div class="ring-center">
        <small class="up">${esc(t("house"))}</small>
        <b>${esc(fmtPower(live.house, lang))}</b>
        ${own === null ? "" : `<small>${esc(t("own_share", { v: own }))}</small>`}
        ${soc === null ? "" : `<small>${esc(t("battery"))} ${fmtNum(soc, lang, 0)} %</small>`}
      </div>
      ${sat(56, 52, "solar", C.pv, t("solar"), fmtPower(live.solar, lang))}
      ${sat(56, 172, "battery", C.bat, t("battery"), batW ? `${p.charge ? "↓" : "↑"} ${fmtPower(batW, lang)}` : fmtPower(0, lang))}
      ${sat(324, 112, "tower", exporting ? C.exp : C.imp, exporting ? t("export") : t("grid"), `${exporting ? "↑" : p.import ? "↓" : ""} ${fmtPower(exporting ? live.grid_export : live.grid_import, lang)}`.trim())}
    </div>
    <div class="ring-foot">${share("solar", C.pv)}${share("battery", C.bat)}${share("grid", C.imp)}</div>`,
  );
}

export const STYLE_RENDERERS = { house: renderHouse, sankey: renderSankey, ring: renderRing };

// ---------- weather particles ----------

const FX = new WeakMap();
const CANVASES = new Set();
let running = false;
const rnd = (a, b) => a + Math.random() * (b - a);

function initFx(cv) {
  const r = cv.getBoundingClientRect();
  if (!r.width) return null;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  cv.width = r.width * dpr;
  cv.height = r.height * dpr;
  const k = cv.dataset.kind;
  const n = k === "rain" ? 70 : k === "snow" ? 45 : 30;
  const parts = Array.from({ length: n }, () => ({
    x: rnd(0, cv.width),
    y: rnd(0, cv.height),
    z: rnd(0.3, 1),
    p: rnd(0, 6.28),
    s: rnd(0.4, 1.2),
  }));
  const st = { parts, W: cv.width, H: cv.height, dpr, k };
  FX.set(cv, st);
  return st;
}

function draw(cv, t, reduce) {
  const st = FX.get(cv) || initFx(cv);
  if (!st) return;
  const g = cv.getContext("2d");
  const { W, H, dpr } = st;
  g.clearRect(0, 0, W, H);
  for (const q of st.parts) {
    if (st.k === "rain") {
      if (!reduce) {
        q.y += (14 + 10 * q.z) * dpr;
        q.x -= 3 * q.z * dpr;
        if (q.y > H) {
          q.y = rnd(-40, 0);
          q.x = rnd(0, W + 60);
        }
      }
      const len = (10 + 16 * q.z) * dpr;
      const gr = g.createLinearGradient(q.x, q.y, q.x + len * 0.2, q.y - len);
      gr.addColorStop(0, `rgba(220,230,245,${0.12 + 0.3 * q.z})`);
      gr.addColorStop(1, "rgba(220,230,245,0)");
      g.strokeStyle = gr;
      g.lineWidth = (0.6 + q.z) * dpr;
      g.beginPath();
      g.moveTo(q.x, q.y);
      g.lineTo(q.x + len * 0.2, q.y - len);
      g.stroke();
    } else if (st.k === "snow") {
      if (!reduce) {
        q.y += (0.5 + 1.3 * q.z) * dpr;
        q.x += Math.sin(t / 1400 + q.p) * 0.5 * dpr;
        if (q.y > H + 5) {
          q.y = -5;
          q.x = rnd(0, W);
        }
      }
      const rad = (1 + 2.4 * q.z) * dpr;
      const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, rad);
      gr.addColorStop(0, `rgba(255,255,255,${0.5 + 0.4 * q.z})`);
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(q.x, q.y, rad, 0, 6.28);
      g.fill();
    } else {
      const y = q.y * 0.55;
      const a = reduce ? 0.6 : 0.2 + 0.8 * Math.max(0, Math.sin(t / (900 + 900 * q.s) + q.p)) ** 3;
      g.fillStyle = `rgba(255,255,255,${a})`;
      g.beginPath();
      g.arc(q.x, y, (0.5 + q.z) * dpr, 0, 6.28);
      g.fill();
    }
  }
}

function loop(t) {
  const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  for (const cv of CANVASES) {
    if (!cv.isConnected) CANVASES.delete(cv);
    else draw(cv, t, reduce);
  }
  if (CANVASES.size) requestAnimationFrame(loop);
  else running = false;
}

/** Starts the particle animation for the canvases under `root` (rain, snow, stars). */
export function animateSky(root) {
  for (const cv of root.querySelectorAll("canvas.sky-fx")) CANVASES.add(cv);
  if (CANVASES.size && !running) {
    running = true;
    requestAnimationFrame(loop);
  }
}
