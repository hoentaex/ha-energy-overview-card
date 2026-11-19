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
  flow_style: "ellipse",
  flow_background: "none",
  house_model: "balcony",
  illustration: true,
  illustration_theme: "",
  illustration_scene: "sun",
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
    charging: "lädt",
    discharging: "entlädt",
    standby: "Standby",
    charging_label: "Akku laden",
    from: "Woher",
    to: "Wohin",
    no_flow: "Gerade fließt kein Strom",
    bands_aria: "Energiebänder von den Quellen zu den Verbrauchern, Haus {house}",
    ring_aria: "Hausverbrauch {house}, davon {own} Prozent aus eigener Energie",
    own_share: "{v} % eigen",
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
    close: "Schließen",
    mini_today: "Heute",
    mini_autarky: "Autarkie {v} %",
    hb_today_of: "heute {a} von {b}",
    hb_today: "heute {v}",
    hb_today_pv: "PV jetzt {v}",
    hb_forecast: "Prognose {v}",
    hb_bat_charge: "Akku lädt +{v}",
    hb_bat_discharge: "Akku entlädt {v}",
    hb_bat_idle: "Akku in Ruhe",
    bal_from_grid: "aus dem Netz",
    bal_from_pv: "von PV",
    bal_own: "Eigenstrom",
    bal_home: "Haus heute",
    bal_now: "jetzt",
    bal_aria: "Haus heute {home}: aus dem Netz {grid}, Eigenstrom {own}",
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
    charging: "charging",
    discharging: "discharging",
    standby: "Standby",
    charging_label: "Battery charging",
    from: "From",
    to: "To",
    no_flow: "No power is flowing right now",
    bands_aria: "Energy bands from the sources to the consumers, home {house}",
    ring_aria: "Home consumption {house}, {own} percent from own energy",
    own_share: "{v} % own",
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
    close: "Close",
    mini_today: "Today",
    mini_autarky: "Self-sufficiency {v} %",
    hb_today_of: "today {a} of {b}",
    hb_today: "today {v}",
    hb_today_pv: "solar now {v}",
    hb_forecast: "forecast {v}",
    hb_bat_charge: "battery charging +{v}",
    hb_bat_discharge: "battery discharging {v}",
    hb_bat_idle: "battery idle",
    bal_from_grid: "from the grid",
    bal_from_pv: "from solar",
    bal_own: "own energy",
    bal_home: "home today",
    bal_now: "now",
    bal_aria: "Home today {home}: from the grid {grid}, own energy {own}",
  },
};

/** Card language: the `language` option, else Home Assistant's, else English. */
export const langOf = (hass, config) => {
  const lang = String(config?.language || hass?.locale?.language || hass?.language || "en").slice(0, 2);
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
