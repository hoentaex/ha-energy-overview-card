// Section renderers of the main card. Each takes the render context built by the card and returns HTML.
import { POWER_SERIES, powerReadout, renderHistory, renderPowerChart, ring } from "./charts.js";
import { renderFlow } from "./flow.js";
import { periodLabel } from "./period.js";
import { esc, fmtDay, fmtEnergy, fmtNum, fmtTime, fmtWeekday } from "./shared.js";
import { nightBlocks } from "./sun.js";
import { svgIcon } from "./icons.js";

const STATUS_COLOR = {
  grid_house: "var(--eoc-imp)",
  pv_charging: "var(--eoc-pv)",
  pv_house: "var(--eoc-pv)",
  battery_house: "var(--eoc-bat)",
  export: "var(--eoc-exp)",
};

const chevron = (d) =>
  `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

export const statusPill = (ctx) =>
  ctx.status
    ? `<span class="pill" style="--c:${STATUS_COLOR[ctx.status]}"><span class="dot"></span><span>${esc(ctx.t(`status_${ctx.status}`))}</span></span>`
    : "";

export function header(ctx) {
  const { config, t } = ctx;
  const logo = config.icon ? `<ha-icon icon="${esc(config.icon)}"></ha-icon>` : svgIcon("flash");
  return `<div class="header">
    <div class="logo" style="--c:${STATUS_COLOR[ctx.status] || "var(--eoc-pv)"}">${logo}</div>
    <div class="titles">
      <div class="name">${esc(config.name || t("title"))}</div>
      ${config.subtitle ? `<div class="sub">${esc(config.subtitle)}</div>` : ""}
    </div>
    ${statusPill(ctx)}
    ${config._dialog ? `<button type="button" class="zoom" data-close aria-label="${esc(t("close"))}">${svgIcon("close")}</button>` : ""}
  </div>`;
}

export function flow(ctx) {
  const { now, lang, tz } = ctx;
  return renderFlow(ctx.live, {
    t: ctx.t,
    lang,
    threshold: Number(ctx.config.threshold_w) || 0,
    animations: ctx.config.animations !== false,
    byPower: ctx.config.animate_by_power !== false,
    time: `${fmtWeekday(now, lang, tz)} ${fmtTime(now, lang, tz)}`,
    forecastToday: ctx.forecastToday,
  });
}

export function period(ctx) {
  const { t, kind, range, lang, isCurrentPeriod } = ctx;
  const label = kind === "day" && isCurrentPeriod ? t("today") : periodLabel(range, lang);
  return `<div class="period">
    <div class="seg" role="group" aria-label="${esc(t("period"))}">
      ${["day", "week", "month"]
        .map(
          (k) =>
            `<button type="button" data-act="period" data-v="${k}" aria-pressed="${k === kind}">${esc(t(`period_${k}`))}</button>`,
        )
        .join("")}
    </div>
    <div class="nav">
      <button type="button" class="arrow" data-act="prev" aria-label="${esc(t("prev"))}">${chevron("M15 6l-6 6 6 6")}</button>
      <div class="date" aria-live="polite">${esc(label)}</div>
      <button type="button" class="arrow" data-act="next" aria-label="${esc(t("next"))}"${ctx.canForward ? "" : " disabled"}>${chevron("M9 6l6 6-6 6")}</button>
      <button type="button" class="now" data-act="now"${isCurrentPeriod ? " disabled" : ""}>${esc(t("now"))}</button>
    </div>
  </div>`;
}

// ---------- power ----------

export function powerTitle(ctx, i) {
  const { power, lang, tz, t } = ctx;
  if (i < 0) return "–";
  const time = fmtTime(new Date(power.cells[i]), lang, tz);
  return i === power.last && ctx.isCurrentPeriod && !ctx.scrubbing ? `${time} · ${t("latest")}` : time;
}

export function power(ctx) {
  const { t, lang, power: p, state } = ctx;
  if (ctx.kind !== "day" || !p || !Object.keys(p.series).length) return "";
  const n = p.cells.length;
  const chart = renderPowerChart(
    { n, series: p.series },
    { t, lang, hidden: state.hidden, ariaRange: ctx.isCurrentPeriod ? t("today") : periodLabel(ctx.range, lang) },
  );
  const i = p.last;
  const [l1, l2] = i >= 0 ? powerReadout(p.series, i, { t, lang }) : ["–", "–"];
  const chips = POWER_SERIES.filter((s) => p.series[s.key])
    .map(
      (s) =>
        `<button type="button" class="chip" data-act="chip" data-v="${s.key}" aria-pressed="${!state.hidden.has(s.key)}" style="--c:${s.color}">${esc(t(s.label))}</button>`,
    )
    .join("");
  return `<div class="tile">
    <div class="tile-head"><div class="tile-title">${svgIcon("chart")}<span>${esc(t("power_title"))}</span></div><div class="muted small">${esc(ctx.isCurrentPeriod ? t("today") : periodLabel(ctx.range, lang))} · kW</div></div>
    <div class="readout three" aria-live="polite" data-pro>
      <div class="r-title">${esc(powerTitle(ctx, i))}</div><div class="r-line">${esc(l1)}</div><div class="r-line">${esc(l2)}</div>
    </div>
    ${chart.html}
    <div class="xaxis p"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
    <div class="chips" role="group" aria-label="${esc(t("toggle_lines"))}">${chips}</div>
  </div>`;
}

// ---------- balance ----------

const segBar = (segs, total, width = 100) =>
  `<div class="bar"><div class="fill" style="width:${width.toFixed(1)}%">${segs
    .map(([v, c]) => `<div style="width:${total > 0 ? ((v / total) * 100).toFixed(1) : 0}%;--c:${c}"></div>`)
    .join("")}</div></div>`;
const legend = (segs, lang) =>
  `<div class="legend">${segs.map(([v, c, l]) => `<span style="--c:${c}">${esc(l)} ${fmtNum(v, lang, 2)}</span>`).join("")}</div>`;

export function balance(ctx) {
  const { t, lang, energy } = ctx;
  const head = `<div class="tile-head"><div class="tile-title">${svgIcon("pie")}<span>${esc(t("balance"))}</span></div><div class="muted small">${esc(periodLabel(ctx.range, lang))}</div></div>`;
  if (!energy) return `<div class="tile">${head}<div class="empty">${esc(t("loading"))}</div></div>`;
  if (!energy.hasData) return `<div class="tile">${head}<div class="empty">${esc(t("no_stats"))}</div></div>`;
  const s = energy.total;
  const cons = [
    [s.house_from_solar || 0, "var(--eoc-pv)", t("solar")],
    [s.house_from_battery || 0, "var(--eoc-bat)", t("battery")],
    [s.house_from_grid || 0, "var(--eoc-imp)", t("grid")],
  ];
  const prod = [
    [s.pv_to_house || 0, "var(--eoc-pv)", t("to_house")],
    [s.pv_to_battery || 0, "var(--eoc-bat)", t("battery")],
    [s.pv_to_grid || 0, "var(--eoc-exp)", t("grid_export")],
  ];
  const ref = Math.max(s.consumption || 0, s.solar || 0);
  const pct = (v) => (v === null ? "–" : `${Math.round(v * 100)} %`);
  return `<div class="tile">${head}
    <div class="bal">
      <div class="bal-head"><span class="muted">${esc(t("consumption"))}</span><b>${fmtEnergy(s.consumption, lang)}</b></div>
      ${segBar(cons, s.consumption, 100)}
      ${legend(cons, lang)}
    </div>
    <div class="bal">
      <div class="bal-head"><span class="muted">${esc(t("production"))}</span><b>${fmtEnergy(s.solar, lang)}</b></div>
      ${segBar(prod, s.solar, ref > 0 ? ((s.solar || 0) / ref) * 100 : 0)}
      ${legend(prod, lang)}
    </div>
    <div class="rings">
      ${ring(s.autarky, "var(--eoc-bat)", pct(s.autarky), t("autarky"))}
      ${ring(s.self_consumption, "var(--eoc-pv)", pct(s.self_consumption), t("self_consumption"))}
      ${ring(s.self_consumption, "var(--eoc-exp)", fmtNum(s.co2_kg, lang, 1), t("co2"))}
    </div>
  </div>`;
}

// ---------- history ----------

/** Columns of the history chart from the period's slots. */
export function historyUnits(ctx) {
  const { range, energy, lang, tz, kind, now } = ctx;
  return range.slots.map((slot, i) => {
    const future = slot.start > now;
    const title =
      kind === "day"
        ? `${fmtTime(slot.start, lang, tz)} – ${fmtTime(slot.end, lang, tz)}`
        : fmtDay(slot.start, lang, tz);
    return {
      title,
      future,
      split: future ? null : (energy?.split[i] ?? null),
      fc: ctx.forecast?.[i],
      soc: ctx.hourSoc?.[i],
      aria: future ? `${title}: ${ctx.t("no_data")}` : title,
    };
  });
}

export const defaultSel = (ctx, units) => {
  const cur = units.findIndex((_u, i) => ctx.range.slots[i].start <= ctx.now && ctx.now < ctx.range.slots[i].end);
  if (cur >= 0) return cur;
  for (let i = units.length - 1; i >= 0; i--) if (!units[i].future) return i;
  return 0;
};

export function historyReadout(ctx, u) {
  const { t, lang, state } = ctx;
  const k = (v) => fmtNum(v || 0, lang, 2);
  if (!u) return ["–", ""];
  if (u.future || !u.split) return [u.title, t("no_data")];
  const s = u.split;
  if (state.mode === "consumption")
    return [
      t("ro_consumption", { title: u.title, v: k(s.consumption) }),
      t("ro_consumption_2", { a: k(s.house_from_solar), b: k(s.house_from_battery), c: k(s.house_from_grid) }),
    ];
  if (state.mode === "solar")
    return [
      t("ro_solar", { title: u.title, v: k(s.solar) }) +
        (ctx.showForecast && Number.isFinite(u.fc) ? t("ro_forecast", { v: k(u.fc) }) : ""),
      t("ro_solar_2", { a: k(s.pv_to_house), b: k(s.pv_to_battery), c: k(s.pv_to_grid) }),
    ];
  return [
    t("ro_battery", { title: u.title }) + (Number.isFinite(u.soc) ? t("ro_soc", { v: fmtNum(u.soc, lang, 0) }) : ""),
    t("ro_battery_2", {
      a: k(s.battery_charge),
      b: k(s.pv_to_battery),
      c: k(s.grid_to_battery),
      d: k(s.battery_discharge),
    }),
  ];
}

const AXIS = {
  day: () => ["0", "6", "12", "18", "24"],
  week: (ctx) => ctx.range.slots.map((s) => fmtWeekday(s.start, ctx.lang, ctx.tz)),
  month: (ctx) => {
    const n = ctx.range.slots.length;
    return ["1.", "8.", "15.", "22.", `${n}.`];
  },
};

export function history(ctx) {
  const { t, lang, state, kind } = ctx;
  const title = t(`hist_${kind}`);
  const modes = ["consumption", "solar", "battery"]
    .map(
      (m) =>
        `<button type="button" data-act="mode" data-v="${m}" aria-pressed="${m === state.mode}">${esc(t(`mode_${m}`))}</button>`,
    )
    .join("");
  const head = `<div class="tile-head" style="align-items:center"><div class="tile-title">${svgIcon("bars")}<span>${esc(title)}</span></div><div class="modes" role="group" aria-label="${esc(t("view"))}">${modes}</div></div>`;
  if (!ctx.energy) return `<div class="tile">${head}<div class="empty">${esc(t("loading"))}</div></div>`;
  if (!ctx.energy.hasData) return `<div class="tile">${head}<div class="empty">${esc(t("no_stats"))}</div></div>`;
  const units = ctx.units;
  const sel = ctx.sel;
  const [r1, r2] = historyReadout(ctx, units[sel]);
  const span = ctx.range.end - ctx.range.start;
  const night =
    kind === "day" && state.mode === "consumption"
      ? nightBlocks(ctx.range, ctx.sun).map((b) => ({
          left: ((b.start - ctx.range.start) / span) * 100,
          width: ((b.end - b.start) / span) * 100,
        }))
      : [];
  const legends = {
    consumption: [
      ["from_solar", "var(--eoc-pv)"],
      ["from_battery", "var(--eoc-bat)"],
      ["from_grid", "var(--eoc-imp)"],
    ],
    solar: [
      ["into_house", "var(--eoc-pv)"],
      ["into_battery", "var(--eoc-bat)"],
      ["grid_export", "var(--eoc-exp)"],
    ],
    battery: [
      ["charged_pv", "var(--eoc-pv)"],
      ["charged_grid", "var(--eoc-imp)"],
      ["discharged", "var(--eoc-bat)"],
    ],
  }[state.mode].slice();
  const showSoc = kind === "day" && state.mode === "battery" && units.some((u) => Number.isFinite(u.soc));
  if (ctx.showForecast) legends.push(["forecast", "var(--eoc-fc)"]);
  if (showSoc) legends.push(["soc_line", "var(--eoc-house)"]);
  const chart = renderHistory(units, {
    t,
    lang,
    mode: state.mode,
    sel,
    night,
    forecast: ctx.showForecast,
    soc: showSoc,
  });
  return `<div class="tile">${head}
    <div class="readout two" aria-live="polite" data-hro><div class="r-title">${esc(r1)}</div><div class="r-line">${esc(r2)}</div></div>
    ${chart}
    <div class="xaxis">${AXIS[kind](ctx)
      .map((x) => `<span>${esc(x)}</span>`)
      .join("")}</div>
    <div class="legend lines">${legends.map(([k, c]) => `<span style="--c:${c}">${esc(t(k))}</span>`).join("")}</div>
  </div>`;
}

// ---------- footer ----------

export function footer(ctx) {
  const { t, lang, energy } = ctx;
  if (!energy?.hasData) return "";
  const s = energy.total;
  const imp =
    Number.isFinite(s.grid_import) && s.grid_import > 0
      ? s.grid_import
      : (s.house_from_grid || 0) + (s.grid_to_battery || 0);
  const tile = (k, v) =>
    `<div class="tile"><div class="k">${esc(k)}</div><div class="v">${fmtNum(v, lang, 2)} <span>kWh</span></div></div>`;
  let fc = "";
  if (ctx.kind === "day" && ctx.isCurrentPeriod && Number.isFinite(ctx.forecastToday) && ctx.forecastToday > 0) {
    const ratio = (s.solar || 0) / ctx.forecastToday;
    fc = `<div class="fc"><span>${esc(t("pv_vs_forecast"))}</span>
      <div class="bar"><div style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></div></div>
      <b>${fmtNum(s.solar, lang, 2)} / ${fmtEnergy(ctx.forecastToday, lang)} · ${Math.round(ratio * 100)} %</b></div>`;
  }
  return `<div class="foot">
    ${tile(t("grid_import"), imp)}
    ${tile(t("grid_export"), s.grid_export)}
    ${tile(t("battery_charged"), s.battery_charge)}
  </div>${fc}`;
}

export const RENDERERS = { header, flow, period, power, balance, history, footer };
