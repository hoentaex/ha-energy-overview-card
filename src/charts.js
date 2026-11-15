// Charts as SVG / HTML strings: power chart (day), history columns (stacked or diverging), rings.
import { esc, fmtNum, fmtPower } from "./shared.js";

const moon =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

// ---------- power chart ----------

export const POWER_SERIES = [
  { key: "grid_import", label: "grid_import", color: "var(--eoc-imp)", fill: 0.2 },
  { key: "grid_export", label: "grid_export", color: "var(--eoc-exp)", fill: 0.22 },
  { key: "pv", label: "pv", color: "var(--eoc-pv)", fill: 0.22 },
  { key: "house", label: "consumption", color: "var(--eoc-house)", fill: 0.16 },
  { key: "soc", label: "soc_pct", color: "var(--eoc-bat)", fill: 0.1, pct: true },
];
const DRAW_ORDER = ["soc", "pv", "house", "grid_import", "grid_export"];
const PW = 300;
const PH = 140;

/** Index of the last cell with any value (the "now" of today, the end of past days). */
export const lastIndex = (series, n) => {
  for (let i = n - 1; i >= 0; i--) if (Object.values(series).some((s) => Number.isFinite(s?.[i]))) return i;
  return -1;
};

const pathOf = (vals, x, y) => {
  let line = "";
  let area = "";
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const l = run.map(([i, v], k) => `${k ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
    line += `${l} `;
    area += `${l} L${x(run.at(-1)[0])} ${PH - 2} L${x(run[0][0])} ${PH - 2} Z `;
    run = [];
  };
  vals.forEach((v, i) => {
    if (Number.isFinite(v)) run.push([i, v]);
    else flush();
  });
  flush();
  return { line: line.trim(), area: area.trim() };
};

/** Power chart: data = { n, series: { grid_import, grid_export, pv, house, soc } (W / %) }, hidden = Set of keys. */
export function renderPowerChart(data, { t, lang, hidden, ariaRange }) {
  const { n, series } = data;
  let max = 0;
  for (const s of POWER_SERIES)
    if (!s.pct) for (const v of series[s.key] || []) if (Number.isFinite(v)) max = Math.max(max, v / 1000);
  const pmax = Math.max(0.2, Math.ceil(max / 0.2) * 0.2);
  const x = (i) => ((i / Math.max(1, n - 1)) * PW).toFixed(1);
  const y = (kw) => (PH - 2 - (kw / pmax) * (PH - 4)).toFixed(1);
  const ys = (pct) => (PH - 2 - (Math.max(0, Math.min(100, pct)) / 100) * (PH - 4)).toFixed(1);
  const paths = DRAW_ORDER.map((key) => {
    const s = POWER_SERIES.find((p) => p.key === key);
    const vals = series[key];
    if (!vals || hidden.has(key)) return "";
    const p = pathOf(s.pct ? vals : vals.map((v) => (Number.isFinite(v) ? v / 1000 : v)), x, s.pct ? ys : y);
    if (!p.line) return "";
    const dash = s.pct ? ' stroke-dasharray="4 3"' : "";
    return `<path d="${p.area}" fill="${s.color}" fill-opacity="${s.fill}" stroke="none"/>
      <path d="${p.line}" fill="none" stroke="${s.color}" stroke-width="${s.pct ? 1.1 : 1.2}"${dash} vector-effect="non-scaling-stroke"/>`;
  }).join("");
  const label = fmtNum(pmax, lang, 1);
  return {
    pmax,
    html: `
    <div class="pchart">
      <div class="yaxis l"><span>${label}</span><span>${fmtNum(pmax / 2, lang, 1)}</span><span>0</span></div>
      <div class="plot" data-plot>
        <svg viewBox="0 0 ${PW} ${PH}" preserveAspectRatio="none" role="img" aria-label="${esc(t("power_aria", { range: ariaRange, max: label }))}">
          <line x1="0" y1="2" x2="${PW}" y2="2" stroke="var(--eoc-line)" stroke-dasharray="2 4" vector-effect="non-scaling-stroke"/>
          <line x1="0" y1="${PH / 2}" x2="${PW}" y2="${PH / 2}" stroke="var(--eoc-line)" stroke-dasharray="2 4" vector-effect="non-scaling-stroke"/>
          <line x1="0" y1="${PH - 2}" x2="${PW}" y2="${PH - 2}" stroke="var(--eoc-line)" vector-effect="non-scaling-stroke"/>
          ${paths}
          <line data-cross x1="0" y1="0" x2="0" y2="${PH}" stroke="var(--eoc-text)" stroke-width="1" opacity="0" vector-effect="non-scaling-stroke"/>
        </svg>
      </div>
      <div class="yaxis"><span>100</span><span>50</span><span>0 %</span></div>
    </div>`,
    crossX: (i) => x(i),
  };
}

/** Two value lines under the time: "consumption · PV · battery %" and "grid import · export". */
export function powerReadout(series, i, { t, lang }) {
  const w = (key) => fmtPower(series[key]?.[i], lang);
  const soc = series.soc?.[i];
  return [
    `${t("consumption")} ${w("house")} · ${t("pv")} ${w("pv")} · ${t("battery")} ${Number.isFinite(soc) ? `${fmtNum(soc, lang, 0)} %` : "–"}`,
    `${t("grid_import")} ${w("grid_import")} · ${t("grid_export")} ${w("grid_export")}`,
  ];
}

// ---------- history ----------

const stacksOf = (u, mode) => {
  if (mode === "consumption")
    return [
      [u.house_from_solar, "var(--eoc-pv)"],
      [u.house_from_battery, "var(--eoc-bat)"],
      [u.house_from_grid, "var(--eoc-imp)"],
    ];
  return [
    [u.pv_to_house, "var(--eoc-pv)"],
    [u.pv_to_battery, "var(--eoc-bat)"],
    [u.pv_to_grid, "var(--eoc-exp)"],
  ];
};
const sum = (segs) => segs.reduce((a, [v]) => a + (v || 0), 0);

/**
 * History columns. units: [{ title, future, split (or null), fc (kWh, optional), soc (%, optional) }].
 * opts: { t, lang, mode, sel, night: [{ left, width }] in %, forecast: bool, soc: bool }.
 */
export function renderHistory(units, opts) {
  const { lang, mode, sel } = opts;
  const n = units.length;
  const showLabel = n <= 7;
  const LB = showLabel ? 14 : 0;
  const de = (v) => fmtNum(v, lang, 1);
  let cols;
  let overlay = "";
  if (mode === "battery") {
    let mUp = 0.0001;
    let mDown = 0.0001;
    for (const u of units) {
      if (!u.split) continue;
      mUp = Math.max(mUp, u.split.battery_charge);
      mDown = Math.max(mDown, u.split.battery_discharge);
    }
    const avail = 124 - 2 * LB;
    const upH = Math.round(avail * Math.min(0.75, Math.max(0.35, mUp / (mUp + mDown))));
    const downH = avail - upH;
    cols = units.map((u, i) => {
      const s = u.split;
      const up = s
        ? `<div class="stack">${[
            [s.pv_to_battery, "var(--eoc-pv)"],
            [s.grid_to_battery, "var(--eoc-gridcharge)"],
          ]
            .map(([v, c]) => `<div style="height:${((v / mUp) * upH).toFixed(1)}px;--c:${c}"></div>`)
            .join("")}</div>`
        : "";
      const down = s
        ? `<div class="stack down"><div style="height:${((s.battery_discharge / mDown) * downH).toFixed(1)}px;--c:var(--eoc-bat)"></div></div>`
        : "";
      return column(
        u,
        i,
        sel,
        `
        <div class="updown">
          ${showLabel ? `<div class="v">${s ? de(s.battery_charge) : ""}</div>` : ""}
          <div class="u" style="height:${upH}px">${up}</div>
          <div class="d" style="height:${downH}px">${down}</div>
          ${showLabel ? `<div class="v">${s ? `−${de(s.battery_discharge)}` : ""}</div>` : ""}
        </div>`,
      );
    });
    overlay += `<div class="zero" style="top:${LB + upH}px"></div>`;
    if (opts.soc && units.some((u) => Number.isFinite(u.soc))) {
      const pts = units
        .map((u, i) => (Number.isFinite(u.soc) ? [i * 10 + 5, 100 - Math.max(0, Math.min(100, u.soc))] : null))
        .filter(Boolean);
      const line = pts.map(([px, py], k) => `${k ? "L" : "M"}${px} ${py.toFixed(1)}`).join(" ");
      const area = `${line} L${pts.at(-1)[0]} 100 L${pts[0][0]} 100 Z`;
      overlay += `<svg class="overlay" style="top:0;height:${LB + upH}px" viewBox="0 0 ${n * 10} 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="eocSoc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--eoc-house)" stop-opacity="0.3"/><stop offset="1" stop-color="var(--eoc-house)" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#eocSoc)"/>
        <path d="${line}" fill="none" stroke="var(--eoc-house)" stroke-width="2" stroke-dasharray="4 3" vector-effect="non-scaling-stroke"/>
      </svg>`;
    }
  } else {
    const CH = 124 - LB - 2;
    let max = 0.0001;
    for (const u of units) {
      if (u.split) max = Math.max(max, sum(stacksOf(u.split, mode)));
      if (opts.forecast && Number.isFinite(u.fc)) max = Math.max(max, u.fc);
    }
    cols = units.map((u, i) => {
      const segs = u.split ? stacksOf(u.split, mode) : [];
      return column(
        u,
        i,
        sel,
        `
        ${showLabel ? `<div class="v">${u.split ? de(sum(segs)) : ""}</div>` : ""}
        <div class="stack">${segs.map(([v, c]) => `<div style="height:${(((v || 0) / max) * CH).toFixed(1)}px;--c:${c}"></div>`).join("")}</div>`,
      );
    });
    if (opts.forecast) {
      const pts = units.map((u, i) => [i * 10 + 5, CH - ((u.fc || 0) / max) * CH]);
      const line = pts.map(([px, py], k) => `${k ? "L" : "M"}${px} ${py.toFixed(1)}`).join(" ");
      overlay += `<svg class="overlay" style="bottom:0;height:${CH}px" viewBox="0 0 ${n * 10} ${CH}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="eocFc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--eoc-fc)" stop-opacity="0.38"/><stop offset="1" stop-color="var(--eoc-fc)" stop-opacity="0"/></linearGradient></defs>
        <path d="${line} L${pts.at(-1)[0]} ${CH} L${pts[0][0]} ${CH} Z" fill="url(#eocFc)"/>
        <path d="${line}" fill="none" stroke="var(--eoc-fc)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>`;
    }
  }
  const night = (opts.night || [])
    .map(
      (b) =>
        `<div class="night" style="left:${b.left.toFixed(2)}%;width:${b.width.toFixed(2)}%" aria-hidden="true">${moon}</div>`,
    )
    .join("");
  return `<div class="hchart">${night}<div class="cols" style="--gap:${n > 24 ? 2 : 3}px">${cols.join("")}</div>${overlay}</div>`;
}

const column = (u, i, sel, inner) =>
  `<button type="button" class="col${u.future ? " future" : ""}${i === sel ? " sel" : ""}" data-col="${i}" aria-label="${esc(u.aria || u.title)}"${u.future ? ' aria-disabled="true"' : ""}>${u.future ? "" : inner}</button>`;

// ---------- rings ----------

export function ring(frac, color, inner, label) {
  const C = 2 * Math.PI * 22;
  const f = Number.isFinite(frac) ? Math.max(0, Math.min(1, frac)) : 0;
  return `<div class="ring">
    <div class="r">
      <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
        <circle cx="27" cy="27" r="22" fill="none" stroke="var(--eoc-line)" stroke-width="5"/>
        ${f > 0 ? `<circle cx="27" cy="27" r="22" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 27 27)"/>` : ""}
      </svg>
      <span>${esc(inner)}</span>
    </div>
    <div class="l">${esc(label)}</div>
  </div>`;
}
