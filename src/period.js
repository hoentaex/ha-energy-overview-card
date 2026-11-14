// Period logic: day / week / month in the Home Assistant server's time zone (`tz`, see tz.js), with the slots
// (buckets) the charts and statistics use. A day is split into real hours, so it has 23 or 25 slots on the
// days the clocks change.
import { dayStart, parts, zoned } from "./tz.js";

export const PERIODS = ["day", "week", "month"];
const HOUR = 3600e3;

/**
 * The period of `kind` that contains `anchor`.
 * weekMode "calendar": Monday to Sunday; "rolling": the seven days ending with the anchor day.
 * Returns { kind, tz, start, end (exclusive), statPeriod: "hour" | "day", slots: [{ start, end }] }.
 */
export function periodRange(kind, anchor, { weekMode = "calendar", tz } = {}) {
  const a = parts(anchor.getTime(), tz);
  const day = (n) => zoned(a.y, a.m, a.d + n, 0, tz);
  let start;
  let end;
  let first = 0;
  if (kind === "week") {
    first = weekMode === "rolling" ? -6 : -((a.wd + 6) % 7);
    start = day(first);
    end = day(first + 7);
  } else if (kind === "month") {
    start = zoned(a.y, a.m, 1, 0, tz);
    end = zoned(a.y, a.m + 1, 1, 0, tz);
  } else {
    kind = "day";
    start = day(0);
    end = day(1);
  }
  const slots = [];
  if (kind === "day") {
    for (let t = start.getTime(); t < end.getTime(); t += HOUR)
      slots.push({ start: new Date(t), end: new Date(t + HOUR) });
  } else {
    const s = parts(start.getTime(), tz);
    for (let i = 0; ; i++) {
      const from = zoned(s.y, s.m, s.d + i, 0, tz);
      if (from >= end) break;
      slots.push({ start: from, end: zoned(s.y, s.m, s.d + i + 1, 0, tz) });
    }
  }
  return { kind, tz, start, end, statPeriod: kind === "day" ? "hour" : "day", slots };
}

/** Anchor of the neighbouring period (dir = -1 / +1). Month steps go to the 1st, so no day overflow. */
export function shiftAnchor(kind, anchor, dir, tz) {
  const a = parts(anchor.getTime(), tz);
  if (kind === "month") return zoned(a.y, a.m + dir, 1, 12, tz);
  return zoned(a.y, a.m, a.d + dir * (kind === "week" ? 7 : 1), 12, tz);
}

/** True when the period contains `now`. */
export const isCurrent = (range, now = new Date()) => range.start <= now && now < range.end;

/** True when the next period has already begun (no paging into the future). */
export const canGoForward = (kind, anchor, { weekMode, tz, now = new Date() } = {}) =>
  periodRange(kind, shiftAnchor(kind, anchor, 1, tz), { weekMode, tz }).start <= now;

/** Label for the period switcher, e.g. "Sa., 14. Nov.", "9.–15. Nov.", "November 2026". */
export function periodLabel(range, lang) {
  const loc = lang === "de" ? "de-DE" : "en-GB";
  const fmt = (date, opts) => date.toLocaleDateString(loc, { timeZone: range.tz, ...opts });
  if (range.kind === "month") return fmt(range.start, { month: "long", year: "numeric" });
  if (range.kind === "day") return fmt(range.start, { weekday: "short", day: "numeric", month: "short" });
  const last = dayStart(range.end, range.tz, -1);
  const sameMonth = parts(range.start.getTime(), range.tz).m === parts(last.getTime(), range.tz).m;
  const first = sameMonth
    ? fmt(range.start, { day: "numeric" }) + (lang === "de" ? "." : "")
    : fmt(range.start, { day: "numeric", month: "short" });
  return `${first}–${fmt(last, { day: "numeric", month: "short" })}`;
}
