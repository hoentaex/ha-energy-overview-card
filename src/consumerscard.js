// The consumers card element (custom:energy-overview-consumers-card) and its editor. `layout: full` lists the
// consumers under the banner with a list / room / tiles switch; `layout: mini` is the banner, the top three and the bar,
// and opens the full card as a dialog.
import { bannerHTML, fitPill, groundOf, isNight } from "./banner.js";
import {
  CONSUMER_DEFAULTS,
  CONSUMERS_STYLE,
  consIcon,
  consumerEntities,
  consumerModel,
  consumersScene,
  fmtW,
  HISTORY_HOURS,
  heroHTML,
  idleHTML,
  LAYOUTS,
  stackHTML,
  switchHTML,
  VIEWS,
  viewHTML,
} from "./consumers.js";
import { Cache, fetchPrefs, historyPoints } from "./data.js";
import { deriveStatus, prefsLive, readLive } from "./energy.js";
import { svgIcon } from "./icons.js";
import "./popup.js";
import { DEFAULTS, esc, langOf, translator } from "./shared.js";
import { STYLE as BASE_STYLE } from "./styles.js";
import { BANNER_STYLE } from "./banner.js";

const STYLE = BASE_STYLE + BANNER_STYLE + CONSUMERS_STYLE;
const MIN = 60e3;
const RENDER_GAP = 1000;

const viewKey = (config) => `eoc-consumers-view:${config.name || config.title || "default"}`;
const storedView = (config) => {
  try {
    const v = localStorage.getItem(viewKey(config));
    return VIEWS.includes(v) ? v : null;
  } catch {
    return null;
  }
};

export class EnergyOverviewConsumersCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("energy-overview-consumers-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:energy-overview-consumers-card" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._cache = new Cache();
    this._hist = {};
    this._idleOpen = false;
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    this._config = { ...DEFAULTS, ...CONSUMER_DEFAULTS, ...config };
    if (!LAYOUTS.includes(this._config.layout)) this._config.layout = "full";
    const fromConfig = VIEWS.includes(this._config.view) ? this._config.view : "list";
    this._view = (this._config.view_switch !== false && storedView(this._config)) || fromConfig;
    this._bannerKey = null;
    this._sigLast = null;
    this._histKey = null;
    if (this.shadowRoot.firstChild) this.shadowRoot.replaceChildren();
    if (this._hass) this._start();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (this._dialog?.isOpen) this._dialog.hass = hass;
    if (first) this._start();
    else this._schedule();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    clearInterval(this._timer);
    this._timer = setInterval(() => this._loadHistory(true), 5 * MIN);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    clearTimeout(this._pending);
    this._timer = null;
    this._ro?.disconnect();
    this._ro = null;
  }

  getCardSize() {
    return this._config?.layout === "mini" ? 3 : 8;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  async _start() {
    if (!this._config || !this._hass || this._starting) return;
    this._starting = true;
    this._render();
    this._prefs = await fetchPrefs(this._hass, this._cache);
    this._live = prefsLive(this._prefs);
    this._starting = false;
    this._sigLast = null;
    this._render();
    this._loadHistory();
  }

  /** Power history of the consumers on now (6 h): on-since and the sparkline of the last hour. */
  async _loadHistory(force = false) {
    if (!this._hass || !this._config || this._config.layout === "mini") return;
    const ids = (this._model?.active || []).map((c) => c.id).sort();
    if (!ids.length || !this._hass.callWS) return;
    const key = ids.join(",");
    if (!force && key === this._histKey) return;
    this._histKey = key;
    const now = Date.now();
    const req = {
      type: "history/history_during_period",
      start_time: new Date(now - HISTORY_HOURS * 60 * MIN).toISOString(),
      end_time: new Date(now).toISOString(),
      entity_ids: ids,
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    };
    const res = await this._hass.callWS(req).catch(() => null);
    if (!res) return;
    const hist = {};
    for (const id of ids) {
      const unit = String(this._hass.states?.[id]?.attributes?.unit_of_measurement || "").toLowerCase();
      const pts = historyPoints(res[id], unit === "kw" ? 1000 : 1);
      // The current state is the last point, so the sparkline reaches up to now.
      const cur = Number.parseFloat(this._hass.states?.[id]?.state);
      if (Number.isFinite(cur)) pts.push({ t: Date.now(), v: cur * (unit === "kw" ? 1000 : 1) });
      if (pts.length) hist[id] = pts;
    }
    this._hist = hist;
    this._sigLast = null;
    this._render();
  }

  _items() {
    const states = this._hass?.states;
    // Detection walks all states: redo it when the set of entities or the registry changes.
    const key = `${Object.keys(states || {}).length}|${this._hass?.entities ? Object.keys(this._hass.entities).length : 0}|${!!this._prefs}`;
    if (key !== this._itemsKey) {
      this._itemsKey = key;
      this._itemList = consumerEntities(this._hass, this._config, this._prefs);
    }
    return this._itemList;
  }

  _sig() {
    const ids = this._items().map((i) => i.entity);
    const live = Object.values({ ...this._live, ...this._config })
      .filter((v) => typeof v === "string" && v.includes("."))
      .map((id) => this._hass.states?.[id]?.state);
    return [
      this._hass.themes?.darkMode,
      this._view,
      this._idleOpen,
      ...ids.map((id) => this._hass.states?.[id]?.state),
      ...live,
    ].join("|");
  }

  /** At most one render per second while the states tick. */
  _schedule() {
    if (this._pending) return;
    const wait = Math.max(0, RENDER_GAP - (Date.now() - (this._lastRender || 0)));
    this._pending = setTimeout(() => {
      this._pending = null;
      if (this._sig() !== this._sigLast) this._render();
    }, wait);
  }

  _ensureShell() {
    if (this.shadowRoot.firstChild) return;
    const mini = this._config.layout === "mini";
    this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card class="${mini ? "cons-mini" : "cons"}"><div data-banner style="display:contents"></div><div data-body${mini ? "" : ' style="display:contents"'}></div></ha-card>`;
    this.shadowRoot.addEventListener("click", (e) => this._click(e));
  }

  _click(e) {
    const el = e.target.closest?.("[data-view],[data-idle],[data-more],[data-open],[data-close]");
    if (!el) return;
    if (el.dataset.view) {
      this._view = el.dataset.view;
      try {
        localStorage.setItem(viewKey(this._config), this._view);
      } catch {
        /* private mode */
      }
      this._render();
      this.dispatchEvent(new Event("iron-resize", { bubbles: true, composed: true }));
    } else if (el.hasAttribute("data-idle")) {
      this._idleOpen = !this._idleOpen;
      this._render();
    } else if (el.dataset.more) {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", { detail: { entityId: el.dataset.more }, bubbles: true, composed: true }),
      );
    } else if (el.hasAttribute("data-open")) {
      const t = translator(langOf(this._hass, this._config));
      this._dialog = this._dialog || document.createElement("energy-overview-dialog");
      this._dialog.open({
        config: { ...this._config, layout: "full" },
        hass: this._hass,
        opener: el,
        label: this._config.name || t("cons_title"),
        element: "energy-overview-consumers-card",
      });
    } else if (el.hasAttribute("data-close")) {
      this.dispatchEvent(new CustomEvent("eoc-close", { bubbles: true, composed: true }));
    }
  }

  _render() {
    if (!this._config || !this._hass) return;
    this._ensureShell();
    this._lastRender = Date.now();
    this._sigLast = this._sig();
    const cfg = this._config;
    const mini = cfg.layout === "mini";
    const lang = langOf(this._hass, cfg);
    const t = translator(lang);
    const live = readLive(this._hass, cfg, this._live);
    const th = Number(cfg.threshold_w) || 0;
    const status = Object.values(live).some((v) => v !== null) ? deriveStatus(live, th) : null;
    const items = this._items();
    const m = consumerModel(this._hass, cfg, items, { house: live.house, hist: this._hist });
    const prevActive = (this._model?.active || []).map((c) => c.id).join(",");
    this._model = m;
    const total = m.home ?? m.sum;
    const n = m.active.length;
    const count = n === 1 ? t("cons_active_1") : t(mini ? "cons_active" : "cons_active_long", { n });

    // Banner: rebuilt only when its picture changes, otherwise its numbers are patched (animations keep running).
    const banner = this.shadowRoot.querySelector("[data-banner]");
    const illus = cfg.illustration !== false;
    const night = isNight(this._hass, cfg);
    const ground = groundOf(live, status, th);
    const lit = n > 0;
    const sub = cfg.subtitle || (status ? t(`status_${status}`) : "");
    const pillText = mini ? `${fmtW(total, lang)} · ${count}` : count;
    const bkey = [illus, night, ground, lit, sub, cfg.name, cfg.icon, mini, !!cfg._dialog, lang].join("|");
    if (bkey !== this._bannerKey) {
      this._bannerKey = bkey;
      const logo = cfg.icon ? `<ha-icon icon="${esc(cfg.icon)}"></ha-icon>` : consIcon("plug");
      const button = cfg._dialog
        ? `<button type="button" class="zoom" data-close aria-label="${esc(t("close"))}">${svgIcon("close")}</button>`
        : mini
          ? `<button type="button" class="zoom" data-open aria-haspopup="dialog" aria-label="${esc(t("cons_open"))}">${svgIcon("expand")}</button>`
          : "";
      const pill = `<span class="pill" style="--c:var(--eoc-house)"><span class="dot"></span><span data-p="pill">${esc(pillText)}</span></span>`;
      banner.innerHTML = illus
        ? bannerHTML({
            night,
            logo,
            color: "var(--eoc-house)",
            name: cfg.name || t("cons_title"),
            sub,
            pill,
            ground,
            scene: `<svg class="scene vc" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">${consumersScene({ total, lang, t, animate: cfg.animations !== false, lit })}</svg>`,
            button,
          })
        : `<div class="header"${mini ? ' style="padding:12px 14px 0"' : ""}>
            <div class="logo" style="--c:var(--eoc-house)">${logo}</div>
            <div class="titles"><div class="name">${esc(cfg.name || t("cons_title"))}</div>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div>
            ${pill}${button}
          </div>`;
      if (illus) {
        fitPill(this.shadowRoot);
        if (!this._ro && typeof ResizeObserver !== "undefined") {
          this._ro = new ResizeObserver(() => fitPill(this.shadowRoot));
          this._ro.observe(this);
        }
      }
    } else {
      const set = (p, v) => {
        const el = banner.querySelector(`[data-p="${p}"]`);
        if (el && el.textContent !== v) el.textContent = v;
      };
      set("pill", pillText);
      set("scene-total", fmtW(total, lang));
    }

    const body = this.shadowRoot.querySelector("[data-body]");
    const ctx = {
      t,
      lang,
      view: this._view,
      now: Date.now(),
      threshold: th,
      maxItems: Number(cfg.max_items) || 0,
      idleOpen: this._idleOpen,
      haIcon: !!customElements.get("ha-icon"),
    };
    if (mini) {
      const top = m.active.slice(0, 3);
      body.innerHTML = `<div class="pills">${
        top.length
          ? top
              .map(
                (c) =>
                  `<button type="button" data-more="${esc(c.id)}" style="--c:${c.color}">${esc(c.name)} <b>${esc(fmtW(c.w, lang))}</b></button>`,
              )
              .join("")
          : `<span class="empty">${esc(t("cons_none"))}</span>`
      }</div><div class="ms">${stackHTML(m, ctx, false)}</div>`;
    } else {
      const noSensors = !items.length;
      body.innerHTML = noSensors
        ? `<div class="empty">${esc(t("cons_no_sensors"))}</div>`
        : `${heroHTML(m, live, ctx)}
        <div>
          <div class="sec-h">${consIcon("list")}<span>${esc(t("cons_now"))}</span>${cfg.view_switch !== false ? switchHTML(this._view, t) : ""}</div>
          ${viewHTML(m, ctx)}
        </div>
        ${idleHTML(m, ctx)}`;
    }
    const card = this.shadowRoot.querySelector("ha-card");
    card.setAttribute(
      "aria-label",
      t("cons_aria", {
        total: fmtW(total, lang),
        top: m.active
          .slice(0, 3)
          .map((c) => `${c.name} ${fmtW(c.w, lang)}`)
          .join(", "),
      }),
    );
    // New consumers on: fetch their history (on since, sparkline).
    const nowActive = m.active.map((c) => c.id).join(",");
    if (prevActive && nowActive !== prevActive && !mini) {
      clearTimeout(this._histDelay);
      this._histDelay = setTimeout(() => this._loadHistory(), 3000);
    }
  }
}

