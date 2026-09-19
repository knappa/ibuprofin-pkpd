// Compare model predictions with the published observations in
// validation-data.js. Runs in the browser (the documentation section shows
// the results live) and in Node (scripts/validation.mjs writes
// docs/VALIDATION.md; the test suite guards against regressions).

import { simulate, patientPkParameters } from "./model.js";
import { peak, valueAt } from "./metrics.js";
import { medianWeightKg } from "./growth.js";
import { VALIDATION_DATA } from "./validation-data.js";

const ADULT_AGE_YEARS = 30;
const ADULT_WEIGHT_KG = 70;
const OUTPUT_STEP_HOURS = 0.01;

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const VERDICT = Object.freeze({
  pass: "PASS",
  acceptable: "ACCEPTABLE",
  fail: "FAIL",
  info: "INFO",
});

/**
 * Score a prediction against an observation.
 * - mean and sd: PASS within 1 SD, ACCEPTABLE within 2 SD.
 * - range only: PASS inside the range.
 * - mean only: PASS within +/-25%, ACCEPTABLE within +/-50%.
 */
export function score(predicted, observation) {
  if (observation.mean !== undefined && observation.sd !== undefined) {
    const zScore = Math.abs(predicted - observation.mean) / observation.sd;
    if (zScore <= 1) return VERDICT.pass;
    return zScore <= 2 ? VERDICT.acceptable : VERDICT.fail;
  }
  if (observation.range !== undefined) {
    const [low, high] = observation.range;
    return predicted >= low && predicted <= high ? VERDICT.pass : VERDICT.fail;
  }
  const relativeError = Math.abs(predicted - observation.value) / observation.value;
  if (relativeError <= 0.25) return VERDICT.pass;
  return relativeError <= 0.5 ? VERDICT.acceptable : VERDICT.fail;
}

export function describeObserved(observation) {
  if (observation.mean !== undefined && observation.sd !== undefined) {
    return `${observation.mean} +/- ${observation.sd}`;
  }
  if (observation.range !== undefined) return `${observation.range[0]} - ${observation.range[1]}`;
  return `${observation.value}`;
}

// ---------------------------------------------------------------------------
// Simulation helpers
// ---------------------------------------------------------------------------

function runSingleDose({ weightKg, ageYears, amountMg, formulation, fed, endTimeHours = 24 }) {
  return simulate({
    patient: { weightKg, ageYears },
    doses: [{ timeHours: 0, amountMg, formulation, fed }],
    endTimeHours,
    outputStepHours: OUTPUT_STEP_HOURS,
  });
}

