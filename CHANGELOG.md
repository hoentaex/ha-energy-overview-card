# Changelog

## 0.1.0 (unreleased)

- Scaffold: `energy-overview-card` and `energy-overview-mini-card` register themselves (card picker), build,
  lint, tests, demo page, CI and release workflow
- Data layer: day / week (Monday–Sunday, or rolling with `week_mode: rolling`) / month with 23 / 25 hours on the
  days the clocks change; sources from the Energy dashboard (`energy/get_prefs`, flat and `flow_from` formats),
  each overridable with `<key>_stat`; split per slot (PV → house / battery / grid, house ← PV / battery / grid),
  self-sufficiency, self-consumption, CO₂; statistics, power history (fallback to 5-minute / hourly statistics)
  and solar forecast with a cache; sunrise / sunset and night blocks; live values and status
- Days, weeks and months follow the Home Assistant server's time zone (`time_zone` of the core config), not the
  browser's
- Main card: header with status pill; live energy flow (ring of arcs through four nodes, animated by power,
  `prefers-reduced-motion`); period switcher (day / week / month, paging, "Now"); power chart of the day with
  scrubbing and toggle chips (`power_resolution` 5 / 15 min); balance with consumption / production bars and
  rings; history with consumption / solar / battery views, night blocks, today's forecast and the battery
  view diverging around a zero line with the state-of-charge line; footer tiles and PV actual / forecast
- Demo page with a simulated installation, screenshots of all periods and history views in light and dark
- Mini card: state-of-charge ring, name, status, PV and grid now, today's self-sufficiency; the button opens the
  main card as a dialog (`popup: true`, default; Escape, backdrop and close button close it, focus returns) or
  expands it below the row (`popup: false`)
- Status pill follows the dominant source (battery 380 W with 30 W from the grid reads "battery supplies home")
- Keyboard focus stays on the control across re-renders