// ---------- editor ----------

const ED = {
  de: {
    name: "Name",
    subtitle: "Untertitel",
    icon: "Symbol",
    layout: "Layout",
    layout_full: "Voll (Liste, Raum, Kacheln)",
    layout_mini: "Mini (Top 3, öffnet die volle Karte)",
    view: "Startansicht",
    view_list: "Liste",
    view_room: "Nach Raum",
    view_tiles: "Kacheln",
    view_switch: "Umschalter Liste / Raum / Kacheln zeigen",
    min_power: "Ab Leistung (W)",
    max_items: "Höchstens so viele Geräte (0 = alle)",
    show_untracked: "„Nicht erfasst“ zeigen (Haus minus Geräte)",
    entities: "Geräte (leer = automatisch erkennen)",
    exclude: "Nicht anzeigen",
    house_power_entity: "Hausverbrauch (leer = aus dem Energie-Dashboard)",
    illustration: "Illustrierter Kopf",
    animations: "Animationen",
    illustration_theme: "Kopf: Tag / Nacht",
    th_auto: "nach HA-Theme",
    th_day: "immer Tag",
    th_night: "immer Nacht",
    language: "Sprache",
    lang_auto: "automatisch",
    h_entities:
      "Ohne Auswahl: alle Leistungssensoren von Geräten, ohne PV, Netz, Akku, Zähler, Summen und den Eigenverbrauch der Steckdosen. Hat das Energie-Dashboard einzelne Geräte mit Leistungssensor, werden diese genommen.",
    h_exclude: "Zum Beispiel eine Steckdosenleiste, deren Ausgänge schon einzeln gezählt werden.",
  },
  en: {
    name: "Name",
    subtitle: "Subtitle",
    icon: "Icon",
    layout: "Layout",
    layout_full: "Full (list, room, tiles)",
    layout_mini: "Mini (top three, opens the full card)",
    view: "Start view",
    view_list: "List",
    view_room: "By room",
    view_tiles: "Tiles",
    view_switch: "Show the list / room / tiles switch",
    min_power: "From power (W)",
    max_items: "At most this many devices (0 = all)",
    show_untracked: "Show “untracked” (home minus devices)",
    entities: "Devices (empty = detect automatically)",
    exclude: "Hide",
    house_power_entity: "Home power (empty = from the Energy dashboard)",
    illustration: "Illustrated header",
    animations: "Animations",
    illustration_theme: "Header: day / night",
    th_auto: "follow the HA theme",
    th_day: "always day",
    th_night: "always night",
    language: "Language",
    lang_auto: "automatic",
    h_entities:
      "Empty: every power sensor of a device, without PV, grid, battery, meters, totals and the smart plugs' own use. If the Energy dashboard lists individual devices with a power sensor, those are taken.",
    h_exclude: "For example a power strip whose outlets are already counted one by one.",
  },
};

