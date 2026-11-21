// Values that open Home Assistant's own more-info dialog of their entity: the live powers (flow, chart readout), the
// period energies (footer) and the forecast. Each clickable element carries data-more="<entity id>".
import { resolveSources } from "./energy.js";
import { esc } from "./shared.js";

const isEntity = (id) => typeof id === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(id);

/**
 * Entity id behind each value of the card: live powers from the config with the Energy dashboard's `stat_rate`
 * entities as fallback, period energies from the `*_stat` options or the dashboard's sources (the first one that is
 * an entity; external statistics have no dialog).
 */
export function moreIds(config, live = {}, prefs = null) {
  // Several sensors of one kind (summed in the card): the dialog shows the first.
  const c = Object.fromEntries(
    Object.entries({ ...live, ...config }).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  );
  const split = !!(config.grid_import_power_entity || config.grid_export_power_entity);
  const src = resolveSources(config, prefs);
  const first = (k) => (src[k] || []).find(isEntity);
  const out = {
    solar: c.solar_power_entity,
    grid_import: split ? config.grid_import_power_entity : c.grid_power_entity,
    grid_export: split ? config.grid_export_power_entity : c.grid_power_entity,
    battery: c.battery_power_entity,
    soc: c.soc_entity,
    // A sensor only for the dialog: the home consumption stays calculated (a meter that also counts the battery
    // charging from the grid would break the balance), yet a click on it shows that sensor.
    house: c.house_power_entity || config.house_info_entity,
    forecast: config.forecast_today_entity,
    e_solar: first("solar"),
    e_grid_import: first("grid_import"),
    e_grid_export: first("grid_export"),
    e_battery_charge: first("battery_charge"),
    e_battery_discharge: first("battery_discharge"),
    e_consumption: first("consumption"),
  };
  for (const k of Object.keys(out)) if (!isEntity(out[k])) delete out[k];
  return out;
}

/** Attributes making an element open the dialog of `id` (nothing without an entity). */
export const moreAttrs = (id) => (isEntity(id) ? ` data-more="${esc(id)}" role="button" tabindex="0"` : "");

/** `html` wrapped in a span opening the dialog of `id`, or left as it is without an entity. */
export const moreSpan = (id, html) => (isEntity(id) ? `<span class="more"${moreAttrs(id)}>${html}</span>` : html);

/**
 * Opens the more-info dialog. The event goes to Home Assistant's root element when the card sits outside it (the
 * card's own dialog lives on document.body), else it bubbles up from the card.
 */
export function fireMore(from, id) {
  const ha = document.querySelector("home-assistant");
  const inside = ha && from.getRootNode && ha.contains(hostOf(from));
  (inside || !ha ? from : ha).dispatchEvent(
    new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }),
  );
}

// The outermost element of `el` across shadow roots.
function hostOf(el) {
  let n = el;
  for (;;) {
    const root = n.getRootNode?.();
    if (!root || root === document || !root.host) return n;
    n = root.host;
  }
}

/** Click and Enter / Space on a [data-more] element of `root` open its dialog from `card`. */
export function bindMore(root, card) {
  const open = (e) => {
    const el = e.target.closest?.("[data-more]");
    if (!el) return false;
    e.stopPropagation();
    fireMore(card, el.dataset.more);
    return true;
  };
  root.addEventListener("click", (e) => open(e));
  root.addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.closest?.("[data-more]")) {
      e.preventDefault();
      open(e);
    }
  });
}

export const MORE_STYLE = `
[data-more] { cursor: pointer; border-radius: 6px; }
.more[data-more] { text-decoration: underline dotted color-mix(in srgb, currentColor 45%, transparent); text-underline-offset: 3px; }
[data-more]:hover { background: color-mix(in srgb, var(--primary-text-color, #888) 8%, transparent); }
[data-more]:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
`;