/** Terminal half-life from a log-linear fit of plasma concentration between two times. */
function terminalHalfLife(result, startTime, endTime) {
  const points = result.times
    .map((time, idx) => [time, result.plasmaConcentration[idx]])
    .filter(([time, conc]) => time >= startTime && time <= endTime && conc > 0);
  const count = points.length;
  const meanTime = points.reduce((sum, [time]) => sum + time, 0) / count;
  const meanLog = points.reduce((sum, [, conc]) => sum + Math.log(conc), 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (const [time, conc] of points) {
    numerator += (time - meanTime) * (Math.log(conc) - meanLog);
    denominator += (time - meanTime) ** 2;
  }
  return Math.LN2 / -(numerator / denominator);
}

/** Oral clearance CL/F in mL/min/kg. */
function oralClearanceMlPerMinPerKg(weightKg, ageYears) {
  const pk = patientPkParameters({ weightKg, ageYears });
  return ((pk.clearance / pk.bioavailability) * 1000) / 60 / weightKg;
}

function timeOfMinimum(times, values) {
  let minIdx = 0;
  for (let idx = 1; idx < values.length; idx++) if (values[idx] < values[minIdx]) minIdx = idx;
  return times[minIdx];
}

// ---------------------------------------------------------------------------
// Per-study comparisons. Each returns rows of
// {quantity, units, predicted, observation, verdict?, note?}.
// ---------------------------------------------------------------------------

const entryById = Object.fromEntries(VALIDATION_DATA.map((entry) => [entry.id, entry]));
const observationOf = (entryId, quantity) =>
  entryById[entryId].observations.find((observation) => observation.quantity === quantity);

function pediatricSingleDose(entryId, { ageYears, mgPerKg, halfLifeWindow = [4, 8], assumptions }) {
  const weightKg = medianWeightKg(ageYears);
  const result = runSingleDose({
    weightKg,
    ageYears,
    amountMg: mgPerKg * weightKg,
    formulation: "suspension",
    fed: false,
  });
  const plasmaPeak = peak(result.times, result.plasmaConcentration);
  const predictions = {
    cmax: plasmaPeak.value,
    tmax: plasmaPeak.time,
    oralClearance: oralClearanceMlPerMinPerKg(weightKg, ageYears),
    halfLife: terminalHalfLife(result, ...halfLifeWindow),
    auc: (result.pk.bioavailability * mgPerKg * weightKg) / result.pk.clearance,
    absorptionHalfLife: Math.LN2 / result.doses[0].absorptionRate,
  };
  // Predictions are in hours; some sources report durations in minutes.
  const inObservationUnits = (quantity, units, value) =>
    units === "min" && (quantity === "absorptionHalfLife" || quantity === "tmax") ? value * 60 : value;
  const rows = entryById[entryId].observations
    .filter((observation) => observation.quantity in predictions)
    .map((observation) => ({
      quantity: observation.quantity,
      units: observation.units,
      predicted: inObservationUnits(observation.quantity, observation.units, predictions[observation.quantity]),
      observation,
    }));
  const assumption = `Typical child aged ${ageYears} y, median weight ${weightKg.toFixed(1)} kg; ${assumptions}`;
  return { result, rows, assumption };
}

const STUDIES = [
  {
    id: "li2012-standard-tablet",
    run() {
      const result = runSingleDose({
        weightKg: ADULT_WEIGHT_KG,
        ageYears: ADULT_AGE_YEARS,
        amountMg: 400,
        formulation: "tablet",
        fed: false,
      });
      const plasmaPeak = peak(result.times, result.plasmaConcentration);
      const pk = result.pk;
      return {
        assumption: "70 kg adult; fasted (feeding state after surgery not reported).",
        rows: [
          { quantity: "cmax", units: "mg/L", predicted: plasmaPeak.value, observation: observationOf(this.id, "cmax") },
          { quantity: "tmax", units: "h", predicted: plasmaPeak.time, observation: observationOf(this.id, "tmax") },
          {
            quantity: "oralClearance",
            units: "L/h",
            predicted: pk.clearance / pk.bioavailability,
            observation: observationOf(this.id, "oralClearance"),
          },
        ],
      };
    },
  },

  {
    id: "troconiz2000-adult-suspension",
    run() {
      const result = runSingleDose({
        weightKg: 62,
        ageYears: ADULT_AGE_YEARS,
        amountMg: 400,
        formulation: "suspension",
        fed: false,
      });
      const plasmaPeak = peak(result.times, result.plasmaConcentration);
      return {
        assumption: "62 kg adult (study mean); fasted assumed. Target is the source's conflicting 0.5 h (text) to 0.9 h (abstract).",
        rows: [
          { quantity: "tmax", units: "h", predicted: plasmaPeak.time, observation: { range: [0.5, 0.9] } },
        ],
      };
    },
  },

  {
    id: "blain2002-single",
    run() {
      const result = runSingleDose({
        weightKg: ADULT_WEIGHT_KG,
        ageYears: ADULT_AGE_YEARS,
        amountMg: 400,
        formulation: "tablet",
        fed: true,
      });
      const concentration = valueAt(result.times, result.plasmaConcentration, 2.5);
      const cox = (key) => valueAt(result.times, result[key], 2.5);
      return {
        assumption: "70 kg adult (weight not reported); tablet with a light meal (fed); sample at 2.5 h.",
        rows: [
          { quantity: "plasmaConcentration at 2.5 h", units: "mg/L", predicted: concentration, observation: entryById[this.id].observations[0] },
          { quantity: "cox1Inhibition at 2.5 h", units: "%", predicted: cox("cox1InhibitionPercent"), observation: entryById[this.id].observations[1] },
          { quantity: "cox2Inhibition at 2.5 h", units: "%", predicted: cox("cox2InhibitionPercent"), observation: entryById[this.id].observations[2] },
        ],
      };
    },
  },

  {
    id: "blain2002-repeated",
    run() {
      const dosingClockHours = [9, 12, 20];
      const days = 3;
      const doses = [];
      for (let day = 0; day < days; day++) {
        for (const clockHour of dosingClockHours) {
          doses.push({ timeHours: day * 24 + clockHour - 9, amountMg: 400, formulation: "tablet", fed: true });
        }
      }
      const result = simulate({
        patient: { weightKg: ADULT_WEIGHT_KG, ageYears: ADULT_AGE_YEARS },
        doses,
        endTimeHours: 3 * 24,
        outputStepHours: OUTPUT_STEP_HOURS,
      });
      // Day 3 samples 2.5 h after each of the three daily doses.
      const sampleTimes = dosingClockHours.map((clockHour) => 2 * 24 + clockHour - 9 + 2.5);
      const at = (key) => sampleTimes.map((time) => valueAt(result.times, result[key], time));
      const describe = (values) => values.map((value) => value.toFixed(1)).join(" / ");
      const observations = entryById[this.id].observations;
      const rows = [
        ["plasmaConcentration", "plasmaConcentration", "mg/L", observations[0]],
        ["cox1Inhibition", "cox1InhibitionPercent", "%", observations[1]],
        ["cox2Inhibition", "cox2InhibitionPercent", "%", observations[2]],
      ].map(([quantity, key, units, observation]) => {
        const values = at(key);
        return {
          quantity: `${quantity}, day 3, 2.5 h after 09:00 / 12:00 / 20:00 dose`,
          units,
          predicted: values[0],
          predictedText: describe(values),
          observation,
          verdict: VERDICT.info,
          note: "Which daily dose was sampled is not stated; scored as information only.",
        };
      });
      return { assumption: "70 kg adult; 400 mg at 09:00, 12:00, 20:00 with meals for 3 days.", rows };
    },
  },

  {
    id: "nahata1991-5mgkg",
    run() {
      return pediatricSingleDose(this.id, { ageYears: 6.7, mgPerKg: 5, assumptions: "liquid modeled as suspension, fasted." });
    },
  },
  {
    id: "nahata1991-10mgkg",
    run() {
      return pediatricSingleDose(this.id, { ageYears: 6.2, mgPerKg: 10, assumptions: "liquid modeled as suspension, fasted." });
    },
  },

  {
    id: "kelley1992",
    run() {
      const { result, rows, assumption } = pediatricSingleDose(this.id, {
        ageYears: 6,
        mgPerKg: 6,
        assumptions: "age range 11 months-11.5 y; liquid modeled as suspension, fasted.",
      });
      rows.push({
        quantity: "timeToMaxTemperatureDecrease",
        units: "h",
        predicted: timeOfMinimum(result.times, result.temperatureC),
        observation: observationOf(this.id, "timeToMaxTemperatureDecrease"),
      });
      return { rows, assumption };
    },
  },

  {
    id: "kauffman1992",
    run() {
      const { result, rows, assumption } = pediatricSingleDose(this.id, {
        ageYears: 2.5,
        mgPerKg: 8,
        halfLifeWindow: [2, 8],
        assumptions: "median age of the cohort; suspension, fasted (nothing by mouth for 1 h).",
      });
      const plasmaPeakTime = peak(result.times, result.plasmaConcentration).time;
      rows.push({
        quantity: "delayPeakConcentrationToPeakTemperatureDecrement",
        units: "h",
        predicted: timeOfMinimum(result.times, result.temperatureC) - plasmaPeakTime,
        observation: observationOf(this.id, "delayPeakConcentrationToPeakTemperatureDecrement"),
      });
      return { rows, assumption };
    },
  },

  {
    id: "brown1998-dose-proportionality",
    run() {
      return {
        assumption: "Linear model: AUC is exactly proportional to dose.",
        rows: [
          {
            quantity: "aucRatio10vs5",
            units: "ratio",
            predicted: 2,
            observation: observationOf(this.id, "aucRatio10vs5"),
            verdict: VERDICT.info,
            note: "Known limitation (linear PK); nahata1991 found no dose effect over the same range.",
          },
        ],
      };
    },
  },

  {
    id: "anderson2019-trough",
    run() {
      const doses = Array.from({ length: 12 }, (_, idx) => ({
        timeHours: idx * 8,
        amountMg: 400,
        formulation: "tablet",
        fed: false,
      }));
      const result = simulate({
        patient: { weightKg: ADULT_WEIGHT_KG, ageYears: ADULT_AGE_YEARS },
        doses,
        endTimeHours: 96,
        outputStepHours: OUTPUT_STEP_HOURS,
      });
      return {
        assumption: "70 kg adult, 400 mg every 8 h to steady state; effect-site trough just before the last dose.",
        rows: [
          {
            quantity: "effectSiteConcentrationTroughSteadyState",
            units: "mg/L",
            predicted: valueAt(result.times, result.effectSiteConcentration, 88),
            observation: observationOf(this.id, "effectSiteConcentrationTroughSteadyState"),
            verdict: VERDICT.info,
            note: "Model-based statement from a different PK model; order-of-magnitude check only.",
          },
        ],
      };
    },
  },

  {
    id: "morse2022-table4",
    run() {
      const rows = entryById[this.id].observations.flatMap((entry) => {
        const result = runSingleDose({
          weightKg: ADULT_WEIGHT_KG,
          ageYears: ADULT_AGE_YEARS,
          amountMg: 300,
          formulation: entry.formulation,
          fed: entry.fed,
        });
        const plasmaPeak = peak(result.times, result.plasmaConcentration);
        const label = `${entry.formulation}, ${entry.fed ? "fed" : "fasted"}`;
        return [
          { quantity: `cmax (${label})`, units: "mg/L", predicted: plasmaPeak.value, observation: { range: [entry.cmax[1], entry.cmax[2]] }, note: `median ${entry.cmax[0]}` },
          { quantity: `tmax (${label})`, units: "h", predicted: plasmaPeak.time, observation: { range: [entry.tmax[1], entry.tmax[2]] }, note: `median ${entry.tmax[0]}` },
        ];
      });
      return { assumption: "Typical 70 kg adult vs the source's simulated 10th-90th percentiles.", rows };
    },
  },
];

/** Run every comparison and return one record per study. */
export function runValidation() {
  return STUDIES.map((study) => {
    const entry = entryById[study.id];
    const { rows, assumption } = study.run();
    return {
      id: study.id,
      source: entry.source,
      location: entry.location,
      independent: entry.independent,
      population: entry.population,
      assumption,
      rows: rows.map((row) => ({ ...row, verdict: row.verdict ?? score(row.predicted, row.observation) })),
    };
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export function formatNumber(value) {
  return Math.abs(value) >= 10 ? value.toFixed(1) : value.toFixed(2);
}

export function renderReport(studies) {
  const counts = {};
  for (const study of studies.filter((item) => item.independent)) {
    for (const row of study.rows) counts[row.verdict] = (counts[row.verdict] ?? 0) + 1;
  }
  const lines = [
    "# Model Validation",
    "",
    "GENERATED by `npm run validate`. Do not edit by hand.",
    "Interpretation: `docs/VALIDATION_FINDINGS.md`.",
    "",
    "Typical-patient predictions compared with published observations",
    "(`src/validation-data.js`). Scoring rules, fixed before comparison:",
    "",
    "- mean +/- SD reported: PASS within 1 SD, ACCEPTABLE within 2 SD, else FAIL",
    "- range only: PASS inside the range, else FAIL",
    "- mean only: PASS within +/-25%, ACCEPTABLE within +/-50%, else FAIL",
    "- INFO: shown for context, not scored (ambiguous design or known limitation)",
    "",
    "A typical-patient prediction is compared with a population mean, so",
    "differences within the reported between-subject spread are expected.",
    "",
    `Independent data summary: ${Object.entries(counts)
      .map(([verdict, count]) => `${verdict} ${count}`)
      .join(", ")}.`,
    "",
  ];
  for (const independent of [true, false]) {
    lines.push(independent ? "## Independent data" : "## Implementation and model-based checks (not independent)", "");
    for (const study of studies.filter((item) => item.independent === independent)) {
      lines.push(`### ${study.id}`, "");
      lines.push(`Source: ${study.source}, ${study.location}. Population: ${study.population}.`, "");
      lines.push(`Assumptions: ${study.assumption}`, "");
      lines.push("| quantity | units | predicted | observed | verdict | note |");
      lines.push("|---|---|---|---|---|---|");
      for (const row of study.rows) {
        const predicted = row.predictedText ?? formatNumber(row.predicted);
        lines.push(`| ${row.quantity} | ${row.units ?? ""} | ${predicted} | ${describeObserved(row.observation)} | ${row.verdict} | ${row.note ?? ""} |`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}
