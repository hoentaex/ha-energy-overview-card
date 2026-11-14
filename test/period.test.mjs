import assert from "node:assert/strict";
import { test } from "node:test";
import { canGoForward, isCurrent, periodLabel, periodRange, shiftAnchor } from "../src/period.js";
import { parts, tzOf, zoned } from "../src/tz.js";
import { berlin as d, TZ } from "./helpers.mjs";

const day = (s) => periodRange("day", d(s), { tz: TZ });
const same = (a, b) => assert.equal(a.getTime(), b.getTime());

test("tz helpers: server zone from hass, wall-clock parts, zoned instants", () => {
  assert.equal(tzOf({ config: { time_zone: "Europe/Berlin" } }), "Europe/Berlin");
  assert.equal(tzOf({ config: { time_zone: "Not/AZone" } }), undefined);
  assert.equal(tzOf({}), undefined);
  assert.equal(zoned(2026, 10, 14, 0, TZ).toISOString(), "2026-11-13T23:00:00.000Z");
  assert.equal(zoned(2026, 6, 1, 0, TZ).toISOString(), "2026-06-30T22:00:00.000Z");
  assert.equal(zoned(2026, 2, 29, 2, TZ).toISOString(), "2026-03-29T01:00:00.000Z"); // 02:00 skipped → 03:00
  const p = parts(Date.parse("2026-11-14T23:30:00Z"), TZ);
  assert.deepEqual([p.y, p.m, p.d, p.h, p.mi, p.wd], [2026, 10, 15, 0, 30, 0]);
});

test("a day has 24 hourly slots, 23 / 25 on the days the clocks change", () => {
  const normal = day("2026-11-14T15:00");
  assert.equal(normal.slots.length, 24);
  assert.equal(normal.statPeriod, "hour");
  assert.equal(normal.start.toISOString(), "2026-11-13T23:00:00.000Z");
  assert.equal(normal.end.toISOString(), "2026-11-14T23:00:00.000Z");
  assert.equal(day("2026-03-29T12:00").slots.length, 23);
  const autumn = day("2026-10-25T12:00");
  assert.equal(autumn.slots.length, 25);
  same(autumn.slots.at(-1).end, autumn.end);
});

test("the server's day, not the browser's: 23:30 Berlin is still the 14th although New York says otherwise", () => {
  const late = d("2026-11-14T23:30");
  same(periodRange("day", late, { tz: TZ }).start, d("2026-11-14"));
  // without a zone the machine's (New York) calendar day is used
  assert.equal(periodRange("day", late).start.toISOString(), "2026-11-14T05:00:00.000Z");
});

test("calendar week runs Monday to Sunday", () => {
  const w = periodRange("week", d("2026-11-14T10:00"), { tz: TZ }); // Saturday
  same(w.start, d("2026-11-09"));
  same(w.end, d("2026-11-16"));
  assert.equal(w.slots.length, 7);
  assert.equal(w.statPeriod, "day");
  same(periodRange("week", d("2026-11-15T23:30"), { tz: TZ }).start, d("2026-11-09"));
  same(periodRange("week", d("2026-11-16T00:30"), { tz: TZ }).start, d("2026-11-16"));
});

test("rolling week ends with the anchor day", () => {
  const w = periodRange("week", d("2026-11-14T10:00"), { weekMode: "rolling", tz: TZ });
  same(w.start, d("2026-11-08"));
  same(w.end, d("2026-11-15"));
});

test("a week across the clock change has 7 day slots on Berlin midnights", () => {
  const w = periodRange("week", d("2026-10-25T12:00"), { tz: TZ });
  assert.equal(w.slots.length, 7);
  same(w.slots[6].start, d("2026-10-25"));
  same(w.slots[6].end, d("2026-10-26"));
  assert.equal(w.slots[6].end - w.slots[6].start, 25 * 3600e3);
});

test("month is the calendar month", () => {
  assert.equal(periodRange("month", d("2028-02-10"), { tz: TZ }).slots.length, 29);
  const nov = periodRange("month", d("2026-11-14"), { tz: TZ });
  assert.equal(nov.slots.length, 30);
  same(nov.start, d("2026-11-01"));
  same(nov.end, d("2026-12-01"));
});

test("paging: month steps from the 31st do not overflow, no paging into the future", () => {
  assert.equal(parts(shiftAnchor("month", d("2026-01-31T12:00"), 1, TZ).getTime(), TZ).m, 1);
  assert.equal(parts(shiftAnchor("week", d("2026-11-14T12:00"), -1, TZ).getTime(), TZ).d, 7);
  assert.equal(parts(shiftAnchor("day", d("2026-10-25T12:00"), 1, TZ).getTime(), TZ).d, 26);
  const now = d("2026-11-14T13:00");
  const opts = { tz: TZ, now };
  assert.equal(canGoForward("day", now, opts), false);
  assert.equal(canGoForward("day", d("2026-11-13T09:00"), opts), true);
  assert.equal(canGoForward("week", d("2026-11-14T09:00"), opts), false);
  assert.equal(canGoForward("month", d("2026-10-31T09:00"), opts), true);
  assert.ok(isCurrent(periodRange("month", now, { tz: TZ }), now));
  assert.ok(!isCurrent(day("2026-11-13"), now));
});

test("labels in the server's zone", () => {
  assert.equal(periodLabel(periodRange("month", d("2026-11-14"), { tz: TZ }), "de"), "November 2026");
  assert.equal(periodLabel(periodRange("week", d("2026-11-14"), { tz: TZ }), "de"), "9.–15. Nov.");
  assert.equal(periodLabel(periodRange("week", d("2026-11-01"), { tz: TZ }), "de"), "26. Okt.–1. Nov.");
  assert.match(periodLabel(day("2026-11-14T00:30"), "de"), /14\. Nov/);
});
