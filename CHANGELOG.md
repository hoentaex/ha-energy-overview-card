# Changelog

## 0.5.1 (2026-11-19)

- Illustrated header: the status pill always sits on the second line, under the title and above the subtitle. It used to
  follow the title and move to a line of its own when they did not fit together, so with a long title it jumped
  between the two places as the status text changed. A long title or status now ends in an ellipsis; only a very narrow
  card shows the dot alone.

## 0.5.0 (2026-11-19)

- House scene: two houses to choose from with `house_model`: `balcony`, the house with balconies (default, as in
  0.4.1–0.4.4), or `classic`, the compact family house of the earlier versions, back with its own lines and chips, day
  and night. In the visual editor next to the weather entity. The card grows to about 780 KB.

## 0.4.4 (2026-11-18)

- The card keeps its height while another period (day, week, month, back, forward, now) loads. Its sections were empty
  for a moment, the card shrank to about half and the dashboard scrolled up.
- `house_info_entity`: a sensor that a click on the consumption opens, while the consumption itself stays calculated
  (for a meter that also counts the battery charging from the grid). In the visual editor too.

## 0.4.3 (2026-11-18)

- Values open Home Assistant's own dialog of their entity (history, settings): the live values in the flow and the
  house scene, each value over the power chart (consumption, PV, battery %, grid import, export), the footer tiles
  (grid import, export, battery charged, from their statistics) and PV / forecast under them. A value without an
  entity (for example consumption when it is computed) stays plain text.
- A click on a line chip of the power chart or on a history view no longer rebuilds the whole card, only that section:
  the page keeps its scroll position (it could jump up), and the house image and the sky are never reloaded.
- House scene: the line from the meter box into the house glows again like the others. It is a straight line in the new
  house, and the glow filters measured their area from the line's own box, which has no height, so only the thin core
  and the arrows were left. The filters now cover the whole scene; the line also reaches further into the balcony.

## 0.4.2 (2026-11-18)

- Illustrated header: the ground strip is orange while the grid supplies the home, the card's own import colour (it was
  blue), so it matches the status pill and the grid lines.

## 0.4.1 (2026-11-18)

- House scene (`flow_style: house`): a new house, a white two-storey house with two balconies, PV on the roof, the meter
  box and the battery on its side wall and the grid pole beside it, in a day and a night render. The lines run from the
  roof modules, the pole, the battery and the lower balcony to the meter box; the night render has its own positions.

## 0.4.0 (2026-11-18)

- **Illustrated header** on the main card, the mini card and the dialog, in the style of juju35's cards: a 90 px banner
  with the title, the status pill and the subtitle on the sky, a picture at the right and a 10 px ground strip in the
  state colour (yellow solar, blue grid import, green battery, grey when nothing flows).
