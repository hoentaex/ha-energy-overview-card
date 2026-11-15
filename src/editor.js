// Visual editor (ha-form) for both cards, and the config of new cards (getStubConfig) from the Energy dashboard.
import { prefsLive } from "./energy.js";
import { FLOW_STYLES } from "./flowstyles.js";
import { DEFAULTS, HISTORY_MODES, langOf, SECTIONS } from "./shared.js";

const LABELS = {
  de: {
    name: "Name",
    subtitle: "Untertitel",
    icon: "Icon (leer: Blitz)",
    g_live: "Live-Werte (Leistung)",
    g_stats: "Statistik für Tag / Woche / Monat",
    g_display: "Darstellung",
    g_advanced: "Erweitert",
    solar_power_entity: "PV-Leistung",
    grid_power_entity: "Netzleistung (+ Bezug / − Einspeisung)",
    invert_grid: "Vorzeichen der Netzleistung umdrehen",
    grid_import_power_entity: "Netzbezug (getrennt)",
    grid_export_power_entity: "Einspeisung (getrennt)",
    battery_power_entity: "Akkuleistung (+ laden / − entladen)",
    invert_battery: "Vorzeichen der Akkuleistung umdrehen",
    house_power_entity: "Hausverbrauch (leer: berechnet)",
    soc_entity: "Ladestand (%)",
    capacity_entity: "Akkukapazität (Entity, kWh)",
    capacity_kwh: "Akkukapazität (fester Wert)",
    solar_stat: "Solar-Erzeugung",
    grid_import_stat: "Netzbezug",
    grid_export_stat: "Einspeisung",
    battery_charge_stat: "Akku geladen",
    battery_discharge_stat: "Akku entladen",
    battery_grid_charge_stat: "Akku geladen aus dem Netz",
    consumption_stat: "Hausverbrauch (leer: berechnet)",
    forecast_today_entity: "PV-Prognose heute (kWh)",
    sections: "Abschnitte",
    history_view: "Verlauf beim Öffnen",
    week_mode: "Woche",
    power_resolution: "Auflösung Leistungsdiagramm",
    animations: "Animationen",
    animate_by_power: "Tempo nach Leistung",
    popup: "Hauptkarte als Popup (sonst aufklappen)",
    flow_style: "Darstellung des Energieflusses",
    flow_background: "Hintergrund (Bänder und Ring)",
    weather_entity: "Wetter (für den Himmel)",
    fs_ellipse: "Ellipse",
    fs_house: "Haus-Szene",
    fs_sankey: "Energiebänder",
    fs_ring: "Haus-Ring",
    bg_none: "Kartenhintergrund",
    bg_weather: "Wetterhimmel",
    h_weather: "Die Haus-Szene zeigt immer den Himmel; ohne Wetter klar, Tag und Nacht nach sun.sun",
    language: "Sprache",
    lang_auto: "Automatisch",
    threshold_w: "Schwellwert für aktive Flüsse",
    co2_factor: "CO₂-Faktor",
    week_calendar: "Kalenderwoche (Mo–So)",
    week_rolling: "Letzte 7 Tage",
    res_5: "5 Minuten",
    res_15: "15 Minuten",
    h_live: "Leer = aus dem Energie-Dashboard (Leistungs-Sensoren)",
    h_stat: "Leer = aus dem Energie-Dashboard",
    s_header: "Kopf",
    s_flow: "Live-Energiefluss",
    s_period: "Zeitraum",
    s_power: "Leistungsdiagramm",
    s_balance: "Bilanz",
    s_history: "Verlauf",
    s_footer: "Fußzeile",
    m_consumption: "Verbrauch",
    m_solar: "Solar",
    m_battery: "Akku",
  },
  en: {
    name: "Name",
    subtitle: "Subtitle",
    icon: "Icon (empty: bolt)",
    g_live: "Live values (power)",
    g_stats: "Statistics for day / week / month",
    g_display: "Display",
    g_advanced: "Advanced",
    solar_power_entity: "PV power",
    grid_power_entity: "Grid power (+ import / − export)",
    invert_grid: "Invert the grid power sign",
    grid_import_power_entity: "Grid import (separate)",
    grid_export_power_entity: "Grid export (separate)",
    battery_power_entity: "Battery power (+ charging / − discharging)",
    invert_battery: "Invert the battery power sign",
    house_power_entity: "Home consumption (empty: calculated)",
    soc_entity: "State of charge (%)",
    capacity_entity: "Battery capacity (entity, kWh)",
    capacity_kwh: "Battery capacity (fixed value)",
    solar_stat: "Solar production",
    grid_import_stat: "Grid import",
    grid_export_stat: "Grid export",
    battery_charge_stat: "Battery charged",
    battery_discharge_stat: "Battery discharged",
    battery_grid_charge_stat: "Battery charged from the grid",
    consumption_stat: "Home consumption (empty: calculated)",
    forecast_today_entity: "PV forecast today (kWh)",
    sections: "Sections",
    history_view: "History view at start",
    week_mode: "Week",
    power_resolution: "Power chart resolution",
    animations: "Animations",
    animate_by_power: "Speed by power",
    popup: "Main card as a popup (else expand)",
    flow_style: "Energy flow style",
    flow_background: "Background (bands and ring)",
    weather_entity: "Weather (for the sky)",
    fs_ellipse: "Ellipse",
    fs_house: "House scene",
    fs_sankey: "Energy bands",
    fs_ring: "Home ring",
    bg_none: "Card background",
    bg_weather: "Weather sky",
    h_weather: "The house scene always shows the sky; without weather a clear one, day and night from sun.sun",
    language: "Language",
    lang_auto: "Automatic",
    threshold_w: "Threshold for active flows",
    co2_factor: "CO₂ factor",
    week_calendar: "Calendar week (Mon–Sun)",
    week_rolling: "Last 7 days",
    res_5: "5 minutes",
    res_15: "15 minutes",
    h_live: "Empty = from the Energy dashboard (power sensors)",
    h_stat: "Empty = from the Energy dashboard",
    s_header: "Header",
    s_flow: "Live energy flow",
    s_period: "Period",
    s_power: "Power chart",
    s_balance: "Balance",
    s_history: "History",
    s_footer: "Footer",
    m_consumption: "Consumption",
    m_solar: "Solar",
    m_battery: "Battery",
  },
};

