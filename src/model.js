// Ibuprofen PK-PD model: two-compartment PK with first-order absorption and
// lag time, an effect compartment for analgesia, an indirect-response model
// for body temperature, and direct COX-1/COX-2 inhibition.
//
// Equations and sources: docs/MODEL.md. Parameter values: parameters.js.
// Units: time in hours, amounts in mg, volumes in L, concentrations in mg/L,
// temperature in degrees Celsius.

import { CONSTANTS, PK, FORMULATIONS, PD } from "./parameters.js";
import { integrate } from "./solver.js";

const WEEKS_PER_YEAR = 365.25 / 7;
const TERM_GESTATION_WEEKS = 40;
const MINUTES_PER_HOUR = 60;

// ---------------------------------------------------------------------------
// Patient-specific PK parameters
// ---------------------------------------------------------------------------

/** Clearance maturation factor (anderson2019) for a term-born patient. */
export function maturationFactor(ageYears) {
  const postmenstrualAgeWeeks = ageYears * WEEKS_PER_YEAR + TERM_GESTATION_WEEKS;
  const hill = PK.maturationHill.value;
  const halfTime = PK.maturationHalfTime.value;
  return postmenstrualAgeWeeks ** hill / (halfTime ** hill + postmenstrualAgeWeeks ** hill);
}

/**
 * Typical PK parameters for a patient of the given weight and age, using
 * allometric scaling to a 70 kg reference plus clearance maturation.
 */
export function patientPkParameters({ weightKg, ageYears }) {
  const sizeRatio = weightKg / PK.referenceWeight.value;
  const clearanceScale = sizeRatio ** PK.allometricExponentClearance.value;
  const volumeScale = sizeRatio ** PK.allometricExponentVolume.value;
  return {
    clearance: PK.clearance.value * clearanceScale * maturationFactor(ageYears),
    intercompartmentalClearance: PK.intercompartmentalClearance.value * clearanceScale,
    centralVolume: PK.centralVolume.value * volumeScale,
    peripheralVolume: PK.peripheralVolume.value * volumeScale,
    bioavailability: PK.bioavailability.value,
  };
}

/** First-order absorption rate (1/h) and lag time (h) for one dose. */
export function absorptionParameters(formulation, fed) {
  const formulationEntry = FORMULATIONS[formulation];
  if (!formulationEntry) throw new Error(`Unknown formulation "${formulation}"`);
  const factors = fed ? formulationEntry.fed : formulationEntry.fasted;
  const halfLifeHours =
    (PK.absorptionHalfLife.value * factors.absorptionHalfLifeFactor) / MINUTES_PER_HOUR;
  return {
    absorptionRate: Math.LN2 / halfLifeHours,
    lagTimeHours: (PK.lagTime.value * factors.lagTimeFactor) / MINUTES_PER_HOUR,
  };
}

// ---------------------------------------------------------------------------
// PD constants derived from the stored source values
// ---------------------------------------------------------------------------

/** Convert a whole-blood micromolar concentration to a plasma mg/L value. */
function wholeBloodMicromolarToPlasmaMgPerL(micromolar) {
  return (
    (micromolar * PD.wholeBloodToPlasmaFactor.value * CONSTANTS.molecularWeight.value) / 1000
  );
}

/** Hill coefficient implied by an IC50 and IC80 on a 0-100% sigmoid. */
function hillFromIc50Ic80(ic50, ic80) {
  return Math.log(4) / Math.log(ic80 / ic50);
}

