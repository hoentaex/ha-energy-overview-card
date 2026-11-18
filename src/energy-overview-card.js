/*
 * Energy Overview Card for Home Assistant
 * https://github.com/hoentaex/ha-energy-overview-card
 *
 * Live energy flow, balance and history (day / week / month) of a PV system with a home battery
 * in one card. No control logic, no tariffs.
 *
 * Layout and look follow the cards of juju35 (https://github.com/juju35). MIT licence.
 */
import { BALANCE_STYLE, patchBalance, renderBalance } from "./balancecard.js";
import { bindMore, MORE_STYLE, moreIds } from "./more.js";
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
import { socColor } from "./flow.js";
import {
  detectConfig,
  EnergyOverviewBalanceCardEditor,
  EnergyOverviewCardEditor,
  EnergyOverviewMiniCardEditor,
} from "./editor.js";
import { svgIcon } from "./icons.js";
import "./assets.js";
import { animateSky } from "./flowstyles.js";
import "./popup.js";
import {
  defaultSel,
  historyReadout,
  historyUnits,
  powerReadoutHTML,
  powerTitle,
  RENDERERS,
  STATUS_COLOR,
  statusPill,
} from "./sections.js";
import { DEFAULTS, esc, fmtPower, HISTORY_MODES, langOf, SECTIONS, translator } from "./shared.js";
import { BANNER_STYLE, fitPill, renderBanner } from "./banner.js";
import { STYLE as BASE_STYLE } from "./styles.js";
import { daySun } from "./sun.js";
import { tzOf } from "./tz.js";

