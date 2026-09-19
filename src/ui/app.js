// Page controller: reads the inputs, runs the model, and renders warnings,
// metrics, and charts. All computation happens in the browser.

import { simulate } from "../model.js";
import { CONSTANTS, FORMULATIONS } from "../parameters.js";
import { peak, areaUnderCurve, valueAt } from "../metrics.js";
import {
  celsiusToFahrenheit,
  decodeScenario,
  defaultEndTimeHours,
  defaultScenario,
  encodeScenario,
  fahrenheitToCelsius,
  kgToPounds,
  mgPerLToMicromolar,
  poundsToKg,
  regimenDoses,
  suggestedWeightKg,
} from "../scenario.js";
import { doseWarnings, extrapolationNotes, inputErrors, maxDailyTotals } from "../warnings.js";
import { createLineChart } from "./plots.js";
import { renderDocs } from "./docs.js";

const STORAGE_KEY = "ibuprofen-pkpd.saved-scenarios";
const RECOMPUTE_DELAY_MS = 120;
const byId = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  scenario: defaultScenario(),
  weightEditedByUser: false,
  units: { temperature: "F", concentration: "mgL", weight: "lb" },
  pinned: null, // {label, result}
  lastResult: null,
};

// Scenario links look like "#s=<encoded>", so they never collide with
// in-page section anchors.
const SCENARIO_HASH_PREFIX = "#s=";
const scenarioHash = (scenario) => `${SCENARIO_HASH_PREFIX}${encodeScenario(scenario)}`;
const hashScenario = window.location.hash.startsWith(SCENARIO_HASH_PREFIX)
  ? decodeScenario(window.location.hash.slice(SCENARIO_HASH_PREFIX.length))
  : null;
if (hashScenario) {
  state.scenario = hashScenario;
  state.weightEditedByUser = true;
}

// ---------------------------------------------------------------------------
// Unit helpers
// ---------------------------------------------------------------------------

const displayTemperature = (celsius) =>
  state.units.temperature === "F" ? celsiusToFahrenheit(celsius) : celsius;
const temperatureFromDisplay = (value) =>
  state.units.temperature === "F" ? fahrenheitToCelsius(value) : value;
const temperatureUnitLabel = () => (state.units.temperature === "F" ? "\u00b0F" : "\u00b0C");

const displayConcentration = (mgPerL) =>
  state.units.concentration === "mgL" ? mgPerL : mgPerLToMicromolar(mgPerL, CONSTANTS.molecularWeight.value);
const concentrationUnitLabel = () => (state.units.concentration === "mgL" ? "mg/L" : "\u00b5mol/L");

const displayWeight = (kg) => (state.units.weight === "lb" ? kgToPounds(kg) : kg);
const weightFromDisplay = (value) => (state.units.weight === "lb" ? poundsToKg(value) : value);

const formatNumber = (value, digits = 1) =>
  Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "-";

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

const chartsContainer = byId("charts");
const charts = {};
const syncHover = (time) => Object.values(charts).forEach((chart) => chart.showTime(time));

charts.concentration = createLineChart(chartsContainer, {
  title: "Ibuprofen concentration",
  series: [
    { key: "plasma", label: "Plasma", colorVar: "--series-1" },
    { key: "effectSite", label: "Effect site (pain)", colorVar: "--series-2" },
  ],
  formatValue: (value) => `${formatNumber(value, 1)} ${concentrationUnitLabel()}`,
  onHoverTime: syncHover,
});
charts.cox = createLineChart(chartsContainer, {
  title: "COX enzyme inhibition (%)",
  series: [
    { key: "cox1", label: "COX-1", colorVar: "--series-1" },
    { key: "cox2", label: "COX-2", colorVar: "--series-2" },
  ],
  formatValue: (value) => `${formatNumber(value, 0)}%`,
  tickSuffix: "%",
  fixedRange: [0, 100],
  onHoverTime: syncHover,
});
charts.analgesia = createLineChart(chartsContainer, {
  title: "Pain relief (% reduction in pain score)",
  series: [{ key: "painReduction", label: "Pain relief", colorVar: "--series-1" }],
  formatValue: (value) => `${formatNumber(value, 0)}%`,
  tickSuffix: "%",
  fixedRange: [0, 100],
  onHoverTime: syncHover,
});
charts.temperature = createLineChart(chartsContainer, {
  title: "Body temperature",
  series: [{ key: "temperature", label: "Temperature", colorVar: "--series-1" }],
  formatValue: (value) => `${formatNumber(value, 1)} ${temperatureUnitLabel()}`,
  paddedRange: true,
  minimumSpan: 3,
  onHoverTime: syncHover,
});

