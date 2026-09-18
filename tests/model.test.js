import { test } from "node:test";
import assert from "node:assert/strict";

import {
  STATE,
  PD_CONSTANTS,
  absorptionParameters,
  analgesiaFraction,
  coxInhibitionPercent,
  maturationFactor,
  patientPkParameters,
  simulate,
} from "../src/model.js";
import { PK, PD } from "../src/parameters.js";
import { areaUnderCurve, peak } from "../src/metrics.js";

const ADULT = { weightKg: 70, ageYears: 30 };

// ---------------------------------------------------------------------------
// Closed-form solutions for checking the integrator
// ---------------------------------------------------------------------------

/** One-compartment oral model (Bateman equation), one dose. */
function batemanConcentration(time, { dose, bioavailability, absorptionRate, lagTimeHours, clearance, volume }) {
  const elapsed = time - lagTimeHours;
  if (elapsed <= 0) return 0;
  const eliminationRate = clearance / volume;
  return (
    ((bioavailability * dose * absorptionRate) / (volume * (absorptionRate - eliminationRate))) *
    (Math.exp(-eliminationRate * elapsed) - Math.exp(-absorptionRate * elapsed))
  );
}

/** Two-compartment oral model with first-order absorption and lag, one dose. */
function twoCompartmentConcentration(time, { dose, bioavailability, absorptionRate, lagTimeHours, pk }) {
  const elapsed = time - lagTimeHours;
  if (elapsed <= 0) return 0;
  const k10 = pk.clearance / pk.centralVolume;
  const k12 = pk.intercompartmentalClearance / pk.centralVolume;
  const k21 = pk.intercompartmentalClearance / pk.peripheralVolume;
  const rateSum = k10 + k12 + k21;
  const root = Math.sqrt(rateSum * rateSum - 4 * k10 * k21);
  const alpha = (rateSum + root) / 2;
  const beta = (rateSum - root) / 2;
  const ka = absorptionRate;
  const scale = (bioavailability * dose * ka) / pk.centralVolume;
  return (
    scale *
    (((k21 - alpha) / ((ka - alpha) * (beta - alpha))) * Math.exp(-alpha * elapsed) +
      ((k21 - beta) / ((ka - beta) * (alpha - beta))) * Math.exp(-beta * elapsed) +
      ((k21 - ka) / ((alpha - ka) * (beta - ka))) * Math.exp(-ka * elapsed))
  );
}

/** Assert every simulated point is within `relTol` of the exact value, relative to the peak. */
function assertMatchesExact(times, simulated, exact, relTol = 1e-6) {
  const exactValues = times.map(exact);
  const exactPeak = Math.max(...exactValues);
  times.forEach((time, idx) => {
    const error = Math.abs(simulated[idx] - exactValues[idx]);
    assert.ok(
      error <= relTol * exactPeak,
      `t=${time}: simulated ${simulated[idx]}, exact ${exactValues[idx]}, error ${error}`,
    );
  });
}

// ---------------------------------------------------------------------------
// PK against closed-form solutions
// ---------------------------------------------------------------------------

test("single dose matches the two-compartment closed form", () => {
  const dose = { timeHours: 0, amountMg: 400, formulation: "tablet", fed: false };
  const result = simulate({ patient: ADULT, doses: [dose], endTimeHours: 24 });
  const absorption = absorptionParameters("tablet", false);
  assertMatchesExact(result.times, result.plasmaConcentration, (time) =>
    twoCompartmentConcentration(time, {
      dose: 400,
      bioavailability: result.pk.bioavailability,
      ...absorption,
      pk: result.pk,
    }),
  );
});

test("multiple doses of mixed formulations match superposition of closed forms", () => {
  const doses = [
    { timeHours: 0, amountMg: 400, formulation: "tablet", fed: false },
    { timeHours: 4, amountMg: 200, formulation: "suspension", fed: true },
    { timeHours: 6.5, amountMg: 400, formulation: "sachet", fed: false },
    { timeHours: 12, amountMg: 600, formulation: "tablet", fed: true },
  ];
  const result = simulate({ patient: ADULT, doses, endTimeHours: 36 });
  assertMatchesExact(result.times, result.plasmaConcentration, (time) =>
    doses.reduce((total, dose) => {
      const absorption = absorptionParameters(dose.formulation, dose.fed);
      return (
        total +
        twoCompartmentConcentration(time - dose.timeHours, {
          dose: dose.amountMg,
          bioavailability: result.pk.bioavailability,
          ...absorption,
          pk: result.pk,
        })
      );
    }, 0),
  );
});

