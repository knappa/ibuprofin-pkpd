import { test } from "node:test";
import assert from "node:assert/strict";

import {
  celsiusToFahrenheit,
  decodeScenario,
  defaultEndTimeHours,
  defaultScenario,
  encodeScenario,
  fahrenheitToCelsius,
  regimenDoses,
  suggestedWeightKg,
} from "../src/scenario.js";
import { SEVERITY, doseWarnings, extrapolationNotes, inputErrors, maxDailyTotals } from "../src/warnings.js";

const tablets = (amountMg, intervalHours, doseCount) =>
  regimenDoses({ amountMg, intervalHours, doseCount, formulation: "tablet", fed: false });
const adult = { ageYears: 30, weightKg: 70, sex: "unspecified" };
const child = { ageYears: 5, weightKg: 18, sex: "unspecified" };

test("temperature conversions round-trip", () => {
  assert.equal(celsiusToFahrenheit(37), 98.6);
  assert.ok(Math.abs(fahrenheitToCelsius(celsiusToFahrenheit(38.8)) - 38.8) < 1e-12);
});

test("scenarios survive URL encoding", () => {
  const scenario = {
    patient: { ageYears: 6.5, weightKg: 21.3, sex: "female" },
    baselineTemperatureC: 39.4,
    doses: [
      { timeHours: 0, amountMg: 213, formulation: "suspension", fed: false },
      { timeHours: 6.5, amountMg: 200, formulation: "sachet", fed: true },
    ],
    endTimeHours: 36,
  };
  const encoded = encodeScenario(scenario);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeScenario(encoded), scenario);
  assert.deepEqual(decodeScenario(encodeScenario(defaultScenario())), defaultScenario());
});

test("malformed encoded scenarios are rejected", () => {
  assert.equal(decodeScenario(""), null);
  assert.equal(decodeScenario("not-base64!"), null);
  assert.equal(decodeScenario(btoa(JSON.stringify({ v: 1, a: "x", w: 1, t: 38, d: [] }))), null);
  assert.equal(decodeScenario(btoa(JSON.stringify({ v: 1, a: 5, w: 20, t: 38, d: [[0, 100, 99, 0]] }))), null);
});

test("simulation length defaults to 12 h past the last dose, at least 24 h", () => {
  assert.equal(defaultEndTimeHours([]), 24);
  assert.equal(defaultEndTimeHours(tablets(400, 6, 3)), 24);
  assert.equal(defaultEndTimeHours(tablets(400, 6, 5)), 36);
});

test("suggested weight uses growth charts for children and 70 kg for adults", () => {
  assert.ok(suggestedWeightKg(5) > 15 && suggestedWeightKg(5) < 22);
  assert.equal(suggestedWeightKg(40), 70);
});

test("24 h totals use the busiest 24 h window", () => {
  assert.deepEqual(maxDailyTotals(tablets(400, 6, 3)), { maxAmountMg: 1200, maxCount: 3 });
  assert.deepEqual(maxDailyTotals(tablets(400, 6, 6)), { maxAmountMg: 1600, maxCount: 4 });
  assert.deepEqual(maxDailyTotals([]), { maxAmountMg: 0, maxCount: 0 });
});

test("infants under 6 months and invalid inputs block simulation", () => {
  assert.equal(inputErrors({ patient: { ...child, ageYears: 0.4 }, doses: [] }).length, 1);
  assert.equal(inputErrors({ patient: { ...child, ageYears: 0.5 }, doses: [] }).length, 0);
  assert.equal(inputErrors({ patient: { ...adult, weightKg: 0 }, doses: [] }).length, 1);
  assert.equal(inputErrors({ patient: adult, doses: [{ timeHours: -1, amountMg: 200 }] }).length, 1);
});

test("adult warnings follow the OTC and prescription daily limits", () => {
  const texts = (doses) => doseWarnings({ patient: adult, doses }).map((warning) => warning.text);
  assert.deepEqual(texts(tablets(400, 6, 3)), []);
  assert.match(texts(tablets(400, 6, 4))[0], /OTC maximum of 1200/);
  assert.match(texts(tablets(800, 4, 6))[0], /prescription maximum of 3200/);
  assert.deepEqual(texts(tablets(800, 6, 5)).filter((text) => /prescription maximum/.test(text)), []);
  assert.ok(texts(tablets(1000, 12, 1)).some((text) => /above 800 mg/.test(text)));
});

test("pediatric warnings use mg/kg limits and dose counts", () => {
  const warnings = (doses) => doseWarnings({ patient: child, doses });
  const perKgDose = (mgPerKg, count, intervalHours = 6) =>
    regimenDoses({ amountMg: mgPerKg * child.weightKg, intervalHours, doseCount: count, formulation: "suspension", fed: false });
  assert.deepEqual(warnings(perKgDose(10, 4)), []);
  assert.deepEqual(warnings(perKgDose(10, 8)), []);
  const tooMany = warnings(perKgDose(10, 5, 4)).map((warning) => warning.text);
  assert.ok(tooMany.some((text) => /pediatric maximum of 720 mg/.test(text)));
  assert.ok(tooMany.some((text) => /at most 4/.test(text)));
  assert.ok(warnings(perKgDose(12, 1)).some((warning) => warning.severity === SEVERITY.note && /10 mg\/kg/.test(warning.text)));
});

test("extrapolation labels follow the source populations", () => {
  const adultNotes = extrapolationNotes({ patient: adult });
  assert.equal(adultNotes.concentration, null);
  assert.equal(adultNotes.cox, null);
  assert.equal(adultNotes.analgesia, null);
  assert.match(adultNotes.antipyresis, /children 4-16 y/);

  const schoolChild = extrapolationNotes({ patient: { ageYears: 10, weightKg: 32 } });
  assert.equal(schoolChild.antipyresis, null);
  assert.equal(schoolChild.analgesia, null);
  assert.ok(schoolChild.cox);
  assert.ok(schoolChild.concentration);

  const toddler = extrapolationNotes({ patient: { ageYears: 1, weightKg: 10 } });
  assert.ok(toddler.analgesia);
  assert.ok(toddler.antipyresis);
});
