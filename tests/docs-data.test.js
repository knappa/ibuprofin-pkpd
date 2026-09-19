import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatCitation,
  formulationRows,
  parameterSections,
  referenceLinks,
  sortedReferenceKeys,
} from "../src/docs-data.js";
import { REFERENCES } from "../src/references.js";
import { FORMULATIONS } from "../src/parameters.js";

test("every documented parameter cites a known reference", () => {
  const rows = parameterSections().flatMap((section) => section.rows);
  assert.ok(rows.length > 30);
  for (const row of rows) assert.ok(row.source in REFERENCES, `${row.id}: ${row.source}`);
  for (const row of formulationRows()) assert.ok(row.source in REFERENCES, row.id);
  assert.equal(formulationRows().length, Object.keys(FORMULATIONS).length);
});

test("citations and links are formatted from the bibliography", () => {
  assert.equal(
    formatCitation(REFERENCES.kauffman1992),
    "Kauffman RE, Nelson MV (1992). Effect of age on ibuprofen pharmacokinetics and antipyretic response. " +
      "J Pediatr 121(6):969-973.",
  );
  const links = referenceLinks(REFERENCES.morse2022).map((link) => link.href);
  assert.deepEqual(links, [
    "https://doi.org/10.1007/s13318-022-00766-9",
    "https://pubmed.ncbi.nlm.nih.gov/35366213/",
    "https://pmc.ncbi.nlm.nih.gov/articles/PMC9232434/",
  ]);
  assert.equal(referenceLinks(REFERENCES.labelAdvil)[0].label, "Source");
});

test("the bibliography lists every reference once, sorted by author", () => {
  const keys = sortedReferenceKeys();
  assert.equal(new Set(keys).size, Object.keys(REFERENCES).length);
  for (let idx = 1; idx < keys.length; idx++) {
    assert.ok(REFERENCES[keys[idx - 1]].authors.localeCompare(REFERENCES[keys[idx]].authors) <= 0);
  }
});
