// Summary metrics computed from a simulated time series.

/** Maximum value and the time at which it first occurs. */
export function peak(times, values) {
  let peakIdx = 0;
  for (let idx = 1; idx < values.length; idx++) {
    if (values[idx] > values[peakIdx]) peakIdx = idx;
  }
  return { value: values[peakIdx], time: times[peakIdx] };
}

/** Minimum value and the time at which it first occurs. */
export function trough(times, values) {
  let troughIdx = 0;
  for (let idx = 1; idx < values.length; idx++) {
    if (values[idx] < values[troughIdx]) troughIdx = idx;
  }
  return { value: values[troughIdx], time: times[troughIdx] };
}

/** Trapezoidal area under the curve between startTime and endTime. */
export function areaUnderCurve(times, values, startTime = times[0], endTime = times[times.length - 1]) {
  let area = 0;
  for (let idx = 1; idx < times.length; idx++) {
    const segmentStart = Math.max(times[idx - 1], startTime);
    const segmentEnd = Math.min(times[idx], endTime);
    if (segmentEnd <= segmentStart) continue;
    const valueAtStart = valueAt(times, values, segmentStart);
    const valueAtEnd = valueAt(times, values, segmentEnd);
    area += 0.5 * (valueAtStart + valueAtEnd) * (segmentEnd - segmentStart);
  }
  return area;
}

/** Linear interpolation of the series at `time` (clamped to the ends). */
export function valueAt(times, values, time) {
  if (time <= times[0]) return values[0];
  const lastIdx = times.length - 1;
  if (time >= times[lastIdx]) return values[lastIdx];
  let low = 0;
  let high = lastIdx;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (times[mid] <= time) low = mid;
    else high = mid;
  }
  const fraction = (time - times[low]) / (times[high] - times[low]);
  return values[low] + fraction * (values[high] - values[low]);
}
