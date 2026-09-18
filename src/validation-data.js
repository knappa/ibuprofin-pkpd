// Published observations used to validate the model (Phase 2).
//
// `independent: true` marks data that were NOT used to estimate the model's
// parameters. `independent: false` marks checks that the implementation
// reproduces the source model's own simulations (tests the code, not the
// science).
//
// Values are copied as reported, with location in the source.

export const VALIDATION_DATA = [
  // -------------------------------------------------------------------------
  // Adults
  // -------------------------------------------------------------------------
  {
    id: "blain2002-single",
    source: "blain2002",
    location: "Table 2 (plasma), Table 3 (COX inhibition)",
    independent: true,
    population: "24 healthy men, 20-27 y, height 1.80 +/- 0.08 m, within 20% of ideal weight",
    regimen: {
      formulation: "tablet",
      fed: true,
      notes: "400 mg at 09:00, 12:00 and 20:00 with a light meal (Brufen)",
      doses: [{ timeHours: 0, amountMg: 400 }],
    },
    observations: [
      { quantity: "plasmaConcentration", timeHours: 2.5, mean: 24.0, sd: 8.0, units: "mg/L" },
      { quantity: "cox1Inhibition", timeHours: 2.5, mean: 96, sd: 3, units: "%" },
      { quantity: "cox2Inhibition", timeHours: 2.5, mean: 83, sd: 12, units: "%" },
    ],
    notes: "Sample drawn 2.5 h after the first 09:00 dose. Body weight not reported; assume 70 kg.",
  },

  {
    id: "blain2002-repeated",
    source: "blain2002",
    location: "Table 2 (plasma), Table 3 (COX inhibition)",
    independent: true,
    population: "24 healthy men, 20-27 y",
    regimen: {
      formulation: "tablet",
      fed: true,
      notes:
        "400 mg three times daily at 09:00, 12:00, 20:00; 'steady-state was " +
        "evaluated after ... 2 days of ibuprofen'. Sample 2.5 h after a dose. " +
        "The exact dose sampled (which clock time) is not stated in the " +
        "extracted text; to be confirmed before use.",
      dosingTimesOfDayHours: [9, 12, 20],
      days: 3,
      amountMg: 400,
    },
    observations: [
      { quantity: "plasmaConcentration", timeAfterDoseHours: 2.5, mean: 14.8, sd: 5.9, units: "mg/L" },
      { quantity: "cox1Inhibition", timeAfterDoseHours: 2.5, mean: 90, sd: 16, units: "%" },
      { quantity: "cox2Inhibition", timeAfterDoseHours: 2.5, mean: 76, sd: 20, units: "%" },
    ],
    notes:
      "The repeated-dose concentration is lower than after the single dose, " +
      "which a linear model cannot reproduce. Record the discrepancy rather " +
      "than tuning parameters to it.",
  },

  {
    id: "troconiz2000-adult-suspension",
    source: "troconiz2000",
    location: "Results, Pharmacokinetic Study text (p. 510); Abstract; Fig. 2a",
    independent: true,
    population: "18 healthy adults (10 M / 8 F), 18-45 y, 50-70 kg (mean 62)",
    regimen: {
      formulation: "suspension",
      fed: null,
      bodyWeightKg: 62,
      doses: [{ timeHours: 0, amountMg: 400 }],
    },
    observations: [{ quantity: "tmax", value: 0.5, units: "h", statistic: "mean" }],
    notes:
      "Conflict within the source: the Results text says mean tmax was 0.5 h " +
      "for suspension, the abstract says 0.9 h. Treat tmax 0.5-0.9 h as the " +
      "target. Their own model has ka 0.82 1/h (Table II), much slower than " +
      "morse2022's suspension (2.17 1/h). Fed state not confirmed.",
  },

  {
    id: "li2012-standard-tablet",
    source: "li2012",
    location: "Table I (standard ibuprofen column); Results, Pharmacokinetics",
    independent: true,
    population: "22 adult patients after third molar extraction",
    regimen: {
      formulation: "tablet",
      fed: null,
      notes: "2 x 200 mg Nurofen tablets after surgery",
      doses: [{ timeHours: 0, amountMg: 400 }],
    },
    observations: [
      { quantity: "cmax", mean: 30.7, sd: 8.6, units: "mg/L" },
      { quantity: "tmax", mean: 1.37, sd: 0.86, units: "h" },
      { quantity: "oralClearance", value: 3.66, units: "L/h", statistic: "population estimate (CL/F)" },
      { quantity: "apparentVolume", value: 8.12, units: "L", statistic: "population estimate (V/F), 1-compartment" },
    ],
    notes:
      "Table I footnote: Cmax and Tmax are means of model-predicted " +
      "individual values. Body weight not reported; assume 70 kg. The " +
      "effervescent arm (not modeled here) had Cmax 49.3 mg/L, Tmax 0.32 h.",
  },

  {
    id: "morse2022-table4",
    source: "morse2022",
    location: "Table 4 (simulated medians, 10th-90th percentiles)",
    independent: false,
    population: "Resampled demographics of the 116 study participants",
    regimen: { doses: [{ timeHours: 0, amountMg: 300 }] },
    observations: [
      { formulation: "tablet", fed: false, cmax: [24.1, 13.3, 40.8], tmax: [0.94, 0.48, 1.67] },
      { formulation: "tablet", fed: true, cmax: [20.1, 10.3, 33.3], tmax: [1.2, 0.68, 2.17] },
      { formulation: "suspension", fed: false, cmax: [26.6, 14.8, 45.0], tmax: [0.77, 0.40, 1.50] },
      { formulation: "suspension", fed: true, cmax: [16.2, 8.0, 30.3], tmax: [1.55, 0.82, 2.63] },
      { formulation: "sachet", fed: false, cmax: [34.4, 20.8, 55.7], tmax: [0.38, 0.19, 0.80] },
      { formulation: "sachet", fed: true, cmax: [12.6, 6.14, 23.8], tmax: [1.90, 1.12, 3.21] },
    ],
    notes:
      "Each entry is [median, 10th percentile, 90th percentile]; cmax in " +
      "mg/L, tmax in h. Medians include between-subject variability, so a " +
      "typical-value simulation should fall inside the 10-90% interval but " +
      "need not equal the median.",
  },

  {
    id: "anderson2019-trough",
    source: "anderson2019",
    location: "Methods 2.3 'Determining the target concentration'",
    independent: false,
    population: "Adults (model-based statement)",
    regimen: { amountMg: 400, intervalHours: 8, formulation: "tablet", fed: false },
    observations: [
      { quantity: "effectSiteConcentrationTroughSteadyState", value: 6.3, units: "mg/L", statistic: "model-predicted" },
    ],
    notes:
      "Statement that an effect-site concentration of 6.3 mg/L is 'achieved " +
      "at trough after 400 mg 8 hourly in adults'. The 6.3 mg/L comes from " +
      "TC = C50 x TE / (EMAX - TE) with C50 3.95 mg/L, EMAX 6.5, TE 4 pain " +
      "units, i.e. a Hill coefficient of 1, although the paper quotes Hill " +
      "1.45. Their PK model is not identical to ours; use only as an " +
      "order-of-magnitude check.",
  },

  // -------------------------------------------------------------------------
  // Children
  // -------------------------------------------------------------------------
  {
    id: "nahata1991-5mgkg",
    source: "nahata1991",
    independent: true,
    population: "9 febrile children, age 6.7 +/- 2.5 y",
    regimen: { formulation: "suspension", fed: null, doses: [{ timeHours: 0, amountMgPerKg: 5 }] },
    observations: [
      { quantity: "cmax", mean: 28.4, sd: 7.5, range: [17, 42], units: "mg/L" },
      { quantity: "tmax", mean: 1.1, sd: 0.3, units: "h" },
      { quantity: "oralClearance", mean: 1.2, sd: 0.4, units: "mL/min/kg" },
      { quantity: "halfLife", mean: 1.6, sd: 0.6, units: "h" },
    ],
    location: "Table 1",
    notes: "Investigational ibuprofen liquid. Weights not reported; use CDC median weight for age.",
  },

  {
    id: "nahata1991-10mgkg",
    source: "nahata1991",
    independent: true,
    population: "8 febrile children, age 6.2 +/- 2.1 y",
    regimen: { formulation: "suspension", fed: null, doses: [{ timeHours: 0, amountMgPerKg: 10 }] },
    observations: [
      { quantity: "cmax", mean: 43.6, sd: 18.6, range: [25, 53], units: "mg/L" },
      { quantity: "tmax", mean: 1.2, sd: 0.6, units: "h" },
      { quantity: "oralClearance", mean: 1.4, sd: 0.5, units: "mL/min/kg" },
      { quantity: "halfLife", mean: 1.6, sd: 0.5, units: "h" },
    ],
    location: "Table 1",
  },

  {
    id: "kelley1992",
    source: "kelley1992",
    location: "Table II (total ibuprofen column); Results",
    independent: true,
    population: "18 febrile children, 11 months to 11.5 y",
    regimen: {
      formulation: "suspension",
      fed: null,
      notes: "PediaProfen liquid",
      doses: [{ timeHours: 0, amountMgPerKg: 6 }],
    },
    observations: [
      { quantity: "cmax", value: 26.67, units: "mg/L", statistic: "mean" },
      { quantity: "tmax", value: 54.05 / 60, units: "h", statistic: "mean (54.05 min)" },
      { quantity: "absorptionHalfLife", value: 16.3, units: "min", statistic: "mean" },
      { quantity: "oralClearance", value: 0.96, units: "mL/min/kg", statistic: "mean (F assumed 1)" },
      { quantity: "apparentVolume", value: 164, units: "mL/kg", statistic: "mean" },
      { quantity: "halfLife", value: 118.2 / 60, units: "h", statistic: "mean (118.2 min)" },
      { quantity: "timeToMaxTemperatureDecrease", value: 183 / 60, units: "h", statistic: "modeled (183 min)" },
    ],
  },

  {
    id: "kauffman1992",
    source: "kauffman1992",
    location: "Methods; Table I; Results",
    independent: true,
    population: "38 febrile infants and children with PK data, 3 months to 10.4 y",
    regimen: {
      formulation: "suspension",
      fed: false,
      notes: "20 mg/mL suspension; nothing by mouth for 1 h after the dose",
      doses: [{ timeHours: 0, amountMgPerKg: 8 }],
    },
    observations: [
      { quantity: "cmax", mean: 35.8, sd: 16.7, units: "mg/L" },
      { quantity: "tmax", mean: 0.7, sd: 0.5, units: "h" },
      { quantity: "absorptionHalfLife", mean: 0.3, sd: 0.3, units: "h" },
      { quantity: "halfLife", mean: 1.6, sd: 0.7, units: "h" },
      { quantity: "auc", mean: 102.6, sd: 35.2, units: "mg*h/L" },
      { quantity: "ke0", mean: 0.564, sd: 0.688, units: "1/h" },
      { quantity: "delayPeakConcentrationToPeakTemperatureDecrement", range: [1, 3], units: "h" },
    ],
    notes:
      "Axillary temperatures. AUC implies CL/F = 8 mg/kg / 102.6 mg*h/L = " +
      "0.078 L/h/kg (1.3 mL/min/kg).",
  },

  {
    id: "brown1998-dose-proportionality",
    source: "brown1998",
    location: "Abstract",
    independent: true,
    population: "Febrile children",
    regimen: { notes: "Single dose 5 mg/kg vs 10 mg/kg" },
    observations: [{ quantity: "aucRatio10vs5", value: 1.5, units: "ratio" }],
    notes:
      "A linear model predicts 2.0. nahata1991 found no dose effect over " +
      "the same range. Known limitation; report, do not fit.",
  },
];