const VERSION = __VERSION__;
const STYLE = BASE_STYLE + BANNER_STYLE + MORE_STYLE;
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

  static getConfigElement() {
    return document.createElement("energy-overview-card-editor");
  }

  /** New cards: live sensors, SoC and forecast from the Energy dashboard and the states. */
  static async getStubConfig(hass) {
    const prefs = hass?.callWS ? await hass.callWS({ type: "energy/get_prefs" }).catch(() => null) : null;
    return { type: "custom:energy-overview-card", ...detectConfig(hass, prefs) };
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
    this._ro?.disconnect();
    this._ro = null;
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
    const lang = langOf(hass, config);
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
      more: moreIds(config, this._live, this._prefs),
    };
    if (power?.series.soc && range.kind === "day") {
      ctx.hourSoc = range.slots.map((slot) => {
        const vals = power.cells
          .map((c, i) => (c >= slot.start.getTime() && c < slot.end.getTime() ? power.series.soc[i] : null))
          .filter(Number.isFinite);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      });
    }
    // Today's production for the banner, kept while another period is shown.
    if (range.kind === "day" && current && fresh && ctx.energy?.hasData)
      this._todayBanner = {
        slots: range.slots,
        solar: ctx.energy.split.map((x) => (x ? x.solar : null)),
        forecast: this._data.forecast || null,
        total: ctx.energy.total.solar ?? null,
        forecastKwh: ctx.forecastToday,
      };
    ctx.today = this._todayBanner || null;
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
    const focus = this._focusKey();
    // Sky and house image stay the same elements across a full render, so they never reload (the card would shrink
    // for a moment and the page could scroll).
    const kept = new Map([...this.shadowRoot.querySelectorAll("[data-keep]")].map((n) => [n.dataset.keep, n]));
    this.shadowRoot.innerHTML = `<style>${STYLE}.sec{display:contents}</style><ha-card>${body}</ha-card>`;
    for (const n of this.shadowRoot.querySelectorAll("[data-keep]")) {
      const old = kept.get(n.dataset.keep);
      if (old) n.replaceWith(old);
    }
    if (focus) this.shadowRoot.querySelector(focus)?.focus({ preventScroll: true });
    this._liveSig = this._liveSignature();
    this._bind();
    animateSky(this.shadowRoot);
    this._fitBanner();
  }

  /** The banner's pill is measured after each render and whenever the card is resized. */
  _fitBanner() {
    if (this._config.illustration === false) return;
    fitPill(this.shadowRoot);
    if (!this._ro && typeof ResizeObserver !== "undefined") {
      this._ro = new ResizeObserver(() => fitPill(this.shadowRoot));
      this._ro.observe(this);
    }
  }

  /** Selector of the focused control, so keyboard focus survives a re-render. */
  _focusKey() {
    const el = this.shadowRoot.activeElement;
    if (!el?.dataset) return null;
    if (el.dataset.close !== undefined) return "[data-close]";
    if (el.dataset.col !== undefined) return `[data-col="${el.dataset.col}"]`;
    if (el.dataset.act) return `[data-act="${el.dataset.act}"]${el.dataset.v ? `[data-v="${el.dataset.v}"]` : ""}`;
    return null;
  }

  /**
   * Re-renders only the given sections (a line toggled in the chart, another history view), so the rest of the card
   * and the page's scroll position stay as they are; keyboard focus moves to the same control without scrolling.
   */
  _renderSections(names) {
    if (!this.shadowRoot.firstChild) return this._render();
    const ctx = (this._ctx = this._context());
    const focus = this._focusKey();
    for (const s of names) {
      const el = this.shadowRoot.querySelector(`[data-sec="${s}"]`);
      if (el) el.innerHTML = RENDERERS[s](ctx);
    }
    if (focus) this.shadowRoot.querySelector(focus)?.focus({ preventScroll: true });
  }

  _liveSignature() {
    const ids = liveKeys(this._config, this._live);
    const sun = this._hass?.states?.["sun.sun"];
    const weather = this._config.weather_entity ? this._hass?.states?.[this._config.weather_entity]?.state : "";
    const dark = this._hass?.themes?.darkMode ? "dark" : "light";
    return `${dark}${ids.map((id) => this._hass?.states?.[id]?.state).join("|")}${sun?.state || ""}${Math.round(Number(sun?.attributes?.elevation) || 0)}${weather || ""}`;
  }

  _maybeRenderLive() {
    if (!this._started || !this.shadowRoot.firstChild) return;
    if (this._liveSignature() !== this._liveSig) this._renderLive();
  }

  /** Re-renders only header and flow (live values), keeping the period sections and their state. */
  _renderLive() {
    if (!this.shadowRoot.firstChild || !this._config) return;
    const ctx = this._context();
    const focus = this._focusKey();
    for (const s of ["header", "flow"]) {
      const el = this.shadowRoot.querySelector(`[data-sec="${s}"]`);
      if (!el) continue;
      // Sky and house image stay in place while their key is unchanged (no flicker, rain keeps falling).
      const kept = new Map([...el.querySelectorAll("[data-keep]")].map((n) => [n.dataset.keep, n]));
      el.innerHTML = RENDERERS[s](ctx);
      for (const n of el.querySelectorAll("[data-keep]")) {
        const old = kept.get(n.dataset.keep);
        if (old) n.replaceWith(old);
      }
    }
    animateSky(this.shadowRoot);
    this._fitBanner();
    if (focus === "[data-close]") this.shadowRoot.querySelector(focus)?.focus({ preventScroll: true });
    this._liveSig = this._liveSignature();
  }

  // ---------- interaction ----------

  _bind() {
    if (this._bound) return;
    this._bound = true;
    const root = this.shadowRoot;
    bindMore(root, this);
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
    if (e.target.closest?.("[data-close]")) {
      this.dispatchEvent(new CustomEvent("eoc-close", { bubbles: true, composed: true }));
      return;
    }
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
        this._renderSections(["history"]);
        return;
      case "chip":
        if (s.hidden.has(v)) s.hidden.delete(v);
        else s.hidden.add(v);
        this._renderSections(["power"]);
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
    const [l1, l2] = powerReadoutHTML(ctx.power.series, i, ctx);
    ro.innerHTML = `<div class="r-title">${esc(powerTitle(ctx, i))}</div><div class="r-line">${l1}</div><div class="r-line">${l2}</div>`;
    if (line) {
      const x = ((i / Math.max(1, ctx.power.cells.length - 1)) * 300).toFixed(1);
      line.setAttribute("x1", x);
      line.setAttribute("x2", x);
      line.setAttribute("opacity", cross ? "0.5" : "0");
    }
  }
}

const expandIcon = svgIcon("expand");
const collapseIcon = svgIcon("collapse");

/**
 * One row: SoC ring, name, status, PV / grid now and today's self-sufficiency. The button opens the main card
 * as a dialog (`popup: true`, default) or expands it below the row (`popup: false`).
 */
