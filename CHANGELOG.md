# Changelog

## 0.1.0 (unreleased)

- Scaffold: `energy-overview-card` and `energy-overview-mini-card` register themselves (card picker), build,
  lint, tests, demo page, CI and release workflow
- Data layer: day / week (Monday–Sunday, or rolling with `week_mode: rolling`) / month with 23 / 25 hours on the
  days the clocks change; sources from the Energy dashboard (`energy/get_prefs`, flat and `flow_from` formats),
  each overridable with `<key>_stat`; split per slot (PV → house / battery / grid, house ← PV / battery / grid),
  self-sufficiency, self-consumption, CO₂; statistics, power history (fallback to 5-minute / hourly statistics)
  and solar forecast with a cache; sunrise / sunset and night blocks; live values and status
