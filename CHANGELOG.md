# Changelog

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
