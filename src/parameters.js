// Single source of truth for every numeric parameter used by the model.
//
// Values are stored exactly as reported in the cited source, in the source's
// units. Any conversion (half-life to rate constant, micromolar to mg/L,
// whole-blood to plasma concentration) is done in the model code and
// described in the `notes` field here, so each number can be checked against
// the paper directly.
//
// Every entry must have `source` (a key in references.js) and `location`
// (table, figure, or section of that source). The test suite enforces this.

// ---------------------------------------------------------------------------
// Physical constants
// ---------------------------------------------------------------------------

export const CONSTANTS = {
  molecularWeight: {
    value: 206.28,
    units: "g/mol",
    description: "Molecular weight of ibuprofen (C13H18O2)",
    source: "pubchem3672",
    location: "Computed properties: Molecular Weight",
    notes: "Used to convert micromolar IC50 values to mg/L.",
  },
};

// ---------------------------------------------------------------------------
// Pharmacokinetics: two-compartment disposition, first-order absorption with
// lag time. Size scaling: theory-based allometry to a 70 kg reference.
// ---------------------------------------------------------------------------

export const PK = {
  referenceWeight: {
    value: 70,
    units: "kg",
    description: "Reference body weight for allometric scaling",
    source: "morse2022",
    location: "Methods, Pharmacokinetic Modelling, Eq. 1 and Eq. 5",
  },

  allometricExponentClearance: {
    value: 0.75,
    units: "dimensionless",
    description: "Allometric exponent applied to clearances (CL, Q)",
    source: "morse2022",
    location: "Methods, Pharmacokinetic Modelling: 'fixed at 3/4 for clearance parameters'",
  },

  allometricExponentVolume: {
    value: 1,
    units: "dimensionless",
    description: "Allometric exponent applied to volumes (V1, V2)",
    source: "morse2022",
    location: "Methods, Pharmacokinetic Modelling: 'and 1 for distribution volumes'",
  },

  clearance: {
    value: 3.79,
    units: "L/h per 70 kg",
    description: "Elimination clearance (CL), typical value for a 70 kg adult",
    population: "116 healthy adults, 18-49 y, 49-116 kg (93 M / 23 F)",
    source: "morse2022",
    location: "Table 3",
    notes:
      "Morse et al. scaled CL by normal fat mass (NFM, FFATCL = 0.863). This " +
      "model scales by total body weight so that it applies to children, " +
      "where the adult fat-free-mass equation is not valid. For a 70 kg, " +
      "1.76 m male, NFM equals the reference and the two agree exactly. " +
      "Independent check: anderson2019 pooled 30 studies (neonates to " +
      "adults) using weight-based allometry and found 3.81 L/h/70 kg. " +
      "REVIEW-LATER (adult-cmax-bias): predicted adult Cmax runs about " +
      "20-25% below observed means; see docs/VALIDATION_FINDINGS.md.",
  },

  centralVolume: {
    value: 6.05,
    units: "L per 70 kg",
    description: "Central volume of distribution (V1)",
    population: "116 healthy adults, 18-49 y, 49-116 kg",
    source: "morse2022",
    location: "Table 3",
    notes:
      "The abstract of morse2022 states 'central volume of distribution ... " +
      "10.5 L/h/70 kg' for ibuprofen. Table 3 assigns 10.5 to Q2 and 6.05 " +
      "to V1; the table is used here.",
  },

  intercompartmentalClearance: {
    value: 10.5,
    units: "L/h per 70 kg",
    description: "Intercompartmental clearance (Q2)",
    population: "116 healthy adults, 18-49 y, 49-116 kg",
    source: "morse2022",
    location: "Table 3",
  },

  peripheralVolume: {
    value: 4.37,
    units: "L per 70 kg",
    description: "Peripheral volume of distribution (V2)",
    population: "116 healthy adults, 18-49 y, 49-116 kg",
    source: "morse2022",
    location: "Table 3",
  },

  bioavailability: {
    value: 0.941,
    units: "fraction",
    description: "Oral bioavailability (FIBU), all oral formulations",
    population: "116 healthy adults; IV reference data available",
    source: "morse2022",
    location: "Table 3",
  },

  absorptionHalfLife: {
    value: 26.7,
    units: "min",
    description: "Absorption half-life, tablet, fasted (baseline formulation)",
    population: "Healthy adults",
    source: "morse2022",
    location: "Table 3",
    notes: "Converted to a first-order rate constant: k_a = ln(2) / t_half.",
  },

  lagTime: {
    value: 6.66,
    units: "min",
    description: "Absorption lag time, tablet, fasted (baseline formulation)",
    population: "Healthy adults",
    source: "morse2022",
    location: "Table 3",
  },

  maturationHalfTime: {
    value: 36.8,
    units: "weeks postmenstrual age",
    description: "Clearance maturation half-time (TM50), Hill maturation function",
    population: "Pooled published clearances, premature neonates to adults",
    source: "anderson2019",
    location: "Table 1; maturation equation (MF) in Methods 2.2",
    notes:
      "MF = PMA^Hill / (TM50^Hill + PMA^Hill), as printed in the paper, with " +
      "PMA = postnatal age + 40 weeks for a term birth. At the youngest " +
      "supported age (6 months, PMA about 66 weeks) MF = 0.999, so it has " +
      "almost no effect within the supported range. Included for completeness.",
  },

  maturationHill: {
    value: 11.9,
    units: "dimensionless",
    description: "Hill coefficient of the clearance maturation function",
    population: "Pooled published clearances, premature neonates to adults",
    source: "anderson2019",
    location: "Table 1",
    notes:
      "The abstract states 11.5; Table 1 states 11.9 (same 95% CI 8.1-15.0 " +
      "in both). The table value is used. Both reproduce the paper's " +
      "checkpoints (about 90% of adult at 44 weeks PMA, 98% at 53 weeks).",
  },
};

