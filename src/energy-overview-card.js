/*
 * Energy Overview Card for Home Assistant
 * https://github.com/hoentaex/ha-energy-overview-card
 *
 * Live energy flow, balance and history (day / week / month) of a PV system with a home battery
 * in one card. No control logic, no tariffs.
 *
 * Layout and look follow the cards of juju35 (https://github.com/juju35). MIT licence.
 */
import { powerReadout } from "./charts.js";
import {
  Cache,
  fetchForecast,
  fetchPeriodEnergy,
  fetchPowerDay,
  fetchPrefs,
  powerEntities,
  powerSeries,
} from "./data.js";
import { deriveStatus, forecastEntries, prefsLive, readLive } from "./energy.js";
import { canGoForward, isCurrent, periodRange, shiftAnchor } from "./period.js";
import { defaultSel, historyReadout, historyUnits, powerTitle, RENDERERS } from "./sections.js";
import { DEFAULTS, esc, HISTORY_MODES, langOf, SECTIONS, translator } from "./shared.js";
import { STYLE } from "./styles.js";
import { daySun } from "./sun.js";
import { tzOf } from "./tz.js";

const VERSION = __VERSION__;
const TICK = 60e3;

// Config keys holding entity ids: their states decide when the live part re-renders.
const liveKeys = (config, live) =>
  [
    ...Object.entries({ ...live, ...config })
      .filter(([k, v]) => typeof v === "string" && /_entity$/.test(k))
      .map(([, v]) => v),
  ].sort();

