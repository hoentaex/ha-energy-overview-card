/*
 * Energy Overview Card for Home Assistant
 * https://github.com/hoentaex/ha-energy-overview-card
 *
 * Live energy flow, balance and history (day / week / month) of a PV system with a home battery
 * in one card. No control logic, no tariffs.
 *
 * Layout and look follow the cards of juju35 (https://github.com/juju35). MIT licence.
 */
import { DEFAULTS, esc, langOf, SECTIONS, translator } from "./shared.js";

const VERSION = __VERSION__;

const STYLE = `
  :host { display: block; }
  ha-card { padding: 16px; overflow: hidden; }
  .header { display: flex; align-items: center; gap: 12px; }
  .logo {
    width: 40px; height: 40px; border-radius: 50%; flex: none; display: grid; place-items: center;
    color: var(--eoc-pv-color, #f5b942);
    background: color-mix(in srgb, var(--eoc-pv-color, #f5b942) 16%, transparent);
  }
  .titles { min-width: 0; flex: 1; }
  .name { font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
  .sub { font-size: 13px; color: var(--secondary-text-color); }
  .note { margin-top: 12px; font-size: 13px; color: var(--secondary-text-color); }
`;

export class EnergyOverviewCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    const sections = Array.isArray(config.sections) ? config.sections.filter((s) => SECTIONS.includes(s)) : SECTIONS;
    this._config = { ...DEFAULTS, ...config, sections };
    if (this._hass) this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._render();
  }

  getCardSize() {
    return 12;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  _render() {
    if (!this._config) return;
    const lang = langOf(this._hass);
    const t = translator(lang);
    const name = this._config.name || t("title");
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <ha-card>
        <div class="header">
          <div class="logo"><ha-icon icon="${esc(this._config.icon)}"></ha-icon></div>
          <div class="titles"><div class="name">${esc(name)}</div><div class="sub">${esc(t("subtitle"))}</div></div>
        </div>
        <div class="note">${esc(t("scaffold"))}</div>
      </ha-card>`;
  }
}

export class EnergyOverviewMiniCard extends EnergyOverviewCard {
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
