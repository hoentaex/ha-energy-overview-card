// Test helpers. The tests run in America/New_York (see package.json) while the "server" is in Europe/Berlin,
// so anything that silently used the machine's time zone would fail.
import { zoned } from "../src/tz.js";

export const TZ = "Europe/Berlin";

/** "2026-11-14T13:20" read as Berlin wall-clock time → Date. */
export const berlin = (s) => {
  const [, y, mo, d, h = "0", mi = "0"] = s.match(/^(\d+)-(\d+)-(\d+)(?:T(\d+):(\d+))?$/);
  return new Date(zoned(+y, +mo - 1, +d, +h, TZ).getTime() + +mi * 60e3);
};
