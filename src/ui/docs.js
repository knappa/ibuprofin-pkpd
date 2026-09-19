// Renders the "How the model works" section: diagram, equations (MathML),
// parameter tables, live validation results, limitations, and references.
// Everything numeric comes from parameters.js, references.js and the
// validation module, so this section cannot drift from the model.

import { REFERENCES } from "../references.js";
import { PK } from "../parameters.js";
import {
  accessLabel,
  formatCitation,
  formulationRows,
  parameterSections,
  referenceLinks,
  sortedReferenceKeys,
} from "../docs-data.js";
import { describeObserved, formatNumber, runValidation, VERDICT } from "../validation.js";

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
const SVG_NS = "http://www.w3.org/2000/svg";

// ---------------------------------------------------------------------------
// Small DOM helpers
// ---------------------------------------------------------------------------

function element(tag, { className, text, attributes } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attributes ?? {})) node.setAttribute(name, value);
  for (const child of children) node.append(child);
  return node;
}

function sourceLink(key) {
  const reference = REFERENCES[key];
  const link = element("a", { text: key, attributes: { href: `#ref-${key}` } });
  if (reference) link.title = formatCitation(reference);
  return link;
}

function table(headers, rows, className = "docs-table") {
  const tableElement = element("table", { className });
  const headRow = tableElement.createTHead().insertRow();
  for (const header of headers) headRow.append(element("th", { text: header, attributes: { scope: "col" } }));
  const body = tableElement.createTBody();
  for (const cells of rows) {
    const row = body.insertRow();
    for (const cell of cells) {
      const td = row.insertCell();
      if (cell instanceof Node) td.append(cell);
      else td.textContent = cell;
    }
  }
  return element("div", { className: "table-scroll" }, [tableElement]);
}

// ---------------------------------------------------------------------------
// MathML builder
// ---------------------------------------------------------------------------

function mathNode(tag, children = [], text) {
  const node = document.createElementNS(MATHML_NS, tag);
  if (text !== undefined) node.textContent = text;
  for (const child of children) node.append(child);
  return node;
}

const m = {
  id: (name) => mathNode("mi", [], name),
  op: (symbol) => mathNode("mo", [], symbol),
  num: (value) => mathNode("mn", [], value),
  text: (value) => mathNode("mtext", [], value),
  row: (...children) => mathNode("mrow", children),
  frac: (numerator, denominator) => mathNode("mfrac", [numerator, denominator]),
  sub: (base, subscript) => mathNode("msub", [base, subscript]),
  sup: (base, superscript) => mathNode("msup", [base, superscript]),
  paren: (...children) => mathNode("mrow", [mathNode("mo", [], "("), ...children, mathNode("mo", [], ")")]),
};
// Subscripted identifier, e.g. v("C", "p") for C_p.
const v = (base, subscript) => m.sub(m.id(base), m.id(subscript));
const d = (numerator) => m.frac(m.row(m.id("d"), numerator), m.row(m.id("d"), m.id("t")));

function equation(...children) {
  const math = mathNode("math", [m.row(...children)]);
  math.setAttribute("display", "block");
  return math;
}

// Sigmoid term C^n / (C50^n + C^n). A DOM node can only appear once, so
// repeated parts are cloned.
const sigmoid = (concentration, halfConcentration, exponent) =>
  m.frac(
    m.sup(concentration, exponent),
    m.row(m.sup(halfConcentration, exponent.cloneNode(true)), m.op("+"), m.sup(concentration.cloneNode(true), exponent.cloneNode(true))),
  );