const powerSel = { entity: { domain: "sensor", device_class: "power", multiple: true } };

export const consumersSchema = (lang) => {
  const L = ED[lang] || ED.en;
  const sel = (name, opts) => ({
    name,
    selector: { select: { mode: "dropdown", options: opts.map(([value, label]) => ({ value, label })) } },
  });
  return [
    { name: "name", selector: { text: {} } },
    { name: "subtitle", selector: { text: {} } },
    sel("layout", [
      ["full", L.layout_full],
      ["mini", L.layout_mini],
    ]),
    {
      type: "grid",
      name: "",
      schema: [
        sel(
          "view",
          VIEWS.map((v) => [v, L[`view_${v}`]]),
        ),
        {
          name: "min_power",
          selector: { number: { min: 0, max: 500, step: 0.5, mode: "box", unit_of_measurement: "W" } },
        },
        { name: "max_items", selector: { number: { min: 0, max: 50, step: 1, mode: "box" } } },
      ],
    },
    { name: "view_switch", selector: { boolean: {} } },
    { name: "show_untracked", selector: { boolean: {} } },
    { name: "entities", selector: powerSel },
    { name: "exclude", selector: powerSel },
    { name: "house_power_entity", selector: { entity: { domain: "sensor", device_class: "power" } } },
    {
      type: "grid",
      name: "",
      schema: [
        { name: "illustration", selector: { boolean: {} } },
        { name: "animations", selector: { boolean: {} } },
      ],
    },
    {
      type: "grid",
      name: "",
      schema: [
        sel("illustration_theme", [
          ["", L.th_auto],
          ["day", L.th_day],
          ["night", L.th_night],
        ]),
        { name: "icon", selector: { icon: {} } },
        sel("language", [
          ["", L.lang_auto],
          ["de", "Deutsch"],
          ["en", "English"],
        ]),
      ],
    },
  ];
};