export class EnergyOverviewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._cache = new Cache();
    this._state = { kind: "day", anchor: null, mode: "consumption", sel: null, hidden: new Set() };
    this._data = {};
    this._token = 0;
    this._bound = false;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    const sections = Array.isArray(config.sections) ? config.sections.filter((s) => SECTIONS.includes(s)) : SECTIONS;
    this._config = { ...DEFAULTS, ...config, sections };
    if (HISTORY_MODES.includes(config.history_view)) this._state.mode = config.history_view;
    this._cache.clear();
    this._data = {};
    this._liveSig = "";
    if (this._hass) this._start();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._tz = tzOf(hass);
    if (first) this._start();
    else this._maybeRenderLive();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    clearInterval(this._timer);
    this._timer = setInterval(() => this._tick(), TICK);
    if (this._hass && this._config && !this._started) this._start();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
  }

  getCardSize() {
    return 18;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  // ---------- data ----------

  async _start() {
    if (!this._config || !this._hass) return;
    this._started = true;
    this._render();
    this._prefs = await fetchPrefs(this._hass, this._cache);
    this._live = prefsLive(this._prefs);
    this._liveSig = "";
    this._load();
  }

  _range() {
    const s = this._state;
    return periodRange(s.kind, s.anchor || new Date(), { weekMode: this._config.week_mode, tz: this._tz });
  }

  async _load() {
    const token = ++this._token;
    const hass = this._hass;
    const config = this._config;
    const range = this._range();
    const now = Date.now();
    const current = isCurrent(range, new Date(now));
    try {
      const [energy, power, forecast] = await Promise.all([
        fetchPeriodEnergy(hass, this._cache, config, this._prefs, range, now).catch(() => null),
        range.kind === "day" ? this._loadPower(range, now) : null,
        range.kind === "day" && current
          ? fetchForecast(hass, this._cache, range, forecastEntries(this._prefs), now)
          : null,
      ]);
      if (token !== this._token) return;
      const sig = JSON.stringify([range.start, energy?.series, power?.series, forecast]);
      const changed = sig !== this._data.sig;
      this._data = { sig, range, energy: energy || { hasData: false, split: [], total: {} }, power, forecast };
      if (changed) this._render();
    } catch (err) {
      console.warn("energy-overview-card:", err);
    }
  }

  async _loadPower(range, now) {
    const { ids, map } = powerEntities(this._config, this._live);
    if (!ids.length) return null;
    const step = Number(this._config.power_resolution) === 5 ? 5 : 15;
    const raw = await fetchPowerDay(this._hass, this._cache, ids, range, step, now).catch(() => null);
    if (!raw) return null;
    const series = powerSeries(raw, map, this._config, this._live);
    let last = -1;
    for (let i = raw.cells.length - 1; i >= 0 && last < 0; i--)
      if (Object.values(series).some((s) => Number.isFinite(s[i]))) last = i;
    return { cells: raw.cells, step, series, last };
  }

  _tick() {
    if (!this._hass || !this._config) return;
    if (isCurrent(this._range())) this._load();
    this._renderLive();
  }

  // ---------- render ----------

  _context() {
    const hass = this._hass;
    const config = this._config;
    const lang = langOf(hass);
    const t = translator(lang);
    const tz = this._tz;
    const now = new Date();
    const range = this._data.range && this._data.range.kind === this._state.kind ? this._data.range : this._range();
    const fresh = this._data.range && this._data.range.start.getTime() === this._range().start.getTime();
    const live = readLive(hass, config, this._live);
    const current = isCurrent(range, now);
    const forecast = fresh && current && range.kind === "day" ? this._data.forecast : null;
    const fcEntity = Number.parseFloat(hass?.states?.[config.forecast_today_entity]?.state);
    const fcSum =
      this._data.forecast && this._data.range?.kind === "day" ? this._data.forecast.reduce((a, b) => a + b, 0) : null;
    const power = fresh ? this._data.power : null;
    const ctx = {
      hass,
      config,
      lang,
      t,
      tz,
      now,
      live,
      status: Object.values(live).some((v) => v !== null) ? deriveStatus(live, Number(config.threshold_w) || 0) : null,
      kind: this._state.kind,
      range,
      isCurrentPeriod: current,
      canForward: canGoForward(this._state.kind, this._state.anchor || now, { weekMode: config.week_mode, tz, now }),
      energy: fresh ? this._data.energy : null,
      power,
      forecast,
      forecastToday: Number.isFinite(fcEntity) ? fcEntity : Number.isFinite(fcSum) && fcSum > 0 ? fcSum : null,
      showForecast: !!forecast && this._state.mode === "solar",
      sun: range.kind === "day" ? daySun(hass, range) : null,
      state: this._state,
    };
    if (power?.series.soc && range.kind === "day") {
      ctx.hourSoc = range.slots.map((slot) => {
        const vals = power.cells
          .map((c, i) => (c >= slot.start.getTime() && c < slot.end.getTime() ? power.series.soc[i] : null))
          .filter(Number.isFinite);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      });
    }
    ctx.units = historyUnits(ctx);
    ctx.sel = this._state.sel ?? defaultSel(ctx, ctx.units);
    return ctx;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const ctx = (this._ctx = this._context());
    const body = this._config.sections
      .map((s) => `<div class="sec" data-sec="${s}">${RENDERERS[s](ctx)}</div>`)
      .join("");
    this.shadowRoot.innerHTML = `<style>${STYLE}.sec{display:contents}</style><ha-card>${body}</ha-card>`;
    this._liveSig = this._liveSignature();
    this._bind();
  }

  _liveSignature() {
    const ids = liveKeys(this._config, this._live);
    return ids.map((id) => this._hass?.states?.[id]?.state).join("|") + (this._hass?.states?.["sun.sun"]?.state || "");
  }

  _maybeRenderLive() {
    if (!this._started || !this.shadowRoot.firstChild) return;
    if (this._liveSignature() !== this._liveSig) this._renderLive();
  }

  /** Re-renders only header and flow (live values), keeping the period sections and their state. */
  _renderLive() {
    if (!this.shadowRoot.firstChild || !this._config) return;
    const ctx = this._context();
    for (const s of ["header", "flow"]) {
      const el = this.shadowRoot.querySelector(`[data-sec="${s}"]`);
      if (el) el.innerHTML = RENDERERS[s](ctx);
    }
    this._liveSig = this._liveSignature();
  }

  // ---------- interaction ----------

  _bind() {
    if (this._bound) return;
    this._bound = true;
    const root = this.shadowRoot;
    root.addEventListener("click", (e) => this._onClick(e));
    root.addEventListener("pointerover", (e) => this._pickCol(e));
    root.addEventListener("focusin", (e) => this._pickCol(e));
    root.addEventListener("pointermove", (e) => this._scrub(e));
    root.addEventListener("pointerdown", (e) => this._scrub(e));
    root.addEventListener("pointerout", (e) => {
      const plot = e.target.closest?.("[data-plot]");
      if (plot && !plot.contains(e.relatedTarget)) this._scrubEnd();
    });
  }

  _onClick(e) {
    const col = e.target.closest?.("[data-col]");
    if (col) return this._pickCol(e);
    const btn = e.target.closest?.("[data-act]");
    if (!btn || btn.disabled) return;
    const s = this._state;
    const v = btn.dataset.v;
    const tz = this._tz;
    switch (btn.dataset.act) {
      case "period":
        if (s.kind === v) return;
        s.kind = v;
        s.anchor = null;
        break;
      case "prev":
        s.anchor = shiftAnchor(s.kind, s.anchor || new Date(), -1, tz);
        break;
      case "next": {
        const next = shiftAnchor(s.kind, s.anchor || new Date(), 1, tz);
        s.anchor = isCurrent(periodRange(s.kind, next, { weekMode: this._config.week_mode, tz })) ? null : next;
        break;
      }
      case "now":
        s.anchor = null;
        break;
      case "mode":
        s.mode = v;
        this._render();
        return;
      case "chip":
        if (s.hidden.has(v)) s.hidden.delete(v);
        else s.hidden.add(v);
        this._render();
        return;
      default:
        return;
    }
    s.sel = null;
    this._render();
    this._load();
  }

  _pickCol(e) {
    const col = e.target.closest?.("[data-col]");
    if (!col || !this._ctx) return;
    const i = Number(col.dataset.col);
    const u = this._ctx.units[i];
    if (!u || u.future) return;
    if (this._state.sel === i && this._ctx.sel === i) return;
    this._state.sel = i;
    this._ctx.sel = i;
    for (const c of this.shadowRoot.querySelectorAll("[data-col]")) c.classList.toggle("sel", c === col);
    const [a, b] = historyReadout(this._ctx, u);
    const ro = this.shadowRoot.querySelector("[data-hro]");
    if (ro) ro.innerHTML = `<div class="r-title">${esc(a)}</div><div class="r-line">${esc(b)}</div>`;
  }

  _scrub(e) {
    const plot = e.target.closest?.("[data-plot]");
    const p = this._ctx?.power;
    if (!plot || !p || p.last < 0) return;
    const r = plot.getBoundingClientRect();
    const n = p.cells.length;
    const i = Math.max(0, Math.min(p.last, Math.round(((e.clientX - r.left) / r.width) * (n - 1))));
    this._ctx.scrubbing = true;
    this._showPower(i, true);
  }

  _scrubEnd() {
    if (!this._ctx?.power) return;
    this._ctx.scrubbing = false;
    this._showPower(this._ctx.power.last, false);
  }

  _showPower(i, cross) {
    const ctx = this._ctx;
    const ro = this.shadowRoot.querySelector("[data-pro]");
    const line = this.shadowRoot.querySelector("[data-cross]");
    if (!ro) return;
    const [l1, l2] = powerReadout(ctx.power.series, i, ctx);
    ro.innerHTML = `<div class="r-title">${esc(powerTitle(ctx, i))}</div><div class="r-line">${esc(l1)}</div><div class="r-line">${esc(l2)}</div>`;
    if (line) {
      const x = ((i / Math.max(1, ctx.power.cells.length - 1)) * 300).toFixed(1);
      line.setAttribute("x1", x);
      line.setAttribute("x2", x);
      line.setAttribute("opacity", cross ? "0.5" : "0");
    }
  }
}

