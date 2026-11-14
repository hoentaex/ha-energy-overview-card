// Shared helpers: i18n (de / en), number formatting, config defaults and section names.

export const SECTIONS = ["header", "flow", "period", "power", "balance", "history", "footer"];

export const DEFAULTS = {
  name: "",
  icon: "mdi:solar-power-variant",
  threshold_w: 10,
  co2_factor: 0.4,
  week_mode: "calendar",
  invert_grid: false,
  invert_battery: false,
  animations: true,
  popup: false,
};

const STRINGS = {
  de: {
    title: "Energie",
    subtitle: "PV · Akku · Netz",
    scaffold: "Gerüst – die Sektionen folgen in den nächsten Phasen.",
    mini_title: "Energie",
  },
  en: {
    title: "Energy",
    subtitle: "PV · battery · grid",
    scaffold: "Scaffold – the sections follow in the next phases.",
    mini_title: "Energy",
  },
};

export const langOf = (hass) => {
  const lang = String(hass?.locale?.language || hass?.language || "en").slice(0, 2);
  return lang in STRINGS ? lang : "en";
};

export const translator = (lang) => (key) => STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;

export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

/** Number in the card's language (de: decimal comma), or "–" when it is not a finite number. */
export const fmtNum = (value, lang, digits = 1) => {
  const n = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(n)) return "–";
  return n.toLocaleString(lang === "de" ? "de-DE" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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