function equations() {
  // Factories: each use needs its own DOM node.
  const cp = () => v("C", "p");
  const ce = () => v("C", "e");
  const sizeRatio = (exponent) => m.sup(m.paren(m.frac(m.id("WT"), m.num(String(PK.referenceWeight.value)))), exponent);
  return [
    {
      title: "Absorption (one gut compartment per dose i)",
      math: [
        equation(d(v("A", "gut,i")), m.op("="), m.op("\u2212"), v("k", "a,i"), v("A", "gut,i")),
        equation(v("k", "a,i"), m.op("="), m.frac(m.row(m.id("ln"), m.num("2")), m.row(v("t", "1/2,abs"), m.op("\u00b7"), v("f", "abs"))), m.op(","), m.text("\u2003"), v("t", "lag,i"), m.op("="), v("t", "lag"), m.op("\u00b7"), v("f", "lag")),
      ],
      text:
        "Dose i adds F x dose to its gut compartment after its lag time. The factors f_abs and f_lag depend on the " +
        "formulation and on whether the dose was taken with food.",
    },
    {
      title: "Distribution and elimination (two compartments)",
      math: [
        equation(d(v("A", "c")), m.op("="), m.row(m.op("\u2211"), v("k", "a,i"), v("A", "gut,i")), m.op("\u2212"), m.frac(m.id("CL"), v("V", "1")), v("A", "c"), m.op("\u2212"), m.frac(m.id("Q"), v("V", "1")), v("A", "c"), m.op("+"), m.frac(m.id("Q"), v("V", "2")), v("A", "p")),
        equation(d(v("A", "p")), m.op("="), m.frac(m.id("Q"), v("V", "1")), v("A", "c"), m.op("\u2212"), m.frac(m.id("Q"), v("V", "2")), v("A", "p"), m.op(","), m.text("\u2003"), cp(), m.op("="), m.frac(v("A", "c"), v("V", "1"))),
      ],
      text: "C_p is the total (bound plus unbound) plasma concentration, in mg/L.",
    },
    {
      title: "Body size and age",
      math: [
        equation(m.id("CL"), m.op("="), v("CL", "std"), sizeRatio(m.frac(m.num("3"), m.num("4"))), m.id("MF"), m.op(","), m.text("\u2003"), m.id("Q"), m.op("="), v("Q", "std"), sizeRatio(m.frac(m.num("3"), m.num("4"))), m.op(","), m.text("\u2003"), m.id("V"), m.op("="), v("V", "std"), m.paren(m.frac(m.id("WT"), m.num(String(PK.referenceWeight.value))))),
        equation(m.id("MF"), m.op("="), sigmoid(m.id("PMA"), v("TM", "50"), m.id("h")), m.op(","), m.text("\u2003"), m.id("PMA"), m.op("="), m.text("age in weeks"), m.op("+"), m.num("40")),
      ],
      text:
        `Weight-based (allometric) scaling from a ${PK.referenceWeight.value} kg adult.` + " The maturation factor MF is essentially 1 from 6 months of age.",
    },
    {
      title: "COX-1 and COX-2 inhibition (direct effect)",
      math: [equation(v("I", "COX"), m.op("="), m.num("100"), m.op("%"), m.op("\u00b7"), sigmoid(cp(), v("IC", "50"), m.id("n")))],
      text: "Whole-blood IC50 values converted to plasma concentrations; one curve each for COX-1 and COX-2.",
    },
    {
      title: "Pain relief (effect compartment)",
      math: [
        equation(d(ce()), m.op("="), v("k", "e0"), m.paren(cp(), m.op("\u2212"), ce())),
        equation(m.id("E"), m.op("="), v("E", "max"), sigmoid(ce(), v("C", "50"), m.id("h")), m.op(","), m.text("\u2003"), m.text("pain score"), m.op("="), m.text("baseline"), m.op("\u00b7"), m.paren(m.num("1"), m.op("\u2212"), m.id("E"))),
      ],
      text:
        "Relief lags the plasma level because the drug must reach its site of action. Review pending: the source paper " +
        "prints a different form of this equation; see the limitations below.",
    },
    {
      title: "Fever reduction (indirect response)",
      math: [
        equation(d(m.id("T")), m.op("="), v("k", "out"), v("T", "0"), m.paren(m.num("1"), m.op("\u2212"), v("E", "max"), sigmoid(cp(), v("EC", "50"), m.id("n"))), m.op("\u2212"), v("k", "out"), m.id("T")),
      ],
      text:
        "The drug slows the process that keeps temperature raised, so temperature falls gradually and bottoms out " +
        "hours after the plasma peak. Computed in degrees C; without drug, T stays at the starting temperature T0.",
    },
  ];
}

// ---------------------------------------------------------------------------
// Compartment diagram
// ---------------------------------------------------------------------------

function svg(tag, attributes = {}, parent = null, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  if (parent) parent.append(node);
  return node;
}