- Three pictures to choose from with `illustration_scene`: `sun` (default; the day arc from sunrise to sunset with the
  sun at its real position, PV power now and today's yield against the forecast, moon and dashed arc at night),
  `balcony` (two panels on a balcony railing, power running to the Solarbank while the panels produce, five LEDs for
  the battery level) and `curve` (today's PV production from the hourly statistics as a landscape, the forecast dashed,
  the sun on the curve now).
- Night picture with Home Assistant's dark theme; `illustration_theme: day | night` forces it, `illustration: false`
  keeps the classic header. All three options in the visual editor of the main and the mini card.
- The status pill follows the title when it fits, else goes under the subtitle (its dot alone when there is no room).
- Mini card: the banner with a frosted open button, battery, PV, grid and today's self-sufficiency under it.

## 0.3.0 (2026-11-15)

- **Balance card** `custom:energy-overview-balance-card`: today's home consumption as a ring split by grid, battery
  and solar, grid on the left, own energy on the right, each with the power right now. A light runs along the wire
  while power flows (towards the ring, away from it in blue while exporting), the ring sweeps in once and the house
  icon breathes; values change in place without restarting the animation. Click or Enter opens the main card
- House scene: the active lines shine more, like neon tubes – a wider and stronger glow, a thicker coloured line with
  a bright core, a longer light pulse with its own halo and arrows with a bright edge

## 0.2.1 (2026-11-15)

- Ring: the icons of solar, battery and grid sit in the middle of their circles again (the rule for the ring graphic
  also caught the icons and pinned them to the top left)

## 0.2.0 (2026-11-15)

- **Flow styles** (`flow_style`), the ellipse stays the default:
  - `house`: a 3D house on a weather sky. All lines run through the meter box, horizontal and vertical with round
    corners, glowing in the colour of their flow with a moving light pulse and arrows in the flow direction; the line
    into the home takes the colour of the source that feeds it most. The battery symbol pulses blue while charging and
    green while discharging, its bars show the state of charge. From dusk the house has lit windows
  - `sankey`: energy bands from the sources (solar, battery, grid) to the consumers (home, battery, export), the band
    width by power
  - `ring`: home consumption as a ring split by source, the state of charge inside, the share of own energy and the
    split as tiles
- **Weather sky** for the house scene and, with `flow_background: weather`, for bands and ring: clear, cloudy, rain,
  snow and fog by day and by night plus two sunsets, picked from `weather_entity` and the sun's elevation (`sun.sun`);
  light rain, snow and twinkling stars, still with reduced motion. Sky and house stay in place across live updates
- Visual editor: flow style, background and weather entity; new cards pick up a weather entity
- Images (house render and skies from the Solarhaus image package, two sunsets generated to match) are embedded in the
  JS file, which grows to about 520 KB
- Demo: flow style, weather and sky switches; screenshots of the flow styles

## 0.1.2 (2026-11-15)

- Grid charging the battery is drawn in blue (flow, battery history, legend) with its own variable
  `--eoc-grid-charge-color`; battery → home stays green
- README: a home consumption sensor that counts battery charging from the grid breaks the balance – leave
  `house_power_entity` / `consumption_stat` out then; example config updated
- Test: the live flow adds up (grid + PV = home + battery) when the home comes from the balance

## 0.1.1 (2026-11-15)

- Look aligned with the Proxmox and Tibber cards: round 40 px logo in the status colour with an MDI icon, status
  as a chip, uppercase section titles with icons, panels on the theme's secondary background without a border,
  round close button; mini card with a 56 px ring, the name kept whole and the status shortened instead

## 0.1.0 (2026-11-15)

First release.

- **Main card** `custom:energy-overview-card` with seven sections (order and choice through `sections`):
  - header with a status pill (grid / PV surplus / PV / battery / export, by the dominant source)
  - live energy flow: four nodes on one ellipse, arcs broken at each node, active flows animated in their
    direction (speed by power, `prefers-reduced-motion` respected), state of charge with kWh
  - period switcher day / week / month with paging back without limit and "Now"; week Monday–Sunday or the last
    seven days (`week_mode`)
  - power chart of the day (grid import, export, PV, consumption, state of charge) with a crosshair, a fixed
    two-line readout and toggle chips; 5- or 15-minute grid (`power_resolution`)
  - balance: consumption from solar / battery / grid, production to home / battery / export, self-sufficiency,
    self-consumption, CO₂ saved (`co2_factor`)
  - history with consumption (night blocks in the day view), solar (today's forecast) and battery (charge up from
    PV / grid, discharge down, state-of-charge line above the zero line)
  - footer: grid import, export, battery charged; PV actual / forecast today
- **Mini card** `custom:energy-overview-mini-card`: one row with state-of-charge ring, status, PV, grid and today's
  self-sufficiency; opens the main card as a dialog, or expands it with `popup: false`
- **Data:** sources from the Energy dashboard (`energy/get_prefs`), each overridable (`*_stat`, live `*_entity`);
  long-term statistics per hour / day, the day's history (5-minute / hourly statistics for older days) and the
  solar forecast, cached (past periods once, the current one every 5 minutes); days follow the server's time zone,
  23 / 25 hours on the days the clocks change
- **Visual editor** for both cards; new cards take the power sensors from the Energy dashboard and find the state
  of charge sensor and today's forecast
- German and English (`language`), light and dark themes, accent colours as `--eoc-*` CSS variables