const FORM_DEFAULTS = {
  ...CONSUMER_DEFAULTS,
  illustration: true,
  animations: true,
  illustration_theme: "",
  language: "",
};

/** Config → form: defaults filled in, entity lists as ids (YAML objects with a name keep their name, see below). */
export const consumersToForm = (config) => {
  const d = { ...FORM_DEFAULTS, ...config };
  for (const k of ["entities", "exclude"])
    d[k] = (config[k] || []).map((e) => (typeof e === "string" ? e : e?.entity)).filter(Boolean);
  return d;
};

/** Form → config: defaults and empty values dropped; entity objects from YAML kept for ids still in the list. */
export const consumersFromForm = (data, original = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "type") continue;
    const empty = v === "" || v === undefined || v === null || (Array.isArray(v) && !v.length);
    if (empty) continue;
    if (k in FORM_DEFAULTS && v === FORM_DEFAULTS[k]) continue;
    if (k === "entities" || k === "exclude") {
      const objs = new Map(
        (original[k] || []).filter((e) => typeof e === "object" && e?.entity).map((e) => [e.entity, e]),
      );
      out[k] = v.map((id) => objs.get(id) || id);
      continue;
    }
    out[k] = v;
  }
  return out;
};

export class EnergyOverviewConsumersCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _lang() {
    return this._config?.language || langOf(this._hass);
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => (ED[this._lang()] || ED.en)[s.name] ?? s.name;
      this._form.computeHelper = (s) => {
        const L = ED[this._lang()] || ED.en;
        return s.name === "entities" ? L.h_entities : s.name === "exclude" ? L.h_exclude : undefined;
      };
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { type: this._config.type, ...consumersFromForm(ev.detail.value, this._config) };
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const data = consumersToForm(this._config);
    const key = JSON.stringify(data);
    if (key !== this._dataKey) {
      this._dataKey = key;
      this._form.data = data;
    }
    const lang = this._lang();
    if (lang !== this._schemaLang) {
      this._schemaLang = lang;
      this._form.schema = consumersSchema(lang);
    }
  }
}

if (!customElements.get("energy-overview-consumers-card"))
  customElements.define("energy-overview-consumers-card", EnergyOverviewConsumersCard);
if (!customElements.get("energy-overview-consumers-card-editor"))
  customElements.define("energy-overview-consumers-card-editor", EnergyOverviewConsumersCardEditor);