// ---------------------------------------------------------------------------
// Formulation and feeding effects on absorption. Factors multiply the
// baseline (tablet, fasted) absorption half-life and lag time.
// ---------------------------------------------------------------------------

export const FORMULATIONS = {
  tablet: {
    label: "Tablet",
    fasted: { absorptionHalfLifeFactor: 1, lagTimeFactor: 1 },
    fed: { absorptionHalfLifeFactor: 1.59, lagTimeFactor: 3.65 },
    source: "morse2022",
    location: "Table 3 (F_FED_TABS, F_FED_LAG for tablet; fasted tablet is the reference)",
  },

  suspension: {
    label: "Oral suspension",
    fasted: { absorptionHalfLifeFactor: 0.719, lagTimeFactor: 0.984 },
    fed: { absorptionHalfLifeFactor: 2.45, lagTimeFactor: 2.52 },
    source: "morse2022",
    location: "Table 3 (F_FAST_TABS, F_FAST_LAG, F_FED_TABS, F_FED_LAG for suspension)",
    notes:
      "Adult data (fixed-dose acetaminophen/ibuprofen suspension). Applied " +
      "to children without a pediatric-specific absorption estimate; checked " +
      "against pediatric Tmax in validation.",
  },

  sachet: {
    label: "Sachet (powder dissolved in water)",
    fasted: { absorptionHalfLifeFactor: 0.235, lagTimeFactor: 0.539 },
    fed: { absorptionHalfLifeFactor: 3.79, lagTimeFactor: 0.178 },
    source: "morse2022",
    location: "Table 3 (F_FAST_TABS, F_FAST_LAG, F_FED_TABS, F_FED_LAG for sachet)",
    notes:
      "The fed lag-time factor (0.178) is less than 1, meaning a shorter lag " +
      "when fed, unlike every other formulation. This is the reported value " +
      "(bootstrap 95% CI 0.101-0.180); the paper does not discuss it.",
  },
};

// ---------------------------------------------------------------------------
// Pharmacodynamics
// ---------------------------------------------------------------------------

