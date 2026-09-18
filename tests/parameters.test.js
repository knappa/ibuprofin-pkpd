import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  CONSTANTS,
  PK,
  FORMULATIONS,
  PD,
  PD_SOURCE_POPULATIONS,
  DOSE_LIMITS,
} from "../src/parameters.js";
import { REFERENCES } from "../src/references.js";
import { VALIDATION_DATA } from "../src/validation-data.js";

const NUMERIC_GROUPS = { CONSTANTS, PK, PD, DOSE_LIMITS };

test("every numeric parameter has a finite value, units, a known source, and a location", () => {
  for (const [groupName, group] of Object.entries(NUMERIC_GROUPS)) {
    for (const [paramName, param] of Object.entries(group)) {
      const label = `${groupName}.${paramName}`;
      assert.ok(Number.isFinite(param.value), `${label}: value must be a finite number`);
      assert.ok(param.units, `${label}: missing units`);
      assert.ok(param.source in REFERENCES, `${label}: unknown source "${param.source}"`);
      assert.ok(param.location, `${label}: missing location`);
    }
  }
});

test("every formulation has a known source, a location, and positive factors", () => {
  for (const [name, formulation] of Object.entries(FORMULATIONS)) {
    assert.ok(formulation.source in REFERENCES, `${name}: unknown source`);
    assert.ok(formulation.location, `${name}: missing location`);
    for (const state of ["fasted", "fed"]) {
      for (const factor of Object.values(formulation[state])) {
        assert.ok(Number.isFinite(factor) && factor > 0, `${name}.${state}: bad factor ${factor}`);
      }
    }
  }
});

test("PD source populations and validation data cite known references", () => {
  for (const [name, population] of Object.entries(PD_SOURCE_POPULATIONS)) {
    assert.ok(population.source in REFERENCES, `${name}: unknown source`);
  }
  for (const entry of VALIDATION_DATA) {
    assert.ok(entry.source in REFERENCES, `${entry.id}: unknown source`);
    assert.ok(entry.location, `${entry.id}: missing location`);
  }
});

test("every reference has a title and a resolvable identifier", () => {
  for (const [key, ref] of Object.entries(REFERENCES)) {
    assert.ok(ref.title, `${key}: missing title`);
    assert.ok(ref.doi || ref.url, `${key}: needs a DOI or URL`);
    assert.ok(ref.access, `${key}: missing access level`);
  }
});

function listFiles(dirPath) {
  return readdirSync(dirPath).flatMap((name) => {
    const fullPath = join(dirPath, name);
    return statSync(fullPath).isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

test("source and documentation files are ASCII only", () => {
  const files = [...listFiles("src"), ...listFiles("docs"), ...listFiles("tests"), "PLAN.md"];
  for (const filePath of files) {
    const text = readFileSync(filePath, "utf8");
    const match = text.match(/[^\x00-\x7F]/);
    assert.equal(match, null, `${filePath}: non-ASCII character ${JSON.stringify(match?.[0])}`);
  }
});
