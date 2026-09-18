// Minimal SVG line charts with a shared time axis, a crosshair that snaps to
// the nearest sample, and a tooltip listing every series at that time.
// No external libraries.

const SVG_NS = "http://www.w3.org/2000/svg";
const MARGIN = { top: 12, right: 16, bottom: 30, left: 52 };
const CHART_HEIGHT = 200;
const TICK_TARGET_COUNT = 5;

function svgElement(tag, attributes = {}, parent = null) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    // Styles go through the CSSOM: the page's Content-Security-Policy blocks
    // style attributes set as markup.
    if (name === "style") element.style.cssText = value;
    else element.setAttribute(name, value);
  }
  if (parent) parent.appendChild(element);
  return element;
}

/** "Nice" tick values covering [low, high] (1, 2, 2.5, 5 x 10^k steps). */
export function niceTicks(low, high, targetCount = TICK_TARGET_COUNT) {
  if (!(high > low)) return [low];
  const rawStep = (high - low) / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rawStep);
  const ticks = [];
  for (let value = Math.ceil(low / step - 1e-9) * step; value <= high + step * 1e-9; value += step) {
    ticks.push(Number(value.toPrecision(12)));
  }
  return ticks;
}

/** Time-axis ticks in hours, on multiples of 1, 2, 3, 6, 12 or 24 h. */
function timeTicks(endTime) {
  const step = [1, 2, 3, 6, 12, 24, 48].find((candidate) => endTime / candidate <= 8) ?? 72;
  const ticks = [];
  for (let value = 0; value <= endTime + 1e-9; value += step) ticks.push(value);
  return ticks;
}

function nearestIndex(times, time) {
  let low = 0;
  let high = times.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (times[mid] <= time) low = mid;
    else high = mid;
  }
  return time - times[low] <= times[high] - time ? low : high;
}

/**
 * Create a line chart inside `container`.
 *
 * @param {HTMLElement} container
 * @param {object} config
 * @param {string} config.title
 * @param {{key: string, label: string, colorVar: string}[]} config.series
 * @param {function(number): string} config.formatValue value formatter for the tooltip
 * @param {string} [config.tickSuffix] appended to y-axis tick labels (e.g. "%")
 * @param {[number, number] | null} [config.fixedRange] y-axis range, or null to fit the data
 * @param {function(number | null): void} [config.onHoverTime] called with the hovered time
 */
