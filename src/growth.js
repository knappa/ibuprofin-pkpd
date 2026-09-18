// Median body weight for age, used only to suggest a default weight.

import { MEDIAN_WEIGHT_FOR_AGE } from "./growth-data.js";

const MONTHS_PER_YEAR = 12;

function interpolate(rows, ageMonths) {
  if (ageMonths < rows[0][0] || ageMonths > rows[rows.length - 1][0]) return null;
  for (let idx = 1; idx < rows.length; idx++) {
    const [upperAge, upperWeight] = rows[idx];
    if (ageMonths <= upperAge) {
      const [lowerAge, lowerWeight] = rows[idx - 1];
      const fraction = (ageMonths - lowerAge) / (upperAge - lowerAge);
      return lowerWeight + fraction * (upperWeight - lowerWeight);
    }
  }
  return rows[rows.length - 1][1];
}

/**
 * Median weight (kg) for a child aged 0-20 years, or null outside that range.
 * `sex` is "male" or "female"; any other value averages the two.
 */
export function medianWeightKg(ageYears, sex) {
  const ageMonths = ageYears * MONTHS_PER_YEAR;
  if (sex === "male" || sex === "female") return interpolate(MEDIAN_WEIGHT_FOR_AGE[sex], ageMonths);
  const male = interpolate(MEDIAN_WEIGHT_FOR_AGE.male, ageMonths);
  const female = interpolate(MEDIAN_WEIGHT_FOR_AGE.female, ageMonths);
  return male === null || female === null ? null : (male + female) / 2;
}