test("with no peripheral exchange the model reduces to the Bateman equation", () => {
  const doses = [
    { timeHours: 0, amountMg: 400, absorptionRate: 1.5, lagTimeHours: 0.1 },
    { timeHours: 6, amountMg: 400, absorptionRate: 1.5, lagTimeHours: 0.1 },
    { timeHours: 12, amountMg: 400, absorptionRate: 1.5, lagTimeHours: 0.1 },
  ];
  const pkOverrides = { intercompartmentalClearance: 0 };
  const result = simulate({ patient: ADULT, doses, endTimeHours: 30, pkOverrides });
  assertMatchesExact(result.times, result.plasmaConcentration, (time) =>
    doses.reduce(
      (total, dose) =>
        total +
        batemanConcentration(time - dose.timeHours, {
          dose: dose.amountMg,
          bioavailability: result.pk.bioavailability,
          absorptionRate: dose.absorptionRate,
          lagTimeHours: dose.lagTimeHours,
          clearance: result.pk.clearance,
          volume: result.pk.centralVolume,
        }),
      0,
    ),
  );
});

test("mass is conserved: gut + central + peripheral + eliminated = F x dose absorbed so far", () => {
  const doses = [
    { timeHours: 0, amountMg: 400, formulation: "tablet", fed: true },
    { timeHours: 8, amountMg: 200, formulation: "suspension", fed: false },
  ];
  const result = simulate({ patient: ADULT, doses, endTimeHours: 24 });
  const bioavailability = result.pk.bioavailability;
  result.times.forEach((time, idx) => {
    const state = result.states[idx];
    let total = state[STATE.central] + state[STATE.peripheral] + state[STATE.eliminated];
    for (let gutIdx = STATE.firstGut; gutIdx < state.length; gutIdx++) total += state[gutIdx];
    const delivered = result.doses
      .filter((dose) => dose.timeHours + dose.lagTimeHours <= time)
      .reduce((sum, dose) => sum + bioavailability * dose.amountMg, 0);
    assert.ok(Math.abs(total - delivered) < 1e-6, `t=${time}: total ${total}, delivered ${delivered}`);
  });
});

// ---------------------------------------------------------------------------
// PD
// ---------------------------------------------------------------------------

test("at steady state the effect-site average equals the plasma average over a dosing interval", () => {
  const intervalHours = 6;
  const doses = Array.from({ length: 20 }, (_, idx) => ({
    timeHours: idx * intervalHours,
    amountMg: 400,
    formulation: "tablet",
    fed: false,
  }));
  const endTimeHours = 20 * intervalHours;
  const result = simulate({ patient: ADULT, doses, endTimeHours, outputStepHours: 0.01 });
  const intervalStart = endTimeHours - 2 * intervalHours;
  const intervalEnd = endTimeHours - intervalHours;
  const plasmaAverage = areaUnderCurve(result.times, result.plasmaConcentration, intervalStart, intervalEnd);
  const effectAverage = areaUnderCurve(result.times, result.effectSiteConcentration, intervalStart, intervalEnd);
  assert.ok(Math.abs(effectAverage - plasmaAverage) / plasmaAverage < 1e-4, `${effectAverage} vs ${plasmaAverage}`);
});

test("temperature stays at baseline without drug and returns to it after washout", () => {
  const baselineTemperatureC = 39.2;
  const noDrug = simulate({ patient: ADULT, doses: [], endTimeHours: 12, baselineTemperatureC });
  noDrug.temperatureC.forEach((temperature) => assert.equal(temperature, baselineTemperatureC));

  const dosed = simulate({
    patient: ADULT,
    doses: [{ timeHours: 0, amountMg: 400, formulation: "tablet", fed: false }],
    endTimeHours: 72,
    baselineTemperatureC,
  });
  const lowest = Math.min(...dosed.temperatureC);
  const floor = baselineTemperatureC * (1 - PD_CONSTANTS.antipyresis.emax);
  assert.ok(lowest < baselineTemperatureC - 0.5, `expected a clear temperature drop, lowest ${lowest}`);
  assert.ok(lowest >= floor, `temperature ${lowest} fell below the model floor ${floor}`);
  const final = dosed.temperatureC[dosed.temperatureC.length - 1];
  assert.ok(Math.abs(final - baselineTemperatureC) < 1e-3, `final temperature ${final}`);
});

