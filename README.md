# Energy Overview Card

[![Marketplace](https://img.shields.io/badge/Marketplace-Custom-41BDF5.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=hoentaex&repository=ha-energy-overview-card&category=plugin)
[![Release](https://img.shields.io/github/v/release/hoentaex/ha-energy-overview-card)](https://github.com/hoentaex/ha-energy-overview-card/releases/latest)
[![Validate](https://github.com/hoentaex/ha-energy-overview-card/actions/workflows/validate.yml/badge.svg)](https://github.com/hoentaex/ha-energy-overview-card/actions/workflows/validate.yml)
[![HACS Validation](https://github.com/hoentaex/ha-energy-overview-card/actions/workflows/hacs.yml/badge.svg)](https://github.com/hoentaex/ha-energy-overview-card/actions/workflows/hacs.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**[Deutsch](#deutsch) · [English](#english)**

> [!NOTE]
> In Entwicklung – Screenshots, Optionen und der erste Release `v0.1.0` folgen.
> Work in progress – screenshots, options and the first release `v0.1.0` will follow.

---

## Deutsch

Lovelace-Karte für eine **PV-Anlage mit Heimspeicher**: Live-Energiefluss, Bilanz und Verlauf
(Tag / Woche / Monat) in **einer** Karte.

Auf einen Blick: Woher kommt gerade Strom, wohin geht er, wie voll ist der Akku – und für einen wählbaren Zeitraum:
wie viel wurde verbraucht und erzeugt, woher kam der Verbrauch, wohin ging die Erzeugung, wie autark war das Haus.

Aufbau und Look orientieren sich an den Karten von [juju35](https://github.com/juju35). Schwesterprojekt:
[Tibber Battery Card](https://github.com/hoentaex/ha-tibber-battery-card).

> [!WARNING]
> **Privates Hobbyprojekt.** Die Karte ist für meine eigene Installation entstanden und wird in der Freizeit gepflegt.
> Es gibt keine Gewährleistung und keinen Support: **Die Nutzung erfolgt auf eigene Gefahr.**
> Die Karte liest nur Zustände und Statistiken aus Home Assistant – sie schaltet nichts.

### Was die Karte macht – und was nicht

- **Zeigt an:** Live-Energiefluss zwischen Solar, Netz, Haus und Akku; Bilanz, Autarkie, Eigenverbrauch und
  CO₂-Ersparnis für Tag / Woche / Monat; Leistungsdiagramm des Tages; Verlauf von Verbrauch, Solar und Akku.
- **Datenquellen:** die Live-Entities und die Langzeit-Statistik von Home Assistant – standardmäßig die Quellen aus dem
  **Energie-Dashboard**, jede einzeln überschreibbar.
- **Nicht enthalten:** Steuerlogik, Kosten und Tarife (dafür gibt es die Tibber Battery Card).

### Was du brauchst

| Baustein | Wofür | Pflicht? |
|---|---|---|
| Home Assistant 2024.8 oder neuer | | ja |
| Eingerichtetes **Energie-Dashboard** (Netz, Solar, Akku) **oder** eigene Statistik-Sensoren | Bilanz, Verlauf | ja |
| Leistungssensoren in W: PV, Netz, Akku, Hausverbrauch | Live-Fluss, Status, Leistungsdiagramm | empfohlen |
| Ladestand-Sensor in % und Akkukapazität | Akku-Knoten, SoC-Linie | empfohlen |
| Solar-Prognose im Energie-Dashboard (z. B. Forecast.Solar) | Prognose heute | optional |

### Installation

Über HACS als **benutzerdefiniertes Repository** (Kategorie *Dashboard*):
`https://github.com/hoentaex/ha-energy-overview-card` – danach die Karte im Dashboard über
**Karte hinzufügen → Energy Overview Card** einfügen.

---

## English

Lovelace card for a **PV system with a home battery**: live energy flow, balance and history
(day / week / month) in **one** card.

At a glance: where power comes from right now, where it goes, how full the battery is – and for a selectable period:
how much was consumed and produced, where consumption came from, where production went, how self-sufficient the
house was.

> [!WARNING]
> **This is a private hobby project**, built for my own installation and maintained in spare time. It comes without
> any warranty or support: **use it at your own risk.** The card only reads states and statistics from Home Assistant –
> it does not switch anything.

**Data sources:** live entities and Home Assistant's long-term statistics – by default the sources of the
**Energy dashboard**, each one can be overridden. **Not included:** control logic, costs and tariffs.

**Installation:** add `https://github.com/hoentaex/ha-energy-overview-card` to HACS as a **custom repository**
(category *Dashboard*), then add **Energy Overview Card** from the card picker.

## Development

```bash
npm install
npm run check        # lint + build + syntax check
npm test             # unit tests (node:test)
npm run demo         # http://127.0.0.1:8769/demo/ with a fake hass
npm run screenshots  # README screenshots (Playwright)
```

## License

[MIT](LICENSE)
