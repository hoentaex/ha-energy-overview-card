# Changelog

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
