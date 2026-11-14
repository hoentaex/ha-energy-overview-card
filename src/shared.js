// Shared helpers: i18n (de / en), number and time formatting, config defaults and section names.

export const SECTIONS = ["header", "flow", "period", "power", "balance", "history", "footer"];
export const HISTORY_MODES = ["consumption", "solar", "battery"];

export const DEFAULTS = {
  name: "",
  subtitle: "",
  icon: "",
  threshold_w: 10,
  co2_factor: 0.4,
  week_mode: "calendar",
  power_resolution: 15,
  invert_grid: false,
  invert_battery: false,
  animations: true,
  animate_by_power: true,
  popup: false,
};

const STRINGS = {
  de: {
    title: "Energie",
    live: "Live",
    solar: "Solar",
    grid: "Netz",
    house: "Haus",
    battery: "Akku",
    forecast_today: "Prognose heute {v}",
    import: "Bezug",
    export: "Einspeisung",
    consumption: "Verbrauch",
    of: "{a} von {b}",
    status_grid_house: "Netz versorgt Haus",
    status_pv_charging: "PV-Überschuss · Akku lädt",
    status_pv_house: "PV deckt Haus",
    status_battery_house: "Akku versorgt Haus",
    status_export: "Einspeisung",
    flow_aria: "Energiefluss: Solar {solar}, Netz {grid} {gridSub}, Haus {house}, Akku {bat}",
    flow_aria_soc: " bei {soc} Prozent",
    period: "Zeitraum",
    period_day: "Tag",
    period_week: "Woche",
    period_month: "Monat",
    prev: "Vorheriger Zeitraum",
    next: "Nächster Zeitraum",
    now: "Jetzt",
    today: "Heute",
    power_title: "Leistungsdiagramm",
    latest: "zuletzt",
    grid_import: "Netzbezug",
    grid_export: "Einspeisung",
    pv: "PV",
    soc_pct: "Akku %",
    toggle_lines: "Linien ein- und ausblenden",
    power_aria: "Leistungsverlauf {range}: Spitze {max} kW",
    balance: "Bilanz",
    production: "Erzeugung",
    to_house: "Haus",
    autarky: "Autarkie",
    self_consumption: "Eigenverbrauch",
    co2: "CO₂ gespart (kg)",
    hist_day: "Tagesverlauf",
    hist_week: "Tage",
    hist_month: "Tage im Monat",
    view: "Ansicht",
    mode_consumption: "Verbrauch",
    mode_solar: "Solar",
    mode_battery: "Akku",
    from_solar: "aus Solar",
    from_battery: "aus Akku",
    from_grid: "aus Netz",
    into_house: "ins Haus",
    into_battery: "in Akku",
    charged_pv: "geladen aus PV",
    charged_grid: "geladen aus Netz",
    discharged: "entladen",
    forecast: "Prognose",
    soc_line: "Ladestand %",
    no_data: "Noch keine Daten",
    ro_consumption: "{title} · Verbrauch {v} kWh",
    ro_consumption_2: "Solar {a} · Akku {b} · Netz {c} kWh",
    ro_solar: "{title} · Erzeugung {v} kWh",
    ro_forecast: " · Prognose {v} kWh",
    ro_solar_2: "Haus {a} · Akku {b} · Einspeisung {c} kWh",
    ro_battery: "{title}",
    ro_soc: " · Ladestand {v} %",
    ro_battery_2: "Geladen {a} (PV {b} · Netz {c}) · Entladen {d} kWh",
    battery_charged: "Akku geladen",
    pv_vs_forecast: "PV Ist / Prognose",
    no_stats: "Keine Statistik gefunden – Energie-Dashboard einrichten oder Quellen in der Karte angeben.",
    loading: "Lade …",
    open: "Energie-Übersicht öffnen",
    mini_today: "Heute",
    mini_autarky: "Autarkie {v} %",
  },
  en: {
    title: "Energy",
    live: "Live",
    solar: "Solar",
    grid: "Grid",
    house: "Home",
    battery: "Battery",
    forecast_today: "Forecast today {v}",
    import: "Import",
    export: "Export",
    consumption: "Consumption",
    of: "{a} of {b}",
    status_grid_house: "Grid supplies home",
    status_pv_charging: "PV surplus · charging",
    status_pv_house: "PV covers home",
    status_battery_house: "Battery supplies home",
    status_export: "Exporting",
    flow_aria: "Energy flow: solar {solar}, grid {grid} {gridSub}, home {house}, battery {bat}",
    flow_aria_soc: " at {soc} percent",
    period: "Period",
    period_day: "Day",
    period_week: "Week",
    period_month: "Month",
    prev: "Previous period",
    next: "Next period",
    now: "Now",
    today: "Today",
    power_title: "Power",
    latest: "latest",
    grid_import: "Grid import",
    grid_export: "Export",
    pv: "PV",
    soc_pct: "Battery %",
    toggle_lines: "Show or hide lines",
    power_aria: "Power {range}: peak {max} kW",
    balance: "Balance",
    production: "Production",
    to_house: "Home",
    autarky: "Self-sufficiency",
    self_consumption: "Self-consumption",
    co2: "CO₂ saved (kg)",
    hist_day: "Hours",
    hist_week: "Days",
    hist_month: "Days of the month",
    view: "View",
    mode_consumption: "Usage",
    mode_solar: "Solar",
    mode_battery: "Battery",
    from_solar: "from solar",
    from_battery: "from battery",
    from_grid: "from grid",
    into_house: "to home",
    into_battery: "to battery",
    charged_pv: "charged from PV",
    charged_grid: "charged from grid",
    discharged: "discharged",
    forecast: "Forecast",
    soc_line: "State of charge %",
    no_data: "No data yet",
    ro_consumption: "{title} · consumption {v} kWh",
    ro_consumption_2: "Solar {a} · battery {b} · grid {c} kWh",
    ro_solar: "{title} · production {v} kWh",
    ro_forecast: " · forecast {v} kWh",
    ro_solar_2: "Home {a} · battery {b} · export {c} kWh",
    ro_battery: "{title}",
    ro_soc: " · charge {v} %",
    ro_battery_2: "Charged {a} (PV {b} · grid {c}) · discharged {d} kWh",
    battery_charged: "Battery charged",
    pv_vs_forecast: "PV actual / forecast",
    no_stats: "No statistics found – set up the Energy dashboard or give the sources in the card.",
    loading: "Loading …",
    open: "Open energy overview",
    mini_today: "Today",
    mini_autarky: "Self-sufficiency {v} %",
  },
};