function seriesFor(result) {
  return {
    concentration: {
      plasma: result.plasmaConcentration.map(displayConcentration),
      effectSite: result.effectSiteConcentration.map(displayConcentration),
    },
    cox: { cox1: result.cox1InhibitionPercent, cox2: result.cox2InhibitionPercent },
    analgesia: { painReduction: result.analgesiaFraction.map((fraction) => fraction * 100) },
    temperature: { temperature: result.temperatureC.map(displayTemperature) },
  };
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

const inputs = {
  ageYears: byId("age-years"),
  ageMonths: byId("age-months"),
  sex: byId("sex"),
  weight: byId("weight"),
  weightUnit: byId("weight-unit"),
  weightHint: byId("weight-hint"),
  baselineTemperature: byId("baseline-temperature"),
  baselineTemperatureUnit: byId("baseline-temperature-unit"),
  endTime: byId("end-time"),
  temperatureUnit: byId("temperature-unit"),
  concentrationUnit: byId("concentration-unit"),
  regimen: {
    amount: byId("regimen-amount"),
    unit: byId("regimen-unit"),
    interval: byId("regimen-interval"),
    count: byId("regimen-count"),
    start: byId("regimen-start"),
    formulation: byId("regimen-formulation"),
    fed: byId("regimen-fed"),
  },
};

function formulationOptions(select, selected) {
  select.replaceChildren();
  for (const [key, formulation] of Object.entries(FORMULATIONS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = formulation.label;
    option.selected = key === selected;
    select.appendChild(option);
  }
}

function readAgeYears() {
  const years = Number(inputs.ageYears.value) || 0;
  const months = Number(inputs.ageMonths.value) || 0;
  return years + months / 12;
}

function writePatientInputs() {
  const { patient } = state.scenario;
  const wholeYears = Math.floor(patient.ageYears + 1e-9);
  inputs.ageYears.value = wholeYears;
  inputs.ageMonths.value = Math.round((patient.ageYears - wholeYears) * 12);
  inputs.sex.value = patient.sex;
  inputs.weightUnit.value = state.units.weight;
  inputs.weight.value = formatNumber(displayWeight(patient.weightKg), 1).replace(/,/g, "");
  inputs.temperatureUnit.value = state.units.temperature;
  inputs.concentrationUnit.value = state.units.concentration;
  inputs.baselineTemperature.value = displayTemperature(state.scenario.baselineTemperatureC).toFixed(1);
  inputs.baselineTemperatureUnit.textContent = temperatureUnitLabel();
  inputs.endTime.value = state.scenario.endTimeHours ?? "";
  updateWeightHint();
}

function updateWeightHint() {
  const { ageYears, sex } = state.scenario.patient;
  const typical = suggestedWeightKg(ageYears, sex);
  const unit = state.units.weight;
  inputs.weightHint.textContent =
    `Typical for age: ${formatNumber(displayWeight(typical), 1)} ${unit}` +
    (ageYears > 20 ? " (model reference adult)" : " (WHO/CDC median)");
}

function onPatientChange() {
  const patient = state.scenario.patient;
  patient.ageYears = readAgeYears();
  patient.sex = inputs.sex.value;
  if (!state.weightEditedByUser) {
    patient.weightKg = suggestedWeightKg(patient.ageYears, patient.sex);
    inputs.weight.value = displayWeight(patient.weightKg).toFixed(1);
  }
  updateWeightHint();
  scheduleRecompute();
}

inputs.ageYears.addEventListener("input", onPatientChange);
inputs.ageMonths.addEventListener("input", onPatientChange);
inputs.sex.addEventListener("change", onPatientChange);
inputs.weight.addEventListener("input", () => {
  state.weightEditedByUser = true;
  state.scenario.patient.weightKg = weightFromDisplay(Number(inputs.weight.value));
  renderDoseTable();
  scheduleRecompute();
});
byId("typical-weight").addEventListener("click", () => {
  state.weightEditedByUser = false;
  onPatientChange();
  renderDoseTable();
});
inputs.weightUnit.addEventListener("change", () => {
  state.units.weight = inputs.weightUnit.value;
  inputs.weight.value = displayWeight(state.scenario.patient.weightKg).toFixed(1);
  updateWeightHint();
});
inputs.baselineTemperature.addEventListener("input", () => {
  const value = Number(inputs.baselineTemperature.value);
  if (Number.isFinite(value) && inputs.baselineTemperature.value !== "") {
    state.scenario.baselineTemperatureC = temperatureFromDisplay(value);
    scheduleRecompute();
  }
});
inputs.endTime.addEventListener("input", () => {
  const value = Number(inputs.endTime.value);
  state.scenario.endTimeHours = inputs.endTime.value === "" || !(value > 0) ? null : value;
  scheduleRecompute();
});
inputs.temperatureUnit.addEventListener("change", () => {
  state.units.temperature = inputs.temperatureUnit.value;
  inputs.baselineTemperature.value = displayTemperature(state.scenario.baselineTemperatureC).toFixed(1);
  inputs.baselineTemperatureUnit.textContent = temperatureUnitLabel();
  recompute();
});
inputs.concentrationUnit.addEventListener("change", () => {
  state.units.concentration = inputs.concentrationUnit.value;
  recompute();
});

// ---------------------------------------------------------------------------
// Dosing: regimen builder, presets, dose table
// ---------------------------------------------------------------------------

function regimenFromInputs() {
  const reg = inputs.regimen;
  const amount = Number(reg.amount.value);
  const amountMg = reg.unit.value === "mgkg" ? amount * state.scenario.patient.weightKg : amount;
  return regimenDoses({
    amountMg: Math.round(amountMg * 10) / 10,
    intervalHours: Number(reg.interval.value),
    doseCount: Math.max(1, Math.min(60, Math.round(Number(reg.count.value)))),
    firstDoseHours: Number(reg.start.value) || 0,
    formulation: reg.formulation.value,
    fed: reg.fed.checked,
  });
}

function setDoses(doses) {
  state.scenario.doses = doses
    .filter((dose) => Number.isFinite(dose.amountMg) && Number.isFinite(dose.timeHours))
    .sort((first, second) => first.timeHours - second.timeHours);
  renderDoseTable();
  scheduleRecompute();
}

byId("regimen-replace").addEventListener("click", () => setDoses(regimenFromInputs()));
byId("regimen-append").addEventListener("click", () => setDoses([...state.scenario.doses, ...regimenFromInputs()]));
byId("add-dose").addEventListener("click", () => {
  const last = state.scenario.doses[state.scenario.doses.length - 1];
  const next = last
    ? { ...last, timeHours: last.timeHours + 6 }
    : { timeHours: 0, amountMg: 200, formulation: "tablet", fed: false };
  setDoses([...state.scenario.doses, next]);
});
byId("clear-doses").addEventListener("click", () => setDoses([]));

// Example schedules. Amounts and intervals follow the cited labels
// (labelAdvil, labelIbuprofenTabletsRx, labelIbuprofenSuspensionRx).
const PRESETS = [
  { label: "Adult OTC: 400 mg every 6 h", amount: 400, unit: "mg", interval: 6, count: 3, formulation: "tablet" },
  { label: "Adult Rx: 800 mg every 8 h", amount: 800, unit: "mg", interval: 8, count: 3, formulation: "tablet" },
  { label: "Child: 10 mg/kg every 6 h", amount: 10, unit: "mgkg", interval: 6, count: 4, formulation: "suspension" },
  { label: "Child: 5 mg/kg once", amount: 5, unit: "mgkg", interval: 6, count: 1, formulation: "suspension" },
];
for (const preset of PRESETS) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary";
  button.textContent = preset.label;
  button.addEventListener("click", () => {
    const reg = inputs.regimen;
    reg.amount.value = preset.amount;
    reg.unit.value = preset.unit;
    reg.interval.value = preset.interval;
    reg.count.value = preset.count;
    reg.start.value = 0;
    reg.formulation.value = preset.formulation;
    reg.fed.checked = false;
    setDoses(regimenFromInputs());
  });
  byId("presets").appendChild(button);
}

function renderDoseTable() {
  const body = byId("dose-rows");
  body.replaceChildren();
  const weightKg = state.scenario.patient.weightKg;
  state.scenario.doses.forEach((dose, doseIdx) => {
    const row = document.createElement("tr");

    const timeCell = document.createElement("td");
    const timeInput = document.createElement("input");
    Object.assign(timeInput, { type: "number", min: 0, step: 0.5, value: dose.timeHours });
    timeInput.setAttribute("aria-label", `Dose ${doseIdx + 1} time in hours`);
    timeInput.addEventListener("change", () => {
      dose.timeHours = Number(timeInput.value);
      setDoses(state.scenario.doses);
    });
    timeCell.appendChild(timeInput);

    const amountCell = document.createElement("td");
    const amountInput = document.createElement("input");
    Object.assign(amountInput, { type: "number", min: 0, step: "any", value: dose.amountMg });
    amountInput.setAttribute("aria-label", `Dose ${doseIdx + 1} amount in mg`);
    const perKg = document.createElement("span");
    perKg.className = "per-kg";
    perKg.textContent = weightKg > 0 ? `${formatNumber(dose.amountMg / weightKg, 1)} mg/kg` : "";
    amountInput.addEventListener("input", () => {
      dose.amountMg = Number(amountInput.value);
      perKg.textContent = weightKg > 0 ? `${formatNumber(dose.amountMg / weightKg, 1)} mg/kg` : "";
      scheduleRecompute();
    });
    amountCell.append(amountInput, perKg);

    const formulationCell = document.createElement("td");
    const formulationSelect = document.createElement("select");
    formulationSelect.setAttribute("aria-label", `Dose ${doseIdx + 1} form`);
    formulationOptions(formulationSelect, dose.formulation);
    formulationSelect.addEventListener("change", () => {
      dose.formulation = formulationSelect.value;
      scheduleRecompute();
    });
    formulationCell.appendChild(formulationSelect);

    const fedCell = document.createElement("td");
    const fedInput = document.createElement("input");
    fedInput.type = "checkbox";
    fedInput.checked = dose.fed;
    fedInput.setAttribute("aria-label", `Dose ${doseIdx + 1} taken with food`);
    fedInput.addEventListener("change", () => {
      dose.fed = fedInput.checked;
      scheduleRecompute();
    });
    fedCell.appendChild(fedInput);

    const removeCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "secondary";
    removeButton.textContent = "\u00d7";
    removeButton.setAttribute("aria-label", `Remove dose ${doseIdx + 1}`);
    removeButton.addEventListener("click", () => {
      setDoses(state.scenario.doses.filter((_, idx) => idx !== doseIdx));
    });
    removeCell.appendChild(removeButton);

    row.append(timeCell, amountCell, formulationCell, fedCell, removeCell);
    body.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Simulation and rendering
// ---------------------------------------------------------------------------

let recomputeTimer = null;
function scheduleRecompute() {
  clearTimeout(recomputeTimer);
  recomputeTimer = setTimeout(recompute, RECOMPUTE_DELAY_MS);
}

function renderMessages(messages) {
  const container = byId("messages");
  container.replaceChildren();
  const labels = { error: "Cannot simulate:", warning: "Warning:", note: "Note:" };
  for (const message of messages) {
    const paragraph = document.createElement("p");
    paragraph.className = message.severity;
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = labels[message.severity];
    paragraph.append(label, document.createTextNode(message.text));
    container.appendChild(paragraph);
  }
}

function summarize(result, doses, weightKg) {
  const times = result.times;
  const plasmaPeak = peak(times, result.plasmaConcentration);
  const painPeak = peak(times, result.analgesiaFraction);
  let lowestIdx = 0;
  result.temperatureC.forEach((value, idx) => {
    if (value < result.temperatureC[lowestIdx]) lowestIdx = idx;
  });
  const { maxAmountMg } = maxDailyTotals(doses);
  return [
    ["Peak plasma concentration", `${formatNumber(displayConcentration(plasmaPeak.value))} ${concentrationUnitLabel()} at ${formatNumber(plasmaPeak.time, 2)} h`],
    ["Exposure (area under curve)", `${formatNumber(displayConcentration(areaUnderCurve(times, result.plasmaConcentration)), 0)} ${concentrationUnitLabel()}\u00b7h`],
    ["Largest 24 h total", `${formatNumber(maxAmountMg, 0)} mg (${formatNumber(maxAmountMg / weightKg, 1)} mg/kg)`],
    ["Peak COX-1 / COX-2 inhibition", `${formatNumber(Math.max(...result.cox1InhibitionPercent), 0)}% / ${formatNumber(Math.max(...result.cox2InhibitionPercent), 0)}%`],
    ["Largest pain-score reduction", `${formatNumber(painPeak.value * 100, 0)}% at ${formatNumber(painPeak.time, 2)} h`],
    ["Lowest temperature", `${formatNumber(displayTemperature(result.temperatureC[lowestIdx]), 1)} ${temperatureUnitLabel()} at ${formatNumber(times[lowestIdx], 2)} h`],
  ];
}

function renderMetrics(current, pinned) {
  const table = byId("metrics");
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  for (const text of ["", "Current", pinned ? `Pinned: ${pinned.label}` : null].filter((text) => text !== null)) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = text;
    head.appendChild(cell);
  }
  const body = table.createTBody();
  current.forEach(([label, value], rowIdx) => {
    const row = body.insertRow();
    const header = document.createElement("th");
    header.scope = "row";
    header.textContent = label;
    row.appendChild(header);
    row.insertCell().textContent = value;
    if (pinned) row.insertCell().textContent = pinned.summary[rowIdx][1];
  });
}

function recompute() {
  const scenario = state.scenario;
  const errors = inputErrors(scenario);
  const results = document.querySelector(".results");
  if (errors.length > 0) {
    renderMessages(errors);
    state.lastResult = null;
    results.classList.add("stale");
    return;
  }
  results.classList.remove("stale");
  const endTimeHours = scenario.endTimeHours ?? defaultEndTimeHours(scenario.doses);
  const result = simulate({
    patient: scenario.patient,
    doses: scenario.doses,
    endTimeHours,
    outputStepHours: Math.max(0.02, endTimeHours / 1200),
    baselineTemperatureC: scenario.baselineTemperatureC,
  });
  state.lastResult = { result, endTimeHours };

  const standingNotes = [
    {
      severity: "note",
      text:
        "Against published adult data the model's peak concentrations run about 20% low, " +
        "and COX-1 inhibition after one dose is somewhat low (measured about 90-96% after 400 mg). " +
        "See validation findings.",
    },
  ];
  renderMessages([...doseWarnings(scenario), ...standingNotes]);

  const notes = extrapolationNotes(scenario);
  const current = seriesFor(result);
  const pinnedSeries = state.pinned ? seriesFor(state.pinned.result) : null;
  const chartEnd = Math.max(endTimeHours, state.pinned?.endTimeHours ?? 0);
  const doseTimes = scenario.doses.map((dose) => dose.timeHours);
  const chartNotes = {
    concentration: notes.concentration,
    cox: notes.cox,
    analgesia: notes.analgesia,
    temperature: notes.antipyresis,
  };
  for (const [key, chart] of Object.entries(charts)) {
    chart.update({
      times: result.times,
      seriesData: current[key],
      endTime: chartEnd,
      doseTimes,
      note: chartNotes[key],
      comparison: state.pinned
        ? { label: state.pinned.label, times: state.pinned.result.times, seriesData: pinnedSeries[key] }
        : null,
    });
  }
  charts.concentration.setTitle(`Ibuprofen concentration (${concentrationUnitLabel()})`);
  charts.temperature.setTitle(`Body temperature (${temperatureUnitLabel()})`);

  const pinnedSummary = state.pinned
    ? { label: state.pinned.label, summary: summarize(state.pinned.result, state.pinned.doses, state.pinned.weightKg) }
    : null;
  renderMetrics(summarize(result, scenario.doses, scenario.patient.weightKg), pinnedSummary);

  renderDataTable();
  history.replaceState(null, "", scenarioHash(scenario));
}

/** Table of all outputs at regular times; rendered only while it is open. */
function renderDataTable() {
  const details = byId("data-table-details");
  const container = byId("data-table");
  if (!details.open || !state.lastResult) return;
  const { result, endTimeHours } = state.lastResult;
  const stepHours = endTimeHours <= 30 ? 0.5 : endTimeHours <= 60 ? 1 : 2;
  const headers = [
    "Time (h)",
    `Plasma (${concentrationUnitLabel()})`,
    `Effect site (${concentrationUnitLabel()})`,
    "COX-1 (%)",
    "COX-2 (%)",
    "Pain relief (%)",
    `Temperature (${temperatureUnitLabel()})`,
  ];
  const tableElement = document.createElement("table");
  tableElement.className = "docs-table";
  const caption = tableElement.createCaption();
  caption.textContent = `Simulated values every ${stepHours} h (download the CSV for full resolution).`;
  const headRow = tableElement.createTHead().insertRow();
  for (const header of headers) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = header;
    headRow.appendChild(cell);
  }
  const body = tableElement.createTBody();
  const at = (series, time) => valueAt(result.times, series, time);
  for (let time = 0; time <= endTimeHours + 1e-9; time += stepHours) {
    const values = [
      formatNumber(time, 1),
      formatNumber(displayConcentration(at(result.plasmaConcentration, time)), 1),
      formatNumber(displayConcentration(at(result.effectSiteConcentration, time)), 1),
      formatNumber(at(result.cox1InhibitionPercent, time), 0),
      formatNumber(at(result.cox2InhibitionPercent, time), 0),
      formatNumber(at(result.analgesiaFraction, time) * 100, 0),
      formatNumber(displayTemperature(at(result.temperatureC, time)), 1),
    ];
    const row = body.insertRow();
    for (const value of values) row.insertCell().textContent = value;
  }
  container.replaceChildren(tableElement);
}
byId("data-table-details").addEventListener("toggle", renderDataTable);

// ---------------------------------------------------------------------------
// Scenario tools: pin, share, CSV, saved scenarios (browser storage only)
// ---------------------------------------------------------------------------

const status = (text) => {
  byId("scenario-status").textContent = text;
};

byId("pin").addEventListener("click", () => {
  if (!state.lastResult) return;
  const label = window.prompt("Label for the pinned scenario:", "A");
  if (label === null) return;
  state.pinned = {
    label: label.trim() || "pinned",
    result: state.lastResult.result,
    endTimeHours: state.lastResult.endTimeHours,
    doses: state.scenario.doses.map((dose) => ({ ...dose })),
    weightKg: state.scenario.patient.weightKg,
  };
  byId("unpin").hidden = false;
  recompute();
});
byId("unpin").addEventListener("click", () => {
  state.pinned = null;
  byId("unpin").hidden = true;
  recompute();
});

byId("share").addEventListener("click", async () => {
  const url = `${window.location.origin}${window.location.pathname}${scenarioHash(state.scenario)}`;
  try {
    await navigator.clipboard.writeText(url);
    status("Link copied. The scenario is stored after the # and is not sent to the server.");
  } catch {
    status(`Copy this link: ${url}`);
  }
});

byId("export-csv").addEventListener("click", () => {
  if (!state.lastResult) return;
  const { result } = state.lastResult;
  const temperatureHeader = state.units.temperature === "F" ? "temperature_F" : "temperature_C";
  const rows = [["time_h", "plasma_mg_per_L", "effect_site_mg_per_L", "cox1_inhibition_pct", "cox2_inhibition_pct", "pain_reduction_pct", temperatureHeader]];
  result.times.forEach((time, idx) => {
    rows.push([
      time.toFixed(3),
      result.plasmaConcentration[idx].toFixed(4),
      result.effectSiteConcentration[idx].toFixed(4),
      result.cox1InhibitionPercent[idx].toFixed(2),
      result.cox2InhibitionPercent[idx].toFixed(2),
      (result.analgesiaFraction[idx] * 100).toFixed(2),
      displayTemperature(result.temperatureC[idx]).toFixed(2),
    ]);
  });
  const blob = new Blob([rows.map((row) => row.join(",")).join("\n") + "\n"], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ibuprofen-simulation.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
function writeSaved(saved) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return true;
  } catch {
    status("This browser is not allowing local storage, so scenarios cannot be saved.");
    return false;
  }
}
function renderSavedList() {
  const select = byId("saved-list");
  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose...";
  select.appendChild(placeholder);
  for (const name of Object.keys(readSaved()).sort()) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
}
byId("save").addEventListener("click", () => {
  const name = window.prompt("Name this scenario:");
  if (!name || !name.trim()) return;
  const saved = readSaved();
  saved[name.trim()] = encodeScenario(state.scenario);
  if (writeSaved(saved)) {
    renderSavedList();
    status(`Saved "${name.trim()}" in this browser.`);
  }
});
byId("load-saved").addEventListener("click", () => {
  const name = byId("saved-list").value;
  const scenario = name ? decodeScenario(readSaved()[name] ?? "") : null;
  if (!scenario) return;
  state.scenario = scenario;
  state.weightEditedByUser = true;
  writePatientInputs();
  renderDoseTable();
  recompute();
  status(`Loaded "${name}".`);
});
byId("delete-saved").addEventListener("click", () => {
  const name = byId("saved-list").value;
  if (!name) return;
  const saved = readSaved();
  delete saved[name];
  if (writeSaved(saved)) {
    renderSavedList();
    status(`Deleted "${name}".`);
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

formulationOptions(inputs.regimen.formulation, "tablet");
Object.assign(inputs.regimen.amount, { value: 400 });
Object.assign(inputs.regimen.interval, { value: 6 });
Object.assign(inputs.regimen.count, { value: 3 });
Object.assign(inputs.regimen.start, { value: 0 });
writePatientInputs();
renderDoseTable();
renderSavedList();
recompute();

// The documentation runs the validation simulations; render it after the
// simulator has painted so the page appears immediately.
setTimeout(() => renderDocs(byId("model")), 0);

// In-page links scroll instead of changing the hash, which holds the scenario.
document.addEventListener("click", (event) => {
  const link = event.target.closest?.('a[href^="#"]');
  if (!link) return;
  const target = byId(decodeURIComponent(link.getAttribute("href").slice(1)));
  if (!target) return;
  event.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  if (target.matches("h1, h2, h3, h4, li, section")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
});