export class EnergyOverviewMiniCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("energy-overview-mini-card-editor");
  }

  static async getStubConfig(hass) {
    return { ...(await EnergyOverviewCard.getStubConfig(hass)), type: "custom:energy-overview-mini-card" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._cache = new Cache();
    this._expanded = false;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = { ...DEFAULTS, popup: true, ...config };
    this._cache.clear();
    this._autarky = undefined;
    if (this._inline) this._inline.setConfig(this._mainConfig());
    if (this._hass) this._start();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    this._tz = tzOf(hass);
    if (this._dialog?.isOpen) this._dialog.hass = hass;
    if (this._inline) this._inline.hass = hass;
    if (first) this._start();
    else if (this._sig() !== this._lastSig) this._render();
  }

  connectedCallback() {
    clearInterval(this._timer);
    this._timer = setInterval(() => this._loadToday(), 5 * TICK);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    this._timer = null;
    this._ro?.disconnect();
    this._ro = null;
  }

  getCardSize() {
    return this._expanded ? 1 + 18 : this._config?.illustration !== false ? 3 : 1;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  _mainConfig() {
    const { popup, ...rest } = this._config;
    return { ...rest, type: "custom:energy-overview-card" };
  }

  async _start() {
    if (!this._config || !this._hass) return;
    this._render();
    this._prefs = await fetchPrefs(this._hass, this._cache);
    this._live = prefsLive(this._prefs);
    this._render();
    this._loadToday();
  }

  async _loadToday() {
    if (!this._hass || !this._config) return;
    const range = periodRange("day", new Date(), { tz: this._tz });
    const [energy, forecast] = await Promise.all([
      fetchPeriodEnergy(this._hass, this._cache, this._config, this._prefs, range).catch(() => null),
      this._config.illustration !== false
        ? fetchForecast(this._hass, this._cache, range, forecastEntries(this._prefs)).catch(() => null)
        : null,
    ]);
    const autarky = energy?.hasData ? energy.total.autarky : null;
    // Today's production for the banner (sun readout, day curve).
    const fcEntity = Number.parseFloat(this._hass?.states?.[this._config.forecast_today_entity]?.state);
    const fcSum = forecast ? forecast.reduce((a, b) => a + b, 0) : null;
    const today = energy?.hasData
      ? {
          slots: range.slots,
          solar: energy.split.map((x) => (x ? x.solar : null)),
          forecast: forecast || null,
          total: energy.total.solar ?? null,
          forecastKwh: Number.isFinite(fcEntity) ? fcEntity : fcSum > 0 ? fcSum : null,
        }
      : null;
    const todaySig = JSON.stringify([today?.solar, today?.forecast, today?.forecastKwh]);
    if (autarky !== this._autarky || todaySig !== this._todaySig) {
      this._autarky = autarky;
      this._todayBanner = today;
      this._todaySig = todaySig;
      this._render();
    }
  }

  _sig() {
    const dark = this._hass?.themes?.darkMode ? "dark" : "light";
    const sun = this._hass?.states?.["sun.sun"];
    return `${dark}|${sun?.state || ""}|${liveKeys(this._config, this._live)
      .map((id) => this._hass?.states?.[id]?.state)
      .join("|")}`;
  }

  _render() {
    if (!this._config || !this._hass) return;
    const lang = langOf(this._hass, this._config);
    const t = translator(lang);
    const live = readLive(this._hass, this._config, this._live);
    const th = Number(this._config.threshold_w) || 0;
    const status = Object.values(live).some((v) => v !== null) ? deriveStatus(live, th) : null;
    const soc = Number.isFinite(live.soc) ? Math.max(0, Math.min(100, live.soc)) : null;
    const C = 2 * Math.PI * 19;
    const exporting = (live.grid_export || 0) > th && (live.grid_export || 0) >= (live.grid_import || 0);
    const grid = exporting
      ? `<span><b class="tx-exp">${esc(t("grid"))}</b> ↑ ${esc(fmtPower(live.grid_export, lang))}</span>`
      : `<span><b class="tx-imp">${esc(t("grid"))}</b> ↓ ${esc(fmtPower(live.grid_import, lang))}</span>`;
    const autarky = Number.isFinite(this._autarky)
      ? `<span><b>${esc(t("mini_today"))}</b> ${esc(t("mini_autarky", { v: Math.round(this._autarky * 100) }))}</span>`
      : "";
    const inline = this._config.popup === false;
    const btn = inline
      ? `<button type="button" class="zoom" data-open aria-expanded="${this._expanded}" aria-label="${esc(t("open"))}">${this._expanded ? collapseIcon : expandIcon}</button>`
      : `<button type="button" class="zoom" data-open aria-haspopup="dialog" aria-label="${esc(t("open"))}">${expandIcon}</button>`;
    const row =
      this._config.illustration !== false
        ? this._bannerRow({ lang, t, live, status, soc, grid, autarky, btn })
        : `<ha-card class="mini">
      <div class="socring">
        <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
          <circle cx="23" cy="23" r="19" fill="none" stroke="var(--eoc-line)" stroke-width="4"/>
          ${soc ? `<circle cx="23" cy="23" r="19" fill="none" stroke="${socColor(soc)}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${((C * soc) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 23 23)"/>` : ""}
        </svg>
        <span>${soc === null ? "–" : `${Math.round(soc)}%`}</span>
      </div>
      <div class="body">
        <div class="row1"><span class="name">${esc(this._config.name || t("title"))}</span>${statusPill({ status, t })}</div>
        <div class="row2">
          <span><b class="tx-pv">${esc(t("pv"))}</b> ${esc(fmtPower(live.solar, lang))}</span>
          ${grid}
          ${autarky}
        </div>
      </div>
      ${btn}
    </ha-card>`;
    this._ensureShell();
    this.shadowRoot.querySelector("[data-row]").innerHTML = row;
    this._lastSig = this._sig();
    if (this._config.illustration !== false) {
      fitPill(this.shadowRoot);
      if (!this._ro && typeof ResizeObserver !== "undefined") {
        this._ro = new ResizeObserver(() => fitPill(this.shadowRoot));
        this._ro.observe(this);
      }
    }
  }

  /** The mini card with the banner: the banner (open button in its corner), then SoC, PV, grid and today's autarky. */
  _bannerRow({ lang, t, live, status, soc, grid, autarky, btn }) {
    const banner = renderBanner({
      hass: this._hass,
      config: this._config,
      live,
      status,
      today: this._todayBanner || null,
      t,
      lang,
      tz: this._tz,
      logo: this._config.icon ? `<ha-icon icon="${esc(this._config.icon)}"></ha-icon>` : svgIcon("flash"),
      color: STATUS_COLOR[status] || "var(--eoc-pv)",
      name: this._config.name || t("title"),
      sub: this._config.subtitle,
      pill: statusPill({ status, t }),
      button: btn,
    });
    return `<ha-card class="mini-b">${banner}
      <div class="row2">
        <span><b>${esc(t("battery"))}</b> <span class="socmini" style="color:${soc === null ? "inherit" : socColor(soc)}">${soc === null ? "–" : `${Math.round(soc)} %`}</span></span>
        <span><b class="tx-pv">${esc(t("pv"))}</b> ${esc(fmtPower(live.solar, lang))}</span>
        ${grid}
        ${autarky}
      </div>
    </ha-card>`;
  }

  _ensureShell() {
    if (this.shadowRoot.firstChild) return;
    this.shadowRoot.innerHTML = `<style>${STYLE}.wrap{display:flex;flex-direction:column;gap:8px}</style><div class="wrap"><div data-row></div><div data-inline></div></div>`;
    this.shadowRoot.addEventListener("click", (e) => {
      const open = e.target.closest?.("[data-open]");
      if (open) this._open(open);
    });
  }

  _open(opener) {
    const t = translator(langOf(this._hass, this._config));
    if (this._config.popup === false) {
      this._expanded = !this._expanded;
      const box = this.shadowRoot.querySelector("[data-inline]");
      if (this._expanded) {
        this._inline = document.createElement("energy-overview-card");
        this._inline.setConfig(this._mainConfig());
        this._inline.hass = this._hass;
        box.append(this._inline);
      } else {
        box.replaceChildren();
        this._inline = null;
      }
      this._render();
      this.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
      return;
    }
    this._dialog = this._dialog || document.createElement("energy-overview-dialog");
    this._dialog.open({ config: this._mainConfig(), hass: this._hass, opener, label: this._config.name || t("title") });
  }
}

/**
 * Balance card: today's home consumption as a ring split by grid / battery / solar, the grid on the left and the
 * own energy on the right, wires with a moving light for what flows right now. Opens the main card like the mini card.
 */
export class EnergyOverviewBalanceCard extends EnergyOverviewMiniCard {
  static getConfigElement() {
    return document.createElement("energy-overview-balance-card-editor");
  }

  static async getStubConfig(hass) {
    return { ...(await EnergyOverviewCard.getStubConfig(hass)), type: "custom:energy-overview-balance-card" };
  }

  setConfig(config) {
    this._today = undefined;
    this._shape = null;
    super.setConfig(config);
  }

  getCardSize() {
    return this._expanded ? 3 + 18 : 3;
  }

  async _loadToday() {
    if (!this._hass || !this._config) return;
    const range = periodRange("day", new Date(), { tz: this._tz });
    const energy = await fetchPeriodEnergy(this._hass, this._cache, this._config, this._prefs, range).catch(() => null);
    const today = energy?.hasData ? energy.total : null;
    if (JSON.stringify(today) !== JSON.stringify(this._today)) {
      this._today = today;
      this._render();
    }
  }

  _render() {
    if (!this._config || !this._hass) return;
    const lang = langOf(this._hass, this._config);
    const t = translator(lang);
    const live = readLive(this._hass, this._config, this._live);
    const first = !this.shadowRoot.firstChild;
    if (first) {
      this.shadowRoot.innerHTML = `<style>${STYLE}${BALANCE_STYLE}.wrap{display:flex;flex-direction:column;gap:8px}</style><div class="wrap"><ha-card class="bal" data-open role="button" tabindex="0"></ha-card><div data-inline></div></div>`;
      this.shadowRoot.addEventListener("click", (e) => {
        const open = e.target.closest?.("[data-open]");
        if (open) this._open(open);
      });
      this.shadowRoot.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("[data-open]")) {
          e.preventDefault();
          this._open(e.target);
        }
      });
    }
    const card = this.shadowRoot.querySelector(".bal");
    const out = renderBalance(this._today, live, {
      t,
      lang,
      threshold: Number(this._config.threshold_w) || 0,
      animations: this._config.animations !== false,
      byPower: this._config.animate_by_power !== false,
      // The ring sweeps in once, when the day's numbers first arrive.
      intro: !!this._today && !this._swept,
    });
    if (this._today) this._swept = true;
    let patched = false;
    if (out.shape === this._shape) {
      const fresh = document.createElement("div");
      fresh.innerHTML = out.html;
      patched = patchBalance(card, fresh);
    }
    if (!patched) card.innerHTML = out.html;
    this._shape = out.shape;
    card.setAttribute("aria-label", `${out.label}. ${t("open")}`);
    if (this._config.popup === false) card.setAttribute("aria-expanded", String(this._expanded));
    else card.setAttribute("aria-haspopup", "dialog");
    this._lastSig = this._sig();
  }
}

if (!customElements.get("energy-overview-card")) customElements.define("energy-overview-card", EnergyOverviewCard);
if (!customElements.get("energy-overview-mini-card"))
  customElements.define("energy-overview-mini-card", EnergyOverviewMiniCard);
if (!customElements.get("energy-overview-balance-card"))
  customElements.define("energy-overview-balance-card", EnergyOverviewBalanceCard);

if (!customElements.get("energy-overview-card-editor"))
  customElements.define("energy-overview-card-editor", EnergyOverviewCardEditor);
if (!customElements.get("energy-overview-mini-card-editor"))
  customElements.define("energy-overview-mini-card-editor", EnergyOverviewMiniCardEditor);
if (!customElements.get("energy-overview-balance-card-editor"))
  customElements.define("energy-overview-balance-card-editor", EnergyOverviewBalanceCardEditor);

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
  {
    type: "energy-overview-balance-card",
    name: "Energy Overview Balance Card",
    description: "Today's home consumption as a ring by source, grid and own energy beside it; opens the full card.",
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