export const PD = {
  // COX-1 and COX-2 inhibition: direct sigmoid model on total plasma
  // concentration. In vitro human whole blood assay; concentrations were
  // converted from whole blood to plasma by the source authors' measured
  // correcting factor. IC50 and IC80 are from mean concentration-response
  // curves (Table 1, footnote b).
  cox1IC50: {
    value: 4.30,
    units: "uM (whole blood)",
    description: "COX-1 (platelet TXB2) IC50, mean concentration-response curve",
    population: "Blood from 24 healthy men, 20-27 y",
    source: "blain2002",
    location: "Table 1, column IC50 (b)",
    notes:
      "Plasma IC50 = 4.30 uM x 1.65 (whole-blood-to-plasma factor) x 206.28 " +
      "g/mol / 1000 = 1.46 mg/L. Cross-check: warner1999 Table 1 reports " +
      "7.6 uM in a similar assay.",
  },

  cox1IC80: {
    value: 40.8,
    units: "uM (whole blood)",
    description: "COX-1 IC80, mean concentration-response curve",
    population: "Blood from 24 healthy men, 20-27 y",
    source: "blain2002",
    location: "Table 1, column IC80 (b)",
    notes:
      "Hill slope derived as n = ln(4) / ln(IC80 / IC50) = 0.616, assuming " +
      "inhibition runs from 0% to 100%. The source fit a four-parameter " +
      "logistic whose upper and lower plateaus are not reported, so this is " +
      "an approximation.",
  },

  cox2IC50: {
    value: 10.0,
    units: "uM (whole blood)",
    description: "COX-2 (monocyte LPS-induced PGE2) IC50, mean concentration-response curve",
    population: "Blood from 24 healthy men, 20-27 y",
    source: "blain2002",
    location: "Table 1, column IC50 (b)",
    notes:
      "Plasma IC50 = 10.0 x 1.65 x 206.28 / 1000 = 3.40 mg/L. Cross-check: " +
      "warner1999 Table 1 reports 7.2 uM (WBA-COX-2).",
  },

  cox2IC80: {
    value: 74.9,
    units: "uM (whole blood)",
    description: "COX-2 IC80, mean concentration-response curve",
    population: "Blood from 24 healthy men, 20-27 y",
    source: "blain2002",
    location: "Table 1, column IC80 (b)",
    notes: "Hill slope n = ln(4) / ln(74.9 / 10.0) = 0.688 (same caveat as COX-1).",
  },

  wholeBloodToPlasmaFactor: {
    value: 1.65,
    units: "dimensionless",
    description:
      "Measured ratio of plasma to nominal whole-blood ibuprofen concentration " +
      "in the in vitro assay",
    population: "Blood from 24 healthy men, haematocrit 0.44",
    source: "blain2002",
    location: "Results, 'Transformation of whole blood into plasma drug concentration'",
    notes:
      "Plasma concentration = whole-blood concentration x 1.65. Lower than " +
      "the 1.81 expected if the drug were excluded from red cells.",
  },

  // Analgesia: effect compartment plus fractional sigmoid Emax model.
  // Pain score = baseline x (1 - E).
  analgesiaEmax: {
    value: 0.648,
    units: "fraction of baseline pain score",
    description: "Maximum fractional reduction in pain score",
    population:
      "Children 2-12 y, >= 10 kg, after (adeno)tonsillectomy, pooled with " +
      "published mean adult dental-pain data (Mehlisch et al.)",
    source: "hannam2018",
    location: "Table 2; model equations in Methods 2.7.4 and Final pharmacodynamic model",
    notes:
      "Estimated jointly with acetaminophen and tramadol under an additive " +
      "interaction; EMAX is shared across drugs. A child-vs-adult factor " +
      "(FADULT) found no difference between pediatric and adult PD " +
      "parameters (Methods 2.7.6; Results). Also reproduced in morse2022 " +
      "Supplementary Table S3. REVIEW-LATER (analgesia-equation-form): the " +
      "paper prints EMAX * U^Hill / (1 + U)^Hill but defines C50 as the " +
      "half-maximal concentration; the standard form EMAX * U^Hill / " +
      "(1 + U^Hill) is used, treating the print as a typo.",
  },

  analgesiaEC50: {
    value: 3.95,
    units: "mg/L (effect site)",
    description: "Effect-site concentration producing half of Emax",
    population: "Children 2-12 y after (adeno)tonsillectomy, pooled with adult dental-pain data",
    source: "hannam2018",
    location: "Table 2",
  },

  analgesiaHill: {
    value: 1.48,
    units: "dimensionless",
    description: "Hill coefficient of the analgesia model",
    population: "Children 2-12 y after (adeno)tonsillectomy, pooled with adult dental-pain data",
    source: "hannam2018",
    location: "Table 2",
  },

  analgesiaEquilibrationHalfTime: {
    value: 1.04,
    units: "h",
    description: "Plasma-effect site equilibration half-time (t1/2 keo)",
    population: "Children 2-12 y after (adeno)tonsillectomy, pooled with adult dental-pain data",
    source: "hannam2018",
    location: "Table 2",
    notes:
      "k_e0 = ln(2) / 1.04 h = 0.667 1/h. Cross-checks: adult dental pain " +
      "t1/2 keo 1.16 h (hannam2011 Table 1) and k_e0 1.49 1/h, i.e. 28 min " +
      "(li2012 Table II); pediatric antipyresis k_e0 0.564 1/h " +
      "(kauffman1992 Table I) and 0.57-0.70 1/h (brown1998).",
  },

  // Antipyresis: indirect response model on body temperature (degrees C),
  // driven by plasma concentration:
  //   dT/dt = k_syn * (1 - Emax * C^n / (EC50^n + C^n)) - k_out * T
  // with k_syn = k_out * T0 so that T = T0 without drug.
  antipyresisEmax: {
    value: 0.055,
    units: "fraction of k_syn",
    description: "Maximum fractional inhibition of the temperature synthesis rate",
    population:
      "PD: 103 febrile children, 4-16 y, 25-70 kg, axillary baseline " +
      "38.0-40.2 C. Concentrations driving the PD fit were predicted from " +
      "the typical PK model of 18 healthy adults (50-70 kg), scaled " +
      "allometrically to each child's weight; not measured in the children.",
    source: "troconiz2000",
    location: "Table V; model equation on p. 510; Table I (population)",
    notes:
      "Relative standard error of Emax is 0.43 (imprecise). Because Emax is " +
      "a fraction of the temperature itself, the equation must be evaluated " +
      "in degrees C: the maximum steady-state drop from 38.8 C is " +
      "0.055 x 38.8 = 2.1 C. The paper reports k_syn = k_out x T0 = 45.4 C/h.",
  },

  antipyresisEC50: {
    value: 6.18,
    units: "mg/L (plasma)",
    description: "Plasma concentration producing half of Emax",
    population: "Febrile children, 4-16 y, 25-70 kg",
    source: "troconiz2000",
    location: "Table V; Discussion ('EC50 was estimated to be 6.18 mg/L')",
    notes: "The abstract states 6.16 mg/L; Table V and the Discussion both state 6.18.",
  },

  antipyresisHill: {
    value: 2.71,
    units: "dimensionless",
    description: "Slope parameter n of the antipyresis model",
    population: "Febrile children, 4-16 y, 25-70 kg",
    source: "troconiz2000",
    location: "Table V",
  },

  antipyresisKout: {
    value: 1.17,
    units: "1/h",
    description: "First-order rate constant of loss (k_out)",
    population: "Febrile children, 4-16 y, 25-70 kg",
    source: "troconiz2000",
    location: "Table V",
  },

  antipyresisBaselineTemperature: {
    value: 38.8,
    units: "degrees C",
    description: "Typical baseline (febrile) temperature T0; default for the user input",
    population: "Febrile children, 4-16 y, 25-70 kg",
    source: "troconiz2000",
    location: "Table V",
    notes: "38.8 C = 101.8 F. The user can change the baseline.",
  },
};

