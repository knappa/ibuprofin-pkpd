import { test } from "node:test";
import assert from "node:assert/strict";

import { medianWeightKg } from "../src/growth.js";

test("median weights match the source tables at tabulated ages", () => {
  // WHO boys, 6 months: M = 7.934 kg; CDC girls, 24 months: M = 12.055 kg.
  assert.ok(Math.abs(medianWeightKg(0.5, "male") - 7.934) < 0.01);
  assert.ok(Math.abs(medianWeightKg(2, "female") - 12.05503983) < 1e-6);
});

test("unspecified sex averages male and female", () => {
  const average = (medianWeightKg(6, "male") + medianWeightKg(6, "female")) / 2;
  assert.equal(medianWeightKg(6), average);
});

test("weights increase with age and are null outside 0-20 years", () => {
  assert.ok(medianWeightKg(1) < medianWeightKg(5));
  assert.ok(medianWeightKg(5) < medianWeightKg(12));
  assert.equal(medianWeightKg(-0.1), null);
  assert.equal(medianWeightKg(25), null);
});