export const PD_CONSTANTS = Object.freeze({
  cox1: Object.freeze({
    ic50: wholeBloodMicromolarToPlasmaMgPerL(PD.cox1IC50.value),
    hill: hillFromIc50Ic80(PD.cox1IC50.value, PD.cox1IC80.value),
  }),
  cox2: Object.freeze({
    ic50: wholeBloodMicromolarToPlasmaMgPerL(PD.cox2IC50.value),
    hill: hillFromIc50Ic80(PD.cox2IC50.value, PD.cox2IC80.value),
  }),
  analgesia: Object.freeze({
    emax: PD.analgesiaEmax.value,
    c50: PD.analgesiaEC50.value,
    hill: PD.analgesiaHill.value,
    ke0: Math.LN2 / PD.analgesiaEquilibrationHalfTime.value,
  }),
  antipyresis: Object.freeze({
    emax: PD.antipyresisEmax.value,
    ec50: PD.antipyresisEC50.value,
    hill: PD.antipyresisHill.value,
    kout: PD.antipyresisKout.value,
  }),
});

/** Sigmoid fraction C^n / (C50^n + C^n); negative inputs (solver noise) count as 0. */
function sigmoidFraction(concentration, c50, hill) {
  const clamped = Math.max(0, concentration);
  const scaled = (clamped / c50) ** hill;
  return scaled / (1 + scaled);
}

/** Percent inhibition of COX-1 or COX-2 at a total plasma concentration. */
export function coxInhibitionPercent(plasmaConcentration, { ic50, hill }) {
  return 100 * sigmoidFraction(plasmaConcentration, ic50, hill);
}

/**
 * Fractional reduction in pain score at an effect-site concentration.
 *
 * REVIEW-LATER (analgesia-equation-form): hannam2018 prints
 * EMAX * U^Hill / (1 + U)^Hill with U = Ce / C50, but defines C50 as the
 * half-maximal concentration. The standard form EMAX * U^Hill / (1 + U^Hill)
 * is used here. See docs/SOURCES_REVIEW.md.
 */
export function analgesiaFraction(effectSiteConcentration, { emax, c50, hill } = PD_CONSTANTS.analgesia) {
  return emax * sigmoidFraction(effectSiteConcentration, c50, hill);
}

// ---------------------------------------------------------------------------
// ODE system
// ---------------------------------------------------------------------------

// Fixed state slots; each dose then gets its own gut compartment.
export const STATE = Object.freeze({
  central: 0,
  peripheral: 1,
  effectSite: 2,
  temperature: 3,
  eliminated: 4,
  firstGut: 5,
});

/**
 * Build the ODE system for a set of oral doses.
 *
 * @param {object} pk patient PK parameters (see patientPkParameters)
 * @param {{timeHours: number, amountMg: number, absorptionRate: number, lagTimeHours: number}[]} doses
 * @param {number} baselineTemperatureC
 * @returns {{stateNames: string[], initialState: number[], rhs: Function, events: object[]}}
 */
