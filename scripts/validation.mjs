// Write docs/VALIDATION.md from the validation comparisons in
// src/validation.js and print a one-line summary per comparison.
//
// Run with: npm run validate

import { writeFileSync } from "node:fs";

import { describeObserved, formatNumber, renderReport, runValidation } from "../src/validation.js";

const studies = runValidation();
writeFileSync("docs/VALIDATION.md", renderReport(studies));
for (const study of studies) {
  for (const row of study.rows) {
    console.log(
      `${row.verdict.padEnd(10)} ${study.id.padEnd(32)} ${row.quantity.padEnd(48)} pred ${(row.predictedText ?? formatNumber(row.predicted)).padEnd(18)} obs ${describeObserved(row.observation)}`,
    );
  }
}
