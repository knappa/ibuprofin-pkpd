// Scenario data: defaults, unit conversions, dose regimens, and compact
// encoding for shareable URLs (stored in the URL hash, which browsers do not
// send to the server).

import { PK, PD, FORMULATIONS, PK_SOURCE_POPULATION } from "./parameters.js";
import { medianWeightKg } from "./growth.js";

const POUNDS_PER_KG = 2.20462;
const MIN_SIMULATION_HOURS = 24;
const HOURS_AFTER_LAST_DOSE = 12;

export const celsiusToFahrenheit = (celsius) => (celsius * 9) / 5 + 32;
export const fahrenheitToCelsius = (fahrenheit) => ((fahrenheit - 32) * 5) / 9;
export const kgToPounds = (kg) => kg * POUNDS_PER_KG;
export const poundsToKg = (pounds) => pounds / POUNDS_PER_KG;

/** Ibuprofen mg/L to micromolar, using the cited molecular weight. */
export function mgPerLToMicromolar(mgPerL, molecularWeight) {
  return (mgPerL * 1000) / molecularWeight;
}

/**
 * Suggested weight for an age: growth-chart median for ages 0-20 y, the
 * model's 70 kg reference weight for adults beyond the growth charts.
 */
export function suggestedWeightKg(ageYears, sex) {
  return medianWeightKg(ageYears, sex) ?? PK.referenceWeight.value;
}

export function isAdult(ageYears) {
  return ageYears >= PK_SOURCE_POPULATION.minAgeYears;
}

/** Build doses for "amount every N hours, M times, starting at t0". */
export function regimenDoses({ amountMg, intervalHours, doseCount, firstDoseHours = 0, formulation, fed }) {
  return Array.from({ length: doseCount }, (_, idx) => ({
    timeHours: firstDoseHours + idx * intervalHours,
    amountMg,
    formulation,
    fed,
  }));
}

/** Simulation length: 12 h after the last dose, at least 24 h. */
export function defaultEndTimeHours(doses) {
  const lastDose = doses.reduce((latest, dose) => Math.max(latest, dose.timeHours), 0);
  return Math.max(MIN_SIMULATION_HOURS, Math.ceil(lastDose + HOURS_AFTER_LAST_DOSE));
}

/** The scenario shown on first load: a typical adult taking 400 mg tablets every 6 h. */
export function defaultScenario() {
  return {
    patient: { ageYears: 30, weightKg: PK.referenceWeight.value, sex: "unspecified" },
    baselineTemperatureC: PD.antipyresisBaselineTemperature.value,
    doses: regimenDoses({ amountMg: 400, intervalHours: 6, doseCount: 3, formulation: "tablet", fed: false }),
    endTimeHours: null,
  };
}

// ---------------------------------------------------------------------------
// URL-hash encoding
// ---------------------------------------------------------------------------

const FORMULATION_CODES = Object.keys(FORMULATIONS);
const round = (value, digits) => Number(value.toFixed(digits));

/** Encode a scenario as a compact URL-safe string. */
export function encodeScenario(scenario) {
  const compact = {
    v: 1,
    a: round(scenario.patient.ageYears, 3),
    w: round(scenario.patient.weightKg, 2),
    s: scenario.patient.sex?.[0] ?? "u",
    t: round(scenario.baselineTemperatureC, 2),
    e: scenario.endTimeHours ?? 0,
    d: scenario.doses.map((dose) => [
      round(dose.timeHours, 3),
      round(dose.amountMg, 1),
      FORMULATION_CODES.indexOf(dose.formulation),
      dose.fed ? 1 : 0,
    ]),
  };
  return btoa(JSON.stringify(compact)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const SEX_BY_CODE = { m: "male", f: "female", u: "unspecified" };

/** Decode a string from encodeScenario; returns null if it is not valid. */
export function decodeScenario(encoded) {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const compact = JSON.parse(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)));
    if (compact.v !== 1 || !Array.isArray(compact.d)) return null;
    const finite = (value) => Number.isFinite(value);
    if (![compact.a, compact.w, compact.t].every(finite)) return null;
    const doses = compact.d.map(([timeHours, amountMg, formulationIdx, fed]) => ({
      timeHours,
      amountMg,
      formulation: FORMULATION_CODES[formulationIdx],
      fed: fed === 1,
    }));
    if (!doses.every((dose) => finite(dose.timeHours) && finite(dose.amountMg) && dose.formulation)) return null;
    return {
      patient: { ageYears: compact.a, weightKg: compact.w, sex: SEX_BY_CODE[compact.s] ?? "unspecified" },
      baselineTemperatureC: compact.t,
      doses,
      endTimeHours: compact.e > 0 ? compact.e : null,
    };
  } catch {
    return null;
  }
}