const LIVE_FROM_PREFS = ["solar_power_entity", "grid_power_entity", "battery_power_entity"];
const STATS = [
  "solar_stat",
  "grid_import_stat",
  "grid_export_stat",
  "battery_charge_stat",
  "battery_discharge_stat",
  "battery_grid_charge_stat",
  "consumption_stat",
];

const ent = (name, domain = ["sensor"]) => ({ name, selector: { entity: { domain } } });
const bool = (name) => ({ name, selector: { boolean: {} } });
const select = (name, options) => ({ name, selector: { select: { mode: "dropdown", options } } });

export const editorSchema = (lang, { mini = false } = {}) => {
  const L = LABELS[lang] || LABELS.en;
  return [
    {
      type: "grid",
      name: "",
      schema: [
        { name: "name", selector: { text: {} } },
        { name: "subtitle", selector: { text: {} } },
      ],
    },
    { name: "icon", selector: { icon: {} } },
    {
      type: "expandable",
      name: "",
      title: L.g_live,
      flatten: true,
      schema: [
        ent("solar_power_entity"),
        ent("grid_power_entity"),
        bool("invert_grid"),
        {
          type: "grid",
          name: "",
          schema: [ent("grid_import_power_entity"), ent("grid_export_power_entity")],
        },
        ent("battery_power_entity"),
        bool("invert_battery"),
        ent("house_power_entity"),
        ent("soc_entity", ["sensor", "input_number", "number"]),
        {
          type: "grid",
          name: "",
          schema: [
            ent("capacity_entity", ["sensor", "input_number", "number"]),
            {
              name: "capacity_kwh",
              selector: { number: { min: 0, max: 100, step: 0.1, mode: "box", unit_of_measurement: "kWh" } },
            },
          ],
        },
      ],
    },
    {
      type: "expandable",
      name: "",
      title: L.g_stats,
      flatten: true,
      schema: [
        ...STATS.map((name) => ({ name, selector: { statistic: {} } })),
        ent("forecast_today_entity", ["sensor", "input_number", "number"]),
      ],
    },
    {
      type: "expandable",
      name: "",
      title: L.g_display,
      flatten: true,
      schema: [
        {
          type: "grid",
          name: "",
          schema: [
            select(
              "flow_style",
              FLOW_STYLES.map((v) => ({ value: v, label: L[`fs_${v}`] })),
            ),
            select("flow_background", [
              { value: "none", label: L.bg_none },
              { value: "weather", label: L.bg_weather },
            ]),
          ],
        },
        ent("weather_entity", ["weather"]),
        {
          name: "sections",
          selector: {
            select: {
              multiple: true,
              mode: "list",
              options: SECTIONS.map((s) => ({ value: s, label: L[`s_${s}`] })),
            },
          },
        },
        {
          type: "grid",
          name: "",
          schema: [
            select(
              "history_view",
              HISTORY_MODES.map((m) => ({ value: m, label: L[`m_${m}`] })),
            ),
            select("week_mode", [
              { value: "calendar", label: L.week_calendar },
              { value: "rolling", label: L.week_rolling },
            ]),
            select("power_resolution", [
              { value: "15", label: L.res_15 },
              { value: "5", label: L.res_5 },
            ]),
            select("language", [
              { value: "", label: L.lang_auto },
              { value: "de", label: "Deutsch" },
              { value: "en", label: "English" },
            ]),
          ],
        },
        {
          type: "grid",
          name: "",
          schema: [bool("animations"), bool("animate_by_power"), ...(mini ? [bool("popup")] : [])],
        },
      ],
    },
    {
      type: "expandable",
      name: "",
      title: L.g_advanced,
      flatten: true,
      schema: [
        {
          type: "grid",
          name: "",
          schema: [
            {
              name: "threshold_w",
              selector: { number: { min: 0, max: 1000, step: 1, mode: "box", unit_of_measurement: "W" } },
            },
            {
              name: "co2_factor",
              selector: { number: { min: 0, max: 2, step: 0.01, mode: "box", unit_of_measurement: "kg/kWh" } },
            },
          ],
        },
      ],
    },
  ];
};

