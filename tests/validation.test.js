import { test } from "node:test";
import assert from "node:assert/strict";

import { runValidation, VERDICT } from "../src/validation.js";

// Comparisons that fail for documented reasons (docs/VALIDATION_FINDINGS.md).
// If one of these starts passing, update this list and the findings.
const KNOWN_FAILURES = new Set(["blain2002-single: cox1Inhibition at 2.5 h"]);

const studies = runValidation();
const rowKey = (study, row) => `${study.id}: ${row.quantity}`;

test("no independent comparison fails except documented known failures", () => {
  const unexpected = [];
  for (const study of studies.filter((item) => item.independent)) {
    for (const row of study.rows) {
      if (row.verdict === VERDICT.fail && !KNOWN_FAILURES.has(rowKey(study, row))) unexpected.push(rowKey(study, row));
    }
  }
  assert.deepEqual(unexpected, []);
});

test("known failures still fail (keep the list accurate)", () => {
  const stillFailing = new Set();
  for (const study of studies) {
    for (const row of study.rows) {
      if (row.verdict === VERDICT.fail) stillFailing.add(rowKey(study, row));
    }
  }
  for (const key of KNOWN_FAILURES) assert.ok(stillFailing.has(key), `${key} no longer fails`);
});

test("the typical adult stays inside morse2022's simulated 10th-90th percentiles", () => {
  const morse = studies.find((study) => study.id === "morse2022-table4");
  for (const row of morse.rows) assert.equal(row.verdict, VERDICT.pass, row.quantity);
});
