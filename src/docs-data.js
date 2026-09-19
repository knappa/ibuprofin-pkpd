// Data for the in-page documentation, derived from parameters.js and
// references.js so the documentation always matches the model.

import { CONSTANTS, PK, PD, DOSE_LIMITS, FORMULATIONS } from "./parameters.js";
import { REFERENCES } from "./references.js";

/** "Authors (year). Title. Journal volume:pages." */
export function formatCitation(reference) {
  const venue = reference.journal
    ? ` ${reference.journal}${reference.volume ? ` ${reference.volume}` : ""}${reference.pages ? `:${reference.pages}` : ""}.`
    : "";
  return `${reference.authors} (${reference.year}). ${reference.title}.${venue}`;
}

/** Links for a reference: DOI, PubMed, PMC, or the source URL. */
export function referenceLinks(reference) {
  const links = [];
  if (reference.doi) links.push({ label: "DOI", href: `https://doi.org/${reference.doi}` });
  if (reference.pmid) links.push({ label: "PubMed", href: `https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/` });
  if (reference.pmcid) links.push({ label: "PMC (free full text)", href: `https://pmc.ncbi.nlm.nih.gov/articles/${reference.pmcid}/` });
  if (!reference.doi && reference.url) links.push({ label: "Source", href: reference.url });
  return links;
}

const ACCESS_LABELS = {
  "full-text": "full text checked",
  abstract: "abstract only",
  label: "FDA label",
  dataset: "data file",
};
export const accessLabel = (access) => ACCESS_LABELS[access] ?? access;

/** Reference keys sorted by first author, then year. */
export function sortedReferenceKeys() {
  return Object.keys(REFERENCES).sort((first, second) => {
    const byAuthor = REFERENCES[first].authors.localeCompare(REFERENCES[second].authors);
    return byAuthor !== 0 ? byAuthor : REFERENCES[first].year - REFERENCES[second].year;
  });
}

const toRows = (group) =>
  Object.entries(group).map(([id, param]) => ({
    id,
    description: param.description,
    value: param.value,
    units: param.units,
    population: param.population ?? "",
    source: param.source,
    location: param.location,
    notes: param.notes ?? "",
  }));

/** Parameter tables, grouped as in parameters.js. */
export function parameterSections() {
  return [
    { title: "Pharmacokinetics", rows: toRows(PK) },
    { title: "Pharmacodynamics", rows: toRows(PD) },
    { title: "Physical constants", rows: toRows(CONSTANTS) },
    { title: "Label dose limits (warnings only)", rows: toRows(DOSE_LIMITS) },
  ];
}

/** Formulation factors on the baseline absorption half-life and lag time. */
export function formulationRows() {
  return Object.entries(FORMULATIONS).map(([id, formulation]) => ({
    id,
    label: formulation.label,
    fastedAbsorption: formulation.fasted.absorptionHalfLifeFactor,
    fastedLag: formulation.fasted.lagTimeFactor,
    fedAbsorption: formulation.fed.absorptionHalfLifeFactor,
    fedLag: formulation.fed.lagTimeFactor,
    source: formulation.source,
    location: formulation.location,
    notes: formulation.notes ?? "",
  }));
}
