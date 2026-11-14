// Runs with TZ=Europe/Berlin (see package.json).
import assert from "node:assert/strict";
import { test } from "node:test";
import { canGoForward, isCurrent, periodLabel, periodRange, shiftAnchor } from "../src/period.js";

const d = (s) => new Date(s);

test("a day has 24 hourly slots, 23 / 25 on the days the clocks change", () => {
  const normal = periodRange("day", d("2026-11-14T15:00"));
  assert.equal(normal.slots.length, 24);
  assert.equal(normal.statPeriod, "hour");
  assert.equal(normal.start.getTime(), d("2026-11-14T00:00").getTime());
  assert.equal(normal.end.getTime(), d("2026-11-15T00:00").getTime());
  assert.equal(periodRange("day", d("2026-03-29T12:00")).slots.length, 23);
  const autumn = periodRange("day", d("2026-10-25T12:00"));
  assert.equal(autumn.slots.length, 25);
  assert.equal(autumn.slots.at(-1).end.getTime(), autumn.end.getTime());
});

test("calendar week runs Monday to Sunday", () => {
  const w = periodRange("week", d("2026-11-14T10:00")); // Saturday
  assert.equal(w.start.getTime(), d("2026-11-09T00:00").getTime());
  assert.equal(w.end.getTime(), d("2026-11-16T00:00").getTime());
  assert.equal(w.slots.length, 7);
  assert.equal(w.statPeriod, "day");
  const sunday = periodRange("week", d("2026-11-15T23:30"));
  assert.equal(sunday.start.getTime(), d("2026-11-09T00:00").getTime());
});

test("rolling week ends with the anchor day", () => {
  const w = periodRange("week", d("2026-11-14T10:00"), "rolling");
  assert.equal(w.start.getTime(), d("2026-11-08T00:00").getTime());
  assert.equal(w.end.getTime(), d("2026-11-15T00:00").getTime());
});

test("a week across the clock change still has 7 day slots", () => {
  const w = periodRange("week", d("2026-10-25T12:00"));
  assert.equal(w.slots.length, 7);
  assert.equal(w.slots[6].start.getDate(), 25);
});

test("month is the calendar month", () => {
  assert.equal(periodRange("month", d("2028-02-10")).slots.length, 29);
  assert.equal(periodRange("month", d("2026-11-14")).slots.length, 30);
});

test("paging: month steps from the 31st do not overflow, no paging into the future", () => {
  assert.equal(shiftAnchor("month", d("2026-01-31T12:00"), 1).getMonth(), 1);
  assert.equal(shiftAnchor("week", d("2026-11-14T12:00"), -1).getDate(), 7);
  const now = d("2026-11-14T13:00");
  assert.equal(canGoForward("day", now, "calendar", now), false);
  assert.equal(canGoForward("day", d("2026-11-13T09:00"), "calendar", now), true);
  assert.equal(canGoForward("week", d("2026-11-14T09:00"), "calendar", now), false);
  assert.equal(canGoForward("month", d("2026-10-31T09:00"), "calendar", now), true);
  assert.ok(isCurrent(periodRange("month", now), now));
  assert.ok(!isCurrent(periodRange("day", d("2026-11-13")), now));
});

test("labels", () => {
  assert.equal(periodLabel(periodRange("month", d("2026-11-14")), "de"), "November 2026");
  assert.equal(periodLabel(periodRange("week", d("2026-11-14")), "de"), "9.–15. Nov.");
  assert.equal(periodLabel(periodRange("week", d("2026-11-01")), "de"), "26. Okt.–1. Nov.");
  assert.match(periodLabel(periodRange("day", d("2026-11-14")), "de"), /14\. Nov/);
});