export const helperFor = (lang, name) => {
  const L = LABELS[lang] || LABELS.en;
  if (STATS.includes(name)) return L.h_stat;
  if (LIVE_FROM_PREFS.includes(name)) return L.h_live;
  if (name === "weather_entity") return L.h_weather;
  return undefined;
};

// Defaults shown in the form (and dropped again from the YAML when left as they are).
const formDefaults = (mini) => ({
  ...DEFAULTS,
  popup: mini,
  sections: SECTIONS,
  history_view: "consumption",
  power_resolution: "15",
  language: "",
});

/** Card config → form data: defaults filled in, a list of statistics shown as its first entry. */
export const toFormData = (config, mini = false) => {
  const data = { ...formDefaults(mini), ...config };
  data.power_resolution = String(data.power_resolution);
  for (const k of STATS) if (Array.isArray(data[k])) data[k] = data[k][0] ?? "";
  return data;
};

/** Form data → minimal card config: empty values and defaults dropped. */
export const fromFormData = (data, mini = false, original = {}) => {
  const defaults = formDefaults(mini);
  const config = {};
  for (const [k, v] of Object.entries(data)) {
    const empty = v === "" || v === undefined || v === null || (Array.isArray(v) && !v.length);
    if (empty) continue;
    if (k in defaults && JSON.stringify(v) === JSON.stringify(defaults[k])) continue;
    // A list of statistics from YAML stays a list while its first entry is unchanged.
    if (STATS.includes(k) && Array.isArray(original[k]) && original[k][0] === v) {
      config[k] = original[k];
      continue;
    }
    config[k] = k === "power_resolution" ? Number(v) : v;
  }
  if (Array.isArray(config.sections)) config.sections = SECTIONS.filter((s) => config.sections.includes(s));
  return config;
};

class EditorBase extends HTMLElement {
  static get mini() {
    return false;
  }

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
    const mini = this.constructor.mini;
    const lang = this._lang();
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => (LABELS[this._lang()] || LABELS.en)[s.name] ?? s.name;
      this._form.computeHelper = (s) => helperFor(this._lang(), s.name);
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const { type } = this._config;
        const config = { type, ...fromFormData({ ...ev.detail.value, type: undefined }, mini, this._config) };
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const data = toFormData(this._config, mini);
    const key = JSON.stringify(data);
    if (key !== this._dataKey) {
      this._dataKey = key;
      this._form.data = data;
    }
    if (lang !== this._schemaLang) {
      this._schemaLang = lang;
      this._form.schema = editorSchema(lang, { mini });
    }
  }
}

export class EnergyOverviewCardEditor extends EditorBase {}
export class EnergyOverviewMiniCardEditor extends EditorBase {
  static get mini() {
    return true;
  }
}
export class EnergyOverviewBalanceCardEditor extends EnergyOverviewMiniCardEditor {}

// ---------------------------------------------------------------------------
// New cards: what the Energy dashboard and the states reveal
// ---------------------------------------------------------------------------

/**
 * Config for a new card. The statistics stay empty (they come from the Energy dashboard anyway); the live
 * power sensors of the dashboard are written out so they show in the editor, the battery one with
 * invert_battery since the dashboard counts it positive while discharging. The state of charge and today's
 * PV forecast are found by device class and name.
 */
export function detectConfig(hass, prefs) {
  const config = {};
  const live = prefsLive(prefs);
  for (const k of LIVE_FROM_PREFS) if (live[k]) config[k] = live[k];
  if (live.battery_power_entity) config.invert_battery = true;
  const states = hass?.states || {};
  const ids = Object.keys(states);
  const isSoc = (id) =>
    id.startsWith("sensor.") &&
    states[id].attributes?.unit_of_measurement === "%" &&
    (states[id].attributes?.device_class === "battery" || /(_soc|ladestand|state_of_charge)$/.test(id));
  // Prefer a SoC sensor that shares a name part with the battery power sensor.
  const stem = (live.battery_power_entity || "")
    .replace(/^sensor\./, "")
    .split("_")
    .slice(0, 2)
    .join("_");
  const soc = (stem && ids.find((id) => isSoc(id) && id.includes(stem))) || ids.find(isSoc);
  if (soc) config.soc_entity = soc;
  const fc =
    ids.find((id) => id === "sensor.energy_production_today") ||
    ids.find((id) => id.startsWith("sensor.") && /energy_production_today$/.test(id));
  if (fc && (prefs?.energy_sources || []).some((s) => s.config_entry_solar_forecast?.length))
    config.forecast_today_entity = fc;
  const weather = ids.find((id) => id.startsWith("weather."));
  if (weather) config.weather_entity = weather;
  return config;
}