/** Placeholder until phase 4. */
export class EnergyOverviewMiniCard extends HTMLElement {
  setConfig(config) {
    this._config = config;
  }

  set hass(hass) {
    if (this.innerHTML) return;
    this.innerHTML = `<ha-card style="padding:16px">${esc(translator(langOf(hass))("title"))}</ha-card>`;
  }

  getCardSize() {
    return 1;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 1 };
  }
}

if (!customElements.get("energy-overview-card")) customElements.define("energy-overview-card", EnergyOverviewCard);
if (!customElements.get("energy-overview-mini-card"))
  customElements.define("energy-overview-mini-card", EnergyOverviewMiniCard);

window.customCards = window.customCards || [];
for (const card of [
  {
    type: "energy-overview-card",
    name: "Energy Overview Card",
    description: "Live energy flow, balance and history (day / week / month) for PV with a home battery.",
  },
  {
    type: "energy-overview-mini-card",
    name: "Energy Overview Mini Card",
    description: "One line: battery, status, PV, grid and today's self-sufficiency; opens the full card.",
  },
]) {
  if (!window.customCards.some((c) => c.type === card.type))
    window.customCards.push({
      ...card,
      preview: true,
      documentationURL: "https://github.com/hoentaex/ha-energy-overview-card",
    });
}

console.info(`%c ENERGY-OVERVIEW-CARD %c ${VERSION} `, "color:#fff;background:#f5b942;font-weight:700", "");
