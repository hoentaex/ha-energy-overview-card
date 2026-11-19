// Images of the house scene and the weather skies, bundled as data URLs (HACS installs one JS file only).
// House renders (balcony house and the classic family house) and skies: Solarhaus image package; the two sunset skies were generated to match it.
import houseDay from "../assets/flow/house-day.webp";
import houseNight from "../assets/flow/house-night.webp";
import classicDay from "../assets/flow/house-classic-day.webp";
import classicNight from "../assets/flow/house-classic-night.webp";
import dayClear from "../assets/flow/sky-day-clear.webp";
import dayCloudy from "../assets/flow/sky-day-cloudy.webp";
import dayFog from "../assets/flow/sky-day-fog.webp";
import dayRainy from "../assets/flow/sky-day-rainy.webp";
import daySnowy from "../assets/flow/sky-day-snowy.webp";
import duskClear from "../assets/flow/sky-dusk-clear.webp";
import duskCloudy from "../assets/flow/sky-dusk-cloudy.webp";
import nightClear from "../assets/flow/sky-night-clear.webp";
import nightCloudy from "../assets/flow/sky-night-cloudy.webp";
import nightFog from "../assets/flow/sky-night-fog.webp";
import nightRainy from "../assets/flow/sky-night-rainy.webp";
import nightSnowy from "../assets/flow/sky-night-snowy.webp";
import { setFlowAssets } from "./flowstyles.js";

setFlowAssets({
  house: { balcony: { day: houseDay, night: houseNight }, classic: { day: classicDay, night: classicNight } },
  sky: {
    "day-clear": dayClear,
    "day-cloudy": dayCloudy,
    "day-fog": dayFog,
    "day-rainy": dayRainy,
    "day-snowy": daySnowy,
    "dusk-clear": duskClear,
    "dusk-cloudy": duskCloudy,
    "night-clear": nightClear,
    "night-cloudy": nightCloudy,
    "night-fog": nightFog,
    "night-rainy": nightRainy,
    "night-snowy": nightSnowy,
  },
});