// ---------------------------------------------------------------------------
// Source populations, used to label plots as "extrapolated" outside these
// ranges.
// ---------------------------------------------------------------------------

export const PK_SOURCE_POPULATION = {
  description: "Healthy adults 18-49 y, 49-116 kg",
  minAgeYears: 18,
  minWeightKg: 49,
  maxWeightKg: 116,
  source: "morse2022",
  location: "Table 1 (median and range)",
};

export const PD_SOURCE_POPULATIONS = {
  cox: {
    description: "In vitro whole blood from healthy men aged 20-27",
    minAgeYears: 18,
    maxAgeYears: null,
    minWeightKg: null,
    source: "blain2002",
  },
  analgesia: {
    description:
      "Children 2-12 y (>= 10 kg) after tonsillectomy, pooled with adult " +
      "dental-pain data; no child-adult difference detected",
    minAgeYears: 2,
    maxAgeYears: null,
    minWeightKg: 10,
    source: "hannam2018",
    notes:
      "No adolescents (13-17 y) in either data set; they fall between two " +
      "covered groups and are not labeled extrapolated.",
  },
  antipyresis: {
    description: "Febrile children aged 4-16 years, body weight 25-70 kg",
    minAgeYears: 4,
    maxAgeYears: 16,
    minWeightKg: 25,
    maxWeightKg: 70,
    source: "troconiz2000",
  },
};