export function createLineChart(container, config) {
  const figure = document.createElement("figure");
  figure.className = "chart";
  container.appendChild(figure);

  const header = document.createElement("figcaption");
  header.className = "chart-header";
  const titleElement = document.createElement("h3");
  titleElement.textContent = config.title;
  header.appendChild(titleElement);

  const legend = document.createElement("ul");
  legend.className = "legend";
  header.appendChild(legend);

  const noteElement = document.createElement("p");
  noteElement.className = "chart-note";
  noteElement.hidden = true;
  header.appendChild(noteElement);
  figure.appendChild(header);

  const plotArea = document.createElement("div");
  plotArea.className = "plot-area";
  figure.appendChild(plotArea);

  const svg = svgElement("svg", { role: "img", "aria-label": config.title }, plotArea);
  const gridLayer = svgElement("g", { class: "grid" }, svg);
  const doseLayer = svgElement("g", { class: "dose-markers" }, svg);
  const lineLayer = svgElement("g", { class: "lines" }, svg);
  const crosshair = svgElement("line", { class: "crosshair", visibility: "hidden" }, svg);
  const dotLayer = svgElement("g", { class: "hover-dots", visibility: "hidden" }, svg);

  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.hidden = true;
  plotArea.appendChild(tooltip);

  let data = null;
  let geometry = null;

  function renderLegend() {
    legend.replaceChildren();
    const entries = config.series.map((series) => ({ label: series.label, colorVar: series.colorVar, pinned: false }));
    if (data?.comparison) {
      for (const series of config.series) {
        entries.push({ label: `${series.label} (${data.comparison.label})`, colorVar: series.colorVar, pinned: true });
      }
    }
    if (entries.length < 2) return;
    for (const entry of entries) {
      const item = document.createElement("li");
      const key = document.createElement("span");
      key.className = entry.pinned ? "line-key pinned" : "line-key";
      key.style.setProperty("--key-color", `var(${entry.colorVar})`);
      item.append(key, document.createTextNode(entry.label));
      legend.appendChild(item);
    }
  }

  function draw() {
    if (!data) return;
    const width = Math.max(280, plotArea.clientWidth);
    const innerWidth = width - MARGIN.left - MARGIN.right;
    const innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
    svg.setAttribute("viewBox", `0 0 ${width} ${CHART_HEIGHT}`);
    svg.setAttribute("width", width);
    svg.setAttribute("height", CHART_HEIGHT);

    const allValues = [];
    for (const source of [data.seriesData, data.comparison?.seriesData].filter(Boolean)) {
      for (const series of config.series) allValues.push(...(source[series.key] ?? []));
    }
    // Quantities measured from zero (concentration) keep zero on the axis;
    // padded ranges (temperature) fit the data instead.
    const dataLow = config.paddedRange ? Math.min(...allValues) : Math.min(0, ...allValues);
    let [yLow, yHigh] = config.fixedRange ?? [dataLow, Math.max(...allValues)];
    if (!config.fixedRange) {
      if (config.paddedRange) {
        const span = Math.max(yHigh - yLow, config.minimumSpan ?? 0);
        const middle = (yHigh + yLow) / 2;
        yLow = middle - span * 0.6;
        yHigh = middle + span * 0.6;
      }
      if (!(yHigh > yLow)) yHigh = yLow + 1;
    }
    const yTicks = niceTicks(yLow, yHigh);
    const tickStep = yTicks.length > 1 ? yTicks[1] - yTicks[0] : 1;
    const tickDecimals = (String(Number(tickStep.toPrecision(6))).split(".")[1] ?? "").length;
    yLow = Math.min(yLow, yTicks[0]);
    yHigh = Math.max(yHigh, yTicks[yTicks.length - 1]);

    const xScale = (time) => MARGIN.left + (time / data.endTime) * innerWidth;
    const yScale = (value) => MARGIN.top + innerHeight - ((value - yLow) / (yHigh - yLow)) * innerHeight;
    geometry = { xScale, yScale, innerWidth, innerHeight };

    gridLayer.replaceChildren();
    for (const tick of yTicks) {
      const y = yScale(tick);
      svgElement("line", { x1: MARGIN.left, x2: MARGIN.left + innerWidth, y1: y, y2: y, class: tick === yLow ? "baseline" : "gridline" }, gridLayer);
      const label = svgElement("text", { x: MARGIN.left - 6, y: y + 4, class: "tick-label", "text-anchor": "end" }, gridLayer);
      label.textContent = `${tick.toLocaleString(undefined, { maximumFractionDigits: tickDecimals })}${config.tickSuffix ?? ""}`;
    }
    const xTicks = timeTicks(data.endTime);
    xTicks.forEach((tick, tickIdx) => {
      const label = svgElement("text", { x: xScale(tick), y: CHART_HEIGHT - 10, class: "tick-label", "text-anchor": "middle" }, gridLayer);
      // The last tick carries the unit, so no separate axis title is needed.
      label.textContent = tickIdx === xTicks.length - 1 ? `${tick} h` : `${tick}`;
    });

    doseLayer.replaceChildren();
    for (const doseTime of data.doseTimes) {
      const x = xScale(doseTime);
      svgElement("path", { d: `M${x - 4},${MARGIN.top + innerHeight + 7} l4,-6 l4,6 z`, class: "dose-marker" }, doseLayer);
    }

    lineLayer.replaceChildren();
    const pathFor = (times, values) =>
      values.map((value, idx) => `${idx === 0 ? "M" : "L"}${xScale(times[idx]).toFixed(1)},${yScale(value).toFixed(1)}`).join("");
    if (data.comparison) {
      for (const series of config.series) {
        const values = data.comparison.seriesData[series.key];
        if (!values) continue;
        svgElement("path", { d: pathFor(data.comparison.times, values), class: "series-line pinned", style: `stroke: var(${series.colorVar})` }, lineLayer);
      }
    }
    for (const series of config.series) {
      svgElement("path", { d: pathFor(data.times, data.seriesData[series.key]), class: "series-line", style: `stroke: var(${series.colorVar})` }, lineLayer);
    }
    crosshair.setAttribute("y1", MARGIN.top);
    crosshair.setAttribute("y2", MARGIN.top + innerHeight);
  }

  function showTime(time) {
    if (!data || !geometry || time === null || time < 0 || time > data.endTime) {
      crosshair.setAttribute("visibility", "hidden");
      dotLayer.setAttribute("visibility", "hidden");
      tooltip.hidden = true;
      return;
    }
    const idx = nearestIndex(data.times, time);
    const snappedTime = data.times[idx];
    const x = geometry.xScale(snappedTime);
    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.setAttribute("visibility", "visible");

    dotLayer.replaceChildren();
    tooltip.replaceChildren();
    const timeRow = document.createElement("div");
    timeRow.className = "tooltip-time";
    timeRow.textContent = `${snappedTime.toFixed(2)} h`;
    tooltip.appendChild(timeRow);

    const addRow = (series, value, pinned) => {
      svgElement("circle", { cx: x, cy: geometry.yScale(value), r: 4, class: "hover-dot", style: `fill: var(${series.colorVar})` }, dotLayer);
      const row = document.createElement("div");
      row.className = "tooltip-row";
      const key = document.createElement("span");
      key.className = pinned ? "line-key pinned" : "line-key";
      key.style.setProperty("--key-color", `var(${series.colorVar})`);
      const valueElement = document.createElement("strong");
      valueElement.textContent = config.formatValue(value);
      const labelElement = document.createElement("span");
      labelElement.className = "tooltip-label";
      labelElement.textContent = pinned ? `${series.label} (${data.comparison.label})` : series.label;
      row.append(key, valueElement, labelElement);
      tooltip.appendChild(row);
    };
    for (const series of config.series) addRow(series, data.seriesData[series.key][idx], false);
    if (data.comparison) {
      const comparisonIdx = nearestIndex(data.comparison.times, snappedTime);
      for (const series of config.series) {
        const values = data.comparison.seriesData[series.key];
        if (values && Math.abs(data.comparison.times[comparisonIdx] - snappedTime) < 1e-6) {
          addRow(series, values[comparisonIdx], true);
        }
      }
    }
    dotLayer.setAttribute("visibility", "visible");
    tooltip.hidden = false;
    const flip = x > MARGIN.left + geometry.innerWidth / 2;
    tooltip.style.left = flip ? "" : `${x + 12}px`;
    tooltip.style.right = flip ? `${plotArea.clientWidth - x + 12}px` : "";
  }

  const timeFromPointer = (event) => {
    if (!geometry || !data) return null;
    const bounds = svg.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    return ((x - MARGIN.left) / geometry.innerWidth) * data.endTime;
  };
  svg.addEventListener("pointermove", (event) => config.onHoverTime?.(timeFromPointer(event)));
  svg.addEventListener("pointerleave", () => config.onHoverTime?.(null));

  new ResizeObserver(() => draw()).observe(plotArea);

  return {
    /**
     * @param {object} next
     * @param {number[]} next.times
     * @param {Object<string, number[]>} next.seriesData
     * @param {number} next.endTime
     * @param {number[]} next.doseTimes
     * @param {{label: string, times: number[], seriesData: Object<string, number[]>} | null} [next.comparison]
     * @param {string | null} [next.note] shown under the title (e.g. an extrapolation label)
     */
    update(next) {
      data = next;
      noteElement.textContent = next.note ?? "";
      noteElement.hidden = !next.note;
      renderLegend();
      draw();
    },
    showTime,
    setTitle(title) {
      titleElement.textContent = title;
      svg.setAttribute("aria-label", title);
    },
  };
}
