// Checks on a scenario: hard limits (no simulation), dose-limit warnings from
// FDA labeling, and "extrapolated" labels for outputs used outside the
// populations their parameters came from.

import { DOSE_LIMITS, PD_SOURCE_POPULATIONS, PK_SOURCE_POPULATION } from "./parameters.js";

const HOURS_PER_DAY = 24;

/** Pediatric dose limits apply through 17 years of age. */
const isPediatric = (ageYears) => ageYears < DOSE_LIMITS.pediatricMaxAgeYears.value + 1;

export const SEVERITY = Object.freeze({ error: "error", warning: "warning", note: "note" });

/**
 * Largest total dose taken within any 24 h window, and the most doses in any
 * 24 h window. Windows start at each dose time.
 */
export function maxDailyTotals(doses) {
  let maxAmountMg = 0;
  let maxCount = 0;
  for (const windowStart of doses.map((dose) => dose.timeHours)) {
    const inWindow = doses.filter(
      (dose) => dose.timeHours >= windowStart && dose.timeHours < windowStart + HOURS_PER_DAY,
    );
    maxAmountMg = Math.max(maxAmountMg, inWindow.reduce((sum, dose) => sum + dose.amountMg, 0));
    maxCount = Math.max(maxCount, inWindow.length);
  }
  return { maxAmountMg, maxCount };
}

/** Hard limits: when any of these fail, the page does not simulate. */
export function inputErrors({ patient, doses }) {
  const errors = [];
  const minimumAgeMonths = DOSE_LIMITS.minimumAgeMonths.value;
  if (!(patient.ageYears >= minimumAgeMonths / 12)) {
    errors.push({
      severity: SEVERITY.error,
      text: `The model supports ages ${minimumAgeMonths} months and older (OTC labeling minimum).`,
    });
  }
  if (!(patient.weightKg > 0)) errors.push({ severity: SEVERITY.error, text: "Enter a body weight above 0." });
  if (doses.some((dose) => !(dose.amountMg >= 0) || !(dose.timeHours >= 0))) {
    errors.push({ severity: SEVERITY.error, text: "Dose amounts and times must be zero or positive." });
  }
  return errors;
}

/** Dose-limit and model-reliability warnings. */
export function doseWarnings({ patient, doses }) {
  const warnings = [];
  const { maxAmountMg, maxCount } = maxDailyTotals(doses);
  const isChild = isPediatric(patient.ageYears);
  const otcAdultMinAge = DOSE_LIMITS.otcAdultMinAgeYears.value;
  const largestDose = doses.reduce((largest, dose) => Math.max(largest, dose.amountMg), 0);

  if (isChild) {
    const perKgLimit = DOSE_LIMITS.pediatricDailyPerKg.value * patient.weightKg;
    const dailyLimit = Math.min(perKgLimit, DOSE_LIMITS.pediatricDailyAbsolute.value);
    if (maxAmountMg > dailyLimit) {
      warnings.push({
        severity: SEVERITY.warning,
        text:
          `Up to ${Math.round(maxAmountMg)} mg in 24 h exceeds the pediatric maximum of ` +
          `${Math.round(dailyLimit)} mg (${DOSE_LIMITS.pediatricDailyPerKg.value} mg/kg/day, ` +
          `capped at ${DOSE_LIMITS.pediatricDailyAbsolute.value} mg).`,
      });
    }
    if (patient.ageYears < otcAdultMinAge && maxCount > DOSE_LIMITS.pediatricDosesPerDay.value) {
      warnings.push({
        severity: SEVERITY.warning,
        text: `${maxCount} doses in 24 h; children's OTC labeling allows at most ${DOSE_LIMITS.pediatricDosesPerDay.value}.`,
      });
    }
  }
  if (!isChild || patient.ageYears >= otcAdultMinAge) {
    if (maxAmountMg > DOSE_LIMITS.adultRxDaily.value) {
      warnings.push({
        severity: SEVERITY.warning,
        text: `Up to ${Math.round(maxAmountMg)} mg in 24 h exceeds the prescription maximum of ${DOSE_LIMITS.adultRxDaily.value} mg/day.`,
      });
    } else if (maxAmountMg > DOSE_LIMITS.adultOtcDaily.value) {
      warnings.push({
        severity: SEVERITY.warning,
        text:
          `Up to ${Math.round(maxAmountMg)} mg in 24 h exceeds the OTC maximum of ` +
          `${DOSE_LIMITS.adultOtcDaily.value} mg; higher totals are prescription-only.`,
      });
    }
  }

  const linearityLimitMg = DOSE_LIMITS.linearityNote.value;
  const pediatricSingleDoseLimitMgPerKg = DOSE_LIMITS.pediatricSingleDosePerKg.value;
  if (largestDose > linearityLimitMg) {
    warnings.push({
      severity: SEVERITY.note,
      text:
        `A single dose above ${linearityLimitMg} mg is outside the range where concentrations are known ` +
        "to be dose-proportional; the model may overestimate them.",
    });
  } else if (isChild && largestDose > pediatricSingleDoseLimitMgPerKg * patient.weightKg) {
    warnings.push({
      severity: SEVERITY.note,
      text:
        `A single dose above ${pediatricSingleDoseLimitMgPerKg} mg/kg is above the pediatric label dose; ` +
        "concentrations may be less than dose-proportional, so the model may overestimate them.",
    });
  }
  return warnings;
}

const inRange = (value, low, high) => (low === null || value >= low) && (high === null || value <= high);

/**
 * For each output, null if the patient is inside the source population,
 * otherwise a short explanation of the extrapolation.
 */
export function extrapolationNotes({ patient }) {
  const { ageYears, weightKg } = patient;
  const notes = {};

  const pkSource = PK_SOURCE_POPULATION;
  if (ageYears >= pkSource.minAgeYears) {
    notes.concentration = inRange(weightKg, pkSource.minWeightKg, pkSource.maxWeightKg)
      ? null
      : `Adult PK data covered ${pkSource.minWeightKg}-${pkSource.maxWeightKg} kg.`;
  } else {
    notes.concentration = "Scaled from adult PK by body weight; checked against pediatric data.";
  }

  const cox = PD_SOURCE_POPULATIONS.cox;
  notes.cox = ageYears >= cox.minAgeYears ? null : "COX curves come from adult blood samples.";

  const analgesia = PD_SOURCE_POPULATIONS.analgesia;
  notes.analgesia =
    ageYears >= analgesia.minAgeYears && weightKg >= analgesia.minWeightKg
      ? null
      : `Pain model data: ages ${analgesia.minAgeYears} y and older, ${analgesia.minWeightKg} kg and above.`;

  const antipyresis = PD_SOURCE_POPULATIONS.antipyresis;
  notes.antipyresis =
    inRange(ageYears, antipyresis.minAgeYears, antipyresis.maxAgeYears) &&
    inRange(weightKg, antipyresis.minWeightKg, antipyresis.maxWeightKg)
      ? null
      : `Fever model data: children ${antipyresis.minAgeYears}-${antipyresis.maxAgeYears} y, ` +
        `${antipyresis.minWeightKg}-${antipyresis.maxWeightKg} kg.`;

  return notes;
}