// ---------------------------------------------------------------------------
// Labeled dose limits (for warnings only; the model does not use them).
// ---------------------------------------------------------------------------

export const DOSE_LIMITS = {
  adultOtcDaily: {
    value: 1200,
    units: "mg per 24 h",
    description: "OTC maximum for adults and children 12 years and over: 6 x 200 mg tablets in 24 h",
    source: "labelAdvil",
    location: "Drug Facts, Directions",
  },
  adultRxDaily: {
    value: 3200,
    units: "mg per day",
    description: "Prescription maximum total daily dose for adults",
    source: "labelIbuprofenTabletsRx",
    location: "Dosage and Administration",
  },
  pediatricDailyPerKg: {
    value: 40,
    units: "mg/kg per day",
    description: "Recommended maximum daily dose in children (6 months and older)",
    source: "labelIbuprofenSuspensionRx",
    location: "Dosage and Administration, Pediatric Patients",
  },
  pediatricDailyAbsolute: {
    value: 2400,
    units: "mg per day",
    description: "Pediatric daily cap: 40 mg/kg or 2400 mg, whichever is less (6 months to 17 years)",
    source: "labelCaldolor",
    location: "Section 2 Dosage and Administration",
    notes: "IV product label; used as the cap on the mg/kg limit for heavier children.",
  },
  pediatricMaxAgeYears: {
    value: 17,
    units: "years",
    description: "Oldest age covered by the pediatric daily limit ('6 months to 17 years of age')",
    source: "labelCaldolor",
    location: "Section 2 Dosage and Administration",
  },
  otcAdultMinAgeYears: {
    value: 12,
    units: "years",
    description: "Youngest age for adult OTC directions ('adults and children 12 years and over')",
    source: "labelAdvil",
    location: "Drug Facts, Directions",
  },
  pediatricSingleDosePerKg: {
    value: 10,
    units: "mg/kg",
    description: "Highest single dose on the pediatric Rx label (fever >= 102.5 F, or analgesia)",
    source: "labelIbuprofenSuspensionRx",
    location: "Dosage and Administration, Pediatric Patients",
  },
  pediatricDosesPerDay: {
    value: 4,
    units: "doses per 24 h",
    description: "OTC pediatric products: repeat every 6-8 h, no more than 4 times a day",
    source: "labelChildrensMotrin",
    location: "Drug Facts, Directions",
  },
  minimumAgeMonths: {
    value: 6,
    units: "months",
    description: "Minimum age on OTC labeling ('under 6 mos: ask a doctor')",
    source: "labelInfantsMotrin",
    location: "Drug Facts, Directions, dosing chart",
  },
  linearityNote: {
    value: 800,
    units: "mg (single dose)",
    description: "Label statement: linear blood level dose-response with single doses up to 800 mg",
    source: "labelIbuprofenTabletsRx",
    location: "Dosage and Administration",
    notes:
      "The model is linear. Above 800 mg single doses, total concentrations " +
      "are expected to rise less than proportionally (lockwood1983).",
  },
};