test("temperature nadir lags the plasma peak (indirect response)", () => {
  const result = simulate({
    patient: { weightKg: 30, ageYears: 9 },
    doses: [{ timeHours: 0, amountMg: 210, formulation: "suspension", fed: false }],
    endTimeHours: 12,
    outputStepHours: 0.01,
  });
  const plasmaPeak = peak(result.times, result.plasmaConcentration);
  const nadirIdx = result.temperatureC.indexOf(Math.min(...result.temperatureC));
  assert.ok(result.times[nadirIdx] > plasmaPeak.time + 0.5);
});

test("PD functions give half effect at their half-effect concentrations", () => {
  assert.ok(Math.abs(coxInhibitionPercent(PD_CONSTANTS.cox1.ic50, PD_CONSTANTS.cox1) - 50) < 1e-12);
  assert.ok(Math.abs(coxInhibitionPercent(PD_CONSTANTS.cox2.ic50, PD_CONSTANTS.cox2) - 50) < 1e-12);
  assert.ok(Math.abs(analgesiaFraction(PD_CONSTANTS.analgesia.c50) - PD_CONSTANTS.analgesia.emax / 2) < 1e-12);
  assert.equal(coxInhibitionPercent(0, PD_CONSTANTS.cox1), 0);
  assert.equal(analgesiaFraction(-1e-12), 0);
});

test("derived PD constants match the conversions documented in parameters.js", () => {
  assert.ok(Math.abs(PD_CONSTANTS.cox1.ic50 - 1.464) < 5e-4);
  assert.ok(Math.abs(PD_CONSTANTS.cox1.hill - 0.616) < 5e-4);
  assert.ok(Math.abs(PD_CONSTANTS.cox2.ic50 - 3.404) < 5e-4);
  assert.ok(Math.abs(PD_CONSTANTS.cox2.hill - 0.688) < 5e-4);
  assert.ok(Math.abs(PD_CONSTANTS.analgesia.ke0 - 0.6665) < 5e-4);
});

// ---------------------------------------------------------------------------
// Covariates and absorption
// ---------------------------------------------------------------------------

test("a 70 kg adult gets the source's typical values", () => {
  const pk = patientPkParameters(ADULT);
  assert.ok(Math.abs(pk.clearance - PK.clearance.value) < 1e-12);
  assert.equal(pk.centralVolume, PK.centralVolume.value);
  assert.equal(pk.intercompartmentalClearance, PK.intercompartmentalClearance.value);
  assert.equal(pk.peripheralVolume, PK.peripheralVolume.value);
  assert.equal(pk.bioavailability, PK.bioavailability.value);
});

test("children are scaled allometrically", () => {
  const pk = patientPkParameters({ weightKg: 20, ageYears: 5 });
  const sizeRatio = 20 / 70;
  assert.ok(Math.abs(pk.clearance - PK.clearance.value * sizeRatio ** 0.75 * maturationFactor(5)) < 1e-12);
  assert.ok(Math.abs(pk.centralVolume - PK.centralVolume.value * sizeRatio) < 1e-12);
  assert.ok(Math.abs(pk.intercompartmentalClearance - PK.intercompartmentalClearance.value * sizeRatio ** 0.75) < 1e-12);
});

test("maturation matches anderson2019's checkpoints and is negligible from 6 months", () => {
  const weeksToYears = (weeks) => weeks / (365.25 / 7);
  // 44 and 53 weeks postmenstrual age = 4 and 13 weeks after a term birth.
  assert.ok(Math.abs(maturationFactor(weeksToYears(4)) - 0.9) < 0.01);
  assert.ok(Math.abs(maturationFactor(weeksToYears(13)) - 0.98) < 0.01);
  assert.ok(maturationFactor(0.5) > 0.998);
});

test("tablet, fasted absorption uses the baseline half-life and lag", () => {
  const { absorptionRate, lagTimeHours } = absorptionParameters("tablet", false);
  assert.ok(Math.abs(absorptionRate - Math.LN2 / (PK.absorptionHalfLife.value / 60)) < 1e-12);
  assert.ok(Math.abs(lagTimeHours - PK.lagTime.value / 60) < 1e-12);
  assert.throws(() => absorptionParameters("lozenge", false));
});

test("the default baseline temperature is the troconiz2000 typical value", () => {
  const result = simulate({ patient: ADULT, doses: [], endTimeHours: 1 });
  assert.equal(result.temperatureC[0], PD.antipyresisBaselineTemperature.value);
});