export function buildOralModel(pk, doses, baselineTemperatureC) {
  const { clearance, intercompartmentalClearance, centralVolume, peripheralVolume, bioavailability } = pk;
  const eliminationRate = clearance / centralVolume;
  const centralToPeripheral = intercompartmentalClearance / centralVolume;
  const peripheralToCentral = intercompartmentalClearance / peripheralVolume;
  const { ke0 } = PD_CONSTANTS.analgesia;
  const { emax: feverEmax, ec50: feverEc50, hill: feverHill, kout } = PD_CONSTANTS.antipyresis;
  const temperatureSynthesisRate = kout * baselineTemperatureC;

  const doseCount = doses.length;
  const absorptionRates = doses.map((dose) => dose.absorptionRate);

  const stateNames = ["central", "peripheral", "effectSite", "temperature", "eliminated"];
  doses.forEach((_, doseIdx) => stateNames.push(`gut${doseIdx}`));

  const initialState = new Array(stateNames.length).fill(0);
  initialState[STATE.temperature] = baselineTemperatureC;

  const rhs = (time, state) => {
    const derivative = new Float64Array(state.length);
    const centralAmount = state[STATE.central];
    const peripheralAmount = state[STATE.peripheral];
    const plasmaConcentration = centralAmount / centralVolume;

    let absorbed = 0;
    for (let doseIdx = 0; doseIdx < doseCount; doseIdx++) {
      const gutIdx = STATE.firstGut + doseIdx;
      const flux = absorptionRates[doseIdx] * state[gutIdx];
      derivative[gutIdx] = -flux;
      absorbed += flux;
    }

    const eliminated = eliminationRate * centralAmount;
    const distributed = centralToPeripheral * centralAmount - peripheralToCentral * peripheralAmount;

    derivative[STATE.central] = absorbed - eliminated - distributed;
    derivative[STATE.peripheral] = distributed;
    derivative[STATE.eliminated] = eliminated;
    derivative[STATE.effectSite] = ke0 * (plasmaConcentration - state[STATE.effectSite]);
    derivative[STATE.temperature] =
      temperatureSynthesisRate * (1 - feverEmax * sigmoidFraction(plasmaConcentration, feverEc50, feverHill)) -
      kout * state[STATE.temperature];
    return derivative;
  };

  const events = doses.map((dose, doseIdx) => ({
    time: dose.timeHours + dose.lagTimeHours,
    apply: (state) => {
      state[STATE.firstGut + doseIdx] += bioavailability * dose.amountMg;
    },
  }));

  return { stateNames, initialState, rhs, events };
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/**
 * Simulate a dosing scenario.
 *
 * @param {object} scenario
 * @param {{weightKg: number, ageYears: number}} scenario.patient
 * @param {{timeHours: number, amountMg: number, formulation: string, fed: boolean}[]} scenario.doses
 * @param {number} scenario.endTimeHours
 * @param {number} [scenario.outputStepHours=0.05]
 * @param {number} [scenario.baselineTemperatureC] defaults to the troconiz2000 typical value
 * @param {object} [scenario.pkOverrides] replace individual PK parameters (used by tests)
 * @param {object} [scenario.solverOptions]
 */
export function simulate(scenario) {
  const {
    patient,
    doses,
    endTimeHours,
    outputStepHours = 0.05,
    baselineTemperatureC = PD.antipyresisBaselineTemperature.value,
    pkOverrides = {},
    solverOptions = {},
  } = scenario;

  const pk = { ...patientPkParameters(patient), ...pkOverrides };
  const resolvedDoses = doses.map((dose) => {
    const absorption =
      dose.absorptionRate !== undefined
        ? { absorptionRate: dose.absorptionRate, lagTimeHours: dose.lagTimeHours ?? 0 }
        : absorptionParameters(dose.formulation, dose.fed);
    return { ...dose, ...absorption };
  });

  const model = buildOralModel(pk, resolvedDoses, baselineTemperatureC);

  const outputCount = Math.floor(endTimeHours / outputStepHours + 1e-9) + 1;
  const outputTimes = Array.from({ length: outputCount }, (_, idx) => idx * outputStepHours);
  if (outputTimes[outputTimes.length - 1] < endTimeHours) outputTimes.push(endTimeHours);

  const { times, states } = integrate(model.rhs, model.initialState, 0, endTimeHours, {
    outputTimes,
    events: model.events,
    options: solverOptions,
  });

  const plasmaConcentration = states.map((state) => state[STATE.central] / pk.centralVolume);
  const effectSiteConcentration = states.map((state) => state[STATE.effectSite]);

  return {
    pk,
    doses: resolvedDoses,
    stateNames: model.stateNames,
    times,
    states,
    plasmaConcentration,
    effectSiteConcentration,
    temperatureC: states.map((state) => state[STATE.temperature]),
    cox1InhibitionPercent: plasmaConcentration.map((conc) => coxInhibitionPercent(conc, PD_CONSTANTS.cox1)),
    cox2InhibitionPercent: plasmaConcentration.map((conc) => coxInhibitionPercent(conc, PD_CONSTANTS.cox2)),
    analgesiaFraction: effectSiteConcentration.map((conc) => analgesiaFraction(conc)),
  };
}
