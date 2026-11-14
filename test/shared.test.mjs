import assert from "node:assert/strict";
import { test } from "node:test";
import { esc, fmtEnergy, fmtNum, fmtPower, langOf, translator } from "../src/shared.js";

test("fmtNum uses a decimal comma in German and a dash for missing values", () => {
  assert.equal(fmtNum(4.51, "de", 2), "4,51");
  assert.equal(fmtNum(4.51, "en", 2), "4.51");
  assert.equal(fmtNum("unavailable", "de"), "–");
  assert.equal(fmtNum(null, "de"), "–");
});

test("fmtPower switches to kW from 1000 W", () => {
  assert.equal(fmtPower(850, "de"), "850 W");
  assert.equal(fmtPower(1520, "de"), "1,52 kW");
  assert.equal(fmtPower(-1520, "en"), "-1.52 kW");
  assert.equal(fmtPower(undefined, "de"), "–");
});

test("fmtEnergy appends kWh", () => {
  assert.equal(fmtEnergy(6.11, "de"), "6,11 kWh");
  assert.equal(fmtEnergy(Number.NaN, "de"), "–");
});

test("langOf and translator fall back to English", () => {
  assert.equal(langOf({ locale: { language: "de-DE" } }), "de");
  assert.equal(langOf({ locale: { language: "fr" } }), "en");
  assert.equal(translator("de")("title"), "Energie");
  assert.equal(translator("en")("unknown_key"), "unknown_key");
});

test("esc escapes HTML", () => {
  assert.equal(esc(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
});