function diagram() {
  const root = svg("svg", {
    viewBox: "0 0 720 250",
    class: "model-diagram",
    role: "img",
    "aria-label":
      "Diagram: each dose enters a gut compartment, is absorbed into the central compartment, exchanges with a " +
      "peripheral compartment and is eliminated. Plasma concentration drives COX inhibition and temperature; the " +
      "effect-site concentration drives pain relief.",
  });
  const defs = svg("defs", {}, root);
  const marker = svg("marker", { id: "arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
  svg("path", { d: "M0,0 L10,5 L0,10 z", class: "diagram-arrowhead" }, marker);

  const box = (x, y, width, title, subtitle, kind = "pk") => {
    svg("rect", { x, y, width, height: 54, rx: 8, class: `diagram-box ${kind}` }, root);
    svg("text", { x: x + width / 2, y: y + 23, class: "diagram-title", "text-anchor": "middle" }, root, title);
    svg("text", { x: x + width / 2, y: y + 41, class: "diagram-subtitle", "text-anchor": "middle" }, root, subtitle);
  };
  const arrow = (x1, y1, x2, y2, label, labelX, labelY) => {
    svg("line", { x1, y1, x2, y2, class: "diagram-arrow", "marker-end": "url(#arrow)" }, root);
    if (label) svg("text", { x: labelX, y: labelY, class: "diagram-label", "text-anchor": "middle" }, root, label);
  };

  box(10, 20, 130, "Gut", "one per dose");
  box(220, 20, 150, "Central", "plasma, V1");
  box(460, 20, 150, "Peripheral", "tissues, V2");
  box(220, 170, 150, "Eliminated", "clearance CL", "sink");
  arrow(140, 47, 218, 47, "ka, lag", 180, 38);
  arrow(370, 40, 458, 40, "Q", 414, 32);
  arrow(460, 56, 372, 56, "", 0, 0);
  arrow(295, 74, 295, 168, "CL", 310, 125);

  box(460, 110, 250, "COX-1 / COX-2 inhibition", "direct, from plasma", "pd");
  box(460, 180, 250, "Temperature", "indirect response", "pd");
  box(10, 110, 170, "Effect site", "ke0 delay -> pain relief", "pd");
  arrow(370, 70, 458, 130, "", 0, 0);
  arrow(360, 74, 458, 196, "", 0, 0);
  arrow(230, 74, 150, 108, "", 0, 0);
  return root;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function parameterTables() {
  const wrapper = element("div");
  for (const section of parameterSections()) {
    wrapper.append(element("h4", { text: section.title }));
    wrapper.append(
      table(
        ["Parameter", "Value", "Units", "Source", "Where in source", "Population / notes"],
        section.rows.map((row) => {
          const details = [row.population, row.notes].filter(Boolean).join(" ");
          return [row.description, String(row.value), row.units, sourceLink(row.source), row.location, details];
        }),
      ),
    );
  }
  wrapper.append(element("h4", { text: "Formulation and food factors" }));
  wrapper.append(
    element("p", {
      className: "docs-hint",
      text:
        `Multiply the baseline absorption half-life (${PK.absorptionHalfLife.value} min) and lag time ` +
        `(${PK.lagTime.value} min) of a fasted tablet.`,
    }),
  );
  wrapper.append(
    table(
      ["Form", "Half-life, fasted", "Lag, fasted", "Half-life, fed", "Lag, fed", "Source", "Notes"],
      formulationRows().map((row) => [
        row.label,
        String(row.fastedAbsorption),
        String(row.fastedLag),
        String(row.fedAbsorption),
        String(row.fedLag),
        sourceLink(row.source),
        row.notes,
      ]),
    ),
  );
  return wrapper;
}

function validationTable() {
  const studies = runValidation();
  const independent = studies.filter((study) => study.independent);
  const counts = {};
  for (const study of independent) {
    for (const row of study.rows) counts[row.verdict] = (counts[row.verdict] ?? 0) + 1;
  }
  const wrapper = element("div");
  wrapper.append(
    element("p", {
      text:
        `Computed live from the model on this page. Independent published data: ${counts[VERDICT.pass] ?? 0} pass, ` +
        `${counts[VERDICT.acceptable] ?? 0} acceptable, ${counts[VERDICT.fail] ?? 0} fail, ` +
        `${counts[VERDICT.info] ?? 0} shown for information. Pass = within 1 SD of the observed mean (or inside the ` +
        "reported range, or within 25% when only a mean is reported); acceptable = within 2 SD (or 50%).",
    }),
  );
  const rows = [];
  for (const study of independent) {
    for (const row of study.rows) {
      rows.push([
        sourceLink(study.source),
        row.quantity,
        `${row.predictedText ?? formatNumber(row.predicted)} ${row.units ?? ""}`.trim(),
        `${describeObserved(row.observation)} ${row.units ?? ""}`.trim(),
        element("span", { className: `verdict ${row.verdict.toLowerCase()}`, text: row.verdict }),
      ]);
    }
  }
  wrapper.append(table(["Study", "Quantity", "Model", "Observed", "Result"], rows));
  return wrapper;
}

const LIMITATIONS = [
  "Typical patient only: real people vary widely around these curves (between-person variability is planned).",
  "Peak concentrations run about 20% below published adult means, and the source model's own simulations do not " +
    "match its parameter table. Marked for review with the source authors.",
  "COX-1 inhibition after a single 400 mg dose is predicted around 83%; measured values were 90-96%.",
  "The pain-relief equation is printed in the source papers in a form that contradicts their own definition of C50. " +
    "The standard form is used here; marked for review with the source authors.",
  "Linear pharmacokinetics: at high doses total concentrations rise less than proportionally (protein binding), " +
    "which the model does not capture.",
  "Racemic ibuprofen is modeled as one drug. The active S-enantiomer and the body's conversion of R to S are a " +
    "planned extension.",
  "Oral suspension absorption comes from adult data; it agrees with pediatric measurements but was not fitted to them.",
  "The pain and fever models hold the underlying illness constant; real pain and fever change on their own.",
];

function limitationsList() {
  return element("ul", {}, LIMITATIONS.map((text) => element("li", { text })));
}

function referencesList() {
  const list = element("ol", { className: "references" });
  for (const key of sortedReferenceKeys()) {
    const reference = REFERENCES[key];
    const item = element("li", { attributes: { id: `ref-${key}` } });
    item.append(element("span", { className: "ref-key", text: `[${key}] ` }));
    item.append(document.createTextNode(`${formatCitation(reference)} `));
    for (const link of referenceLinks(reference)) {
      item.append(element("a", { text: link.label, attributes: { href: link.href, rel: "noreferrer noopener", target: "_blank" } }), " ");
    }
    item.append(element("span", { className: "ref-access", text: `(${accessLabel(reference.access)})` }));
    list.append(item);
  }
  return list;
}

/** Fill the documentation container. */
export function renderDocs(container) {
  const section = (id, title, ...content) =>
    element("section", { attributes: { id, "aria-labelledby": `${id}-title` } }, [
      element("h3", { text: title, attributes: { id: `${id}-title` } }),
      ...content,
    ]);

  const equationBlocks = equations().map((block) =>
    element("div", { className: "equation-block" }, [
      element("h4", { text: block.title }),
      ...block.math,
      element("p", { className: "docs-hint", text: block.text }),
    ]),
  );

  container.replaceChildren(
    element("h2", { text: "How the model works" }),
    element("p", {
      text:
        "A pharmacokinetic (PK) model tracks where the drug is in the body; pharmacodynamic (PD) models translate " +
        "concentrations into effects. The equations are ordinary differential equations solved in your browser with " +
        "an adaptive Runge-Kutta method. Every number comes from the cited sources below.",
    }),
    diagram(),
    section("equations", "Equations", ...equationBlocks),
    section("parameters", "Parameters and sources", parameterTables()),
    section("validation", "Validation against published data", validationTable()),
    section("limitations", "Known limitations", limitationsList()),
    section(
      "extension",
      "Planned extension: R- and S-ibuprofen",
      element("p", {
        text:
          "Ibuprofen is sold as a 50/50 mixture of R and S forms. S is the active form, and the body converts part of " +
          "the R form into S (63 +/- 6% of an R dose in lee1985). A future version will track the two forms " +
          "separately and drive the effects from S concentrations.",
      }),
    ),
    section("references", "References", referencesList()),
  );
}
