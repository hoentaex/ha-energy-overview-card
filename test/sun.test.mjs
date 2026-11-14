import assert from "node:assert/strict";
import { test } from "node:test";
import { periodRange } from "../src/period.js";
import { parts } from "../src/tz.js";
import { berlin, TZ } from "./helpers.mjs";
import { daySun, nightBlocks, sunTimes } from "../src/sun.js";

const near = (date, iso, minutes = 3) =>
  assert.ok(Math.abs(date.getTime() - new Date(iso).getTime()) <= minutes * 60e3, `${date.toISOString()} ≈ ${iso}`);

const BERLIN = [52.52, 13.405];

test("sunrise and sunset in Berlin at the solstices", () => {
  const winter = sunTimes(berlin("2026-12-21T12:00"), ...BERLIN, TZ);
  near(winter.rise, "2026-12-21T08:15+01:00");
  near(winter.set, "2026-12-21T15:54+01:00");
  const summer = sunTimes(berlin("2026-06-21T12:00"), ...BERLIN, TZ);
  near(summer.rise, "2026-06-21T04:43+02:00");
  near(summer.set, "2026-06-21T21:33+02:00");
});

test("the result belongs to the local calendar day, whatever the time of the input", () => {
  const a = sunTimes(berlin("2026-11-14T00:10"), ...BERLIN, TZ);
  const b = sunTimes(berlin("2026-11-14T23:50"), ...BERLIN, TZ);
  assert.equal(a.rise.getTime(), b.rise.getTime());
  assert.equal(parts(a.rise.getTime(), TZ).d, 14);
});

test("polar day and night", () => {
  assert.equal(sunTimes(berlin("2026-12-21T12:00"), 69.65, 18.96, TZ).polar, "night");
  assert.equal(sunTimes(berlin("2026-06-21T12:00"), 69.65, 18.96, TZ).polar, "day");
});

test("night blocks of a day, today from sun.sun", () => {
  const range = periodRange("day", berlin("2026-11-15T12:00"), { tz: TZ });
  const hass = {
    config: { latitude: BERLIN[0], longitude: BERLIN[1] },
    states: {
      "sun.sun": {
        state: "below_horizon",
        attributes: { next_rising: "2026-11-15T06:25:56+00:00", next_setting: "2026-11-15T15:35:51+00:00" },
      },
    },
  };
  const sun = daySun(hass, range);
  assert.equal(sun.rise.toISOString(), "2026-11-15T06:25:56.000Z");
  const blocks = nightBlocks(range, sun);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].start.getTime(), range.start.getTime());
  assert.equal(blocks[0].end.getTime(), sun.rise.getTime());
  assert.equal(blocks[1].end.getTime(), range.end.getTime());
  // another day: sun.sun does not apply, computed from the home location
  const other = daySun(hass, periodRange("day", berlin("2026-12-21T12:00"), { tz: TZ }));
  near(other.rise, "2026-12-21T08:15+01:00");
  assert.deepEqual(nightBlocks(range, { polar: "day" }), []);
  assert.equal(nightBlocks(range, { polar: "night" }).length, 1);
  assert.deepEqual(nightBlocks(range, daySun({}, range)), []);
});
