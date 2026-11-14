// Period logic: day / week / month in local time, with the slots (buckets) the charts and statistics use.
// A day is split into real hours, so it has 23 or 25 slots on the days the clocks change.

export const PERIODS = ["day", "week", "month"];
const HOUR = 3600e3;

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * The period of `kind` that contains `anchor`.
 * week_mode "calendar": Monday to Sunday; "rolling": the seven days ending with the anchor day.
 * Returns { kind, start, end (exclusive), statPeriod: "hour" | "day", slots: [{ start, end }] }.
 */
export function periodRange(kind, anchor, weekMode = "calendar") {
  const a = dayStart(anchor);
  let start;
  let end;
  if (kind === "week") {
    start = weekMode === "rolling" ? addDays(a, -6) : addDays(a, -((a.getDay() + 6) % 7));
    end = addDays(start, 7);
  } else if (kind === "month") {
    start = new Date(a.getFullYear(), a.getMonth(), 1);
    end = new Date(a.getFullYear(), a.getMonth() + 1, 1);
  } else {
    kind = "day";
    start = a;
    end = addDays(a, 1);
  }
  const slots = [];
  if (kind === "day") {
    for (let t = start.getTime(); t < end.getTime(); t += HOUR)
      slots.push({ start: new Date(t), end: new Date(t + HOUR) });
  } else {
    for (let d = start; d < end; d = addDays(d, 1)) slots.push({ start: d, end: addDays(d, 1) });
  }
  return { kind, start, end, statPeriod: kind === "day" ? "hour" : "day", slots };
}

/** Anchor date of the neighbouring period (dir = -1 / +1). Month steps keep to the 1st, so no day overflow. */
export function shiftAnchor(kind, anchor, dir) {
  if (kind === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
  return addDays(anchor, dir * (kind === "week" ? 7 : 1));
}

/** True when the period contains `now`. */
export const isCurrent = (range, now = new Date()) => range.start <= now && now < range.end;

/** True when the next period has already begun (no paging into the future). */
export const canGoForward = (kind, anchor, weekMode, now = new Date()) =>
  periodRange(kind, shiftAnchor(kind, anchor, 1), weekMode).start <= now;

/** Label for the period switcher, e.g. "Sa., 14. Nov.", "9.–15. Nov.", "November 2026". */
export function periodLabel(range, lang) {
  const loc = lang === "de" ? "de-DE" : "en-GB";
  if (range.kind === "month") return range.start.toLocaleDateString(loc, { month: "long", year: "numeric" });
  if (range.kind === "day")
    return range.start.toLocaleDateString(loc, { weekday: "short", day: "numeric", month: "short" });
  const last = addDays(range.end, -1);
  const first =
    range.start.getMonth() === last.getMonth()
      ? range.start.toLocaleDateString(loc, { day: "numeric" }) + (lang === "de" ? "." : "")
      : range.start.toLocaleDateString(loc, { day: "numeric", month: "short" });
  return `${first}–${last.toLocaleDateString(loc, { day: "numeric", month: "short" })}`;
}