export const langOf = (hass) => {
  const lang = String(hass?.locale?.language || hass?.language || "en").slice(0, 2);
  return lang in STRINGS ? lang : "en";
};

/** t(key, { name: value }) with {name} placeholders. */
export const translator =
  (lang) =>
  (key, vars = {}) =>
    String(STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const locale = (lang) => (lang === "de" ? "de-DE" : "en-US");

/** Number in the card's language (de: decimal comma), or "–" when it is not a finite number. */
export const fmtNum = (value, lang, digits = 1) => {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return "–";
  return n.toLocaleString(locale(lang), { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

/** Power in W, switching to kW from 1000 W (sign kept). */
export const fmtPower = (watts, lang) => {
  const n = Number(watts);
  if (watts === null || watts === undefined || !Number.isFinite(n)) return "–";
  return Math.abs(n) >= 1000 ? `${fmtNum(n / 1000, lang, 2)} kW` : `${fmtNum(n, lang, 0)} W`;
};

/** Energy in kWh. */
export const fmtEnergy = (kwh, lang, digits = 2) => {
  const s = fmtNum(kwh, lang, digits);
  return s === "–" ? s : `${s} kWh`;
};

/** "13:05" in the server's time zone. */
export const fmtTime = (date, lang, tz) =>
  date.toLocaleTimeString(locale(lang), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz });

/** "Sa., 14. Nov." in the server's time zone. */
export const fmtDay = (date, lang, tz) =>
  date.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: tz,
  });

/** "Sa" / "Sat". */
export const fmtWeekday = (date, lang, tz) =>
  date.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { weekday: "short", timeZone: tz }).replace(".", "");
