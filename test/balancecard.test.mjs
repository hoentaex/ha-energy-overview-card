import assert from "node:assert/strict";
import { test } from "node:test";
import { arcPath, balanceLive, renderBalance, ringSegments } from "../src/balancecard.js";
import { translator } from "../src/shared.js";

const opts = { t: translator("de"), lang: "de", threshold: 10 };
const today = {
  consumption: 7.63,
  house_from_grid: 5.84,
  house_from_battery: 0.6,
  house_from_solar: 1.19,
  autarky: 0.235,
};

test("ring: segments in source order, sized by share, zero shares left out", () => {
  const segs = ringSegments({ grid: 3, battery: 0, solar: 1 });
  assert.deepEqual(
    segs.map((s) => s.key),
    ["grid", "solar"],
  );
  // 3 : 1 of the 270° arc, shortened by the round caps and half a gap where segments meet.
  const arc = 0.75 * 2 * Math.PI * 48;
  assert.ok(Math.abs(segs[0].len - (arc * 0.75 - 12)) < 0.01);
  assert.equal(segs[0].from, 5);
  // The last segment ends where the track ends: 5 px (the round cap) before the end of the arc.
  assert.ok(Math.abs(segs[1].from + segs[1].len - (arc - 5)) < 0.01);
  assert.deepEqual(ringSegments({ grid: 0, battery: 0, solar: 0 }), []);
});

test("arc path: bottom left start, large-arc flag past half the circle", () => {
  assert.equal(arcPath(0, 10), "M26.06 93.94 A48 48 0 0 1 19.77 86.19");
  assert.match(arcPath(0, 200), / 0 1 1 /);
});

test("live wires: import in, export out, own energy by its main source", () => {
  const night = balanceLive({ solar: 0, grid_import: 500, battery_charge: 381, battery_discharge: 0 }, 10);
  // 381 W of the import charge the battery, only 119 W reach the home.
  assert.equal(night.left.dir, "in");
  assert.equal(night.left.w, 119);
  assert.equal(night.right, null);
  const noon = balanceLive({ solar: 2000, grid_export: 900, battery_charge: 300, battery_discharge: 0 }, 10);
  assert.equal(noon.left.dir, "out");
  assert.equal(noon.left.color, "var(--eoc-exp)");
  assert.equal(noon.right.color, "var(--eoc-pv)");
  assert.equal(noon.right.w, 800);
  const evening = balanceLive({ solar: 40, battery_discharge: 300 }, 10);
  assert.equal(evening.right.color, "var(--eoc-bat)");
});

test("balance card: values, labels and the shape key", () => {
  const out = renderBalance(today, { solar: 0, grid_import: 300 }, opts);
  assert.match(out.html, /5,84 kWh/);
  assert.match(out.html, /7,63 kWh/);
  assert.match(out.html, /1,79 kWh/);
  assert.match(out.html, /Eigenstrom/);
  assert.match(out.html, /Autarkie 24 %/);
  assert.match(out.html, /class="wire on in l"/);
  assert.match(out.label, /Haus heute 7,63 kWh/);
  // Only values changed → same shape, the card patches in place.
  assert.equal(renderBalance({ ...today, consumption: 8 }, { grid_import: 900 }, opts).shape, out.shape);
  assert.notEqual(renderBalance(today, { grid_export: 900 }, opts).shape, out.shape);
  const loading = renderBalance(null, {}, opts);
  assert.match(loading.html, /data-p="home">–</);
  assert.doesNotMatch(loading.html, /class="seg"/);
  assert.doesNotMatch(renderBalance(today, { grid_import: 300 }, { ...opts, animations: false }).html, /wire on/);
});
