// Adaptive Dormand-Prince 5(4) integrator for small non-stiff ODE systems,
// with support for discrete events (instantaneous changes to the state, such
// as a dose arriving in the gut).
//
// The integrator stops exactly at every event time and every output time, so
// a discontinuity never falls inside a step and outputs need no
// interpolation.

// Dormand-Prince tableau (Hairer, Norsett & Wanner, Solving ODEs I, Table 5.2).
const C2 = 1 / 5, C3 = 3 / 10, C4 = 4 / 5, C5 = 8 / 9;

const A21 = 1 / 5;
const A31 = 3 / 40, A32 = 9 / 40;
const A41 = 44 / 45, A42 = -56 / 15, A43 = 32 / 9;
const A51 = 19372 / 6561, A52 = -25360 / 2187, A53 = 64448 / 6561, A54 = -212 / 729;
const A61 = 9017 / 3168, A62 = -355 / 33, A63 = 46732 / 5247, A64 = 49 / 176, A65 = -5103 / 18656;
const A71 = 35 / 384, A73 = 500 / 1113, A74 = 125 / 192, A75 = -2187 / 6784, A76 = 11 / 84;

// Difference between the 5th-order solution (the A7x row) and the embedded
// 4th-order solution; used only for the error estimate.
const E1 = 71 / 57600, E3 = -71 / 16695, E4 = 71 / 1920, E5 = -17253 / 339200, E6 = 22 / 525, E7 = -1 / 40;

const DEFAULT_OPTIONS = {
  relativeTolerance: 1e-8,
  absoluteTolerance: 1e-10,
  initialStep: 1e-3,
  maxStep: Infinity,
  maxSteps: 1e6,
};

/**
 * Take one Dormand-Prince step from (time, state) with step size `stepSize`.
 * Returns the new state and the scaled error norm (accept the step if <= 1).
 */
function dormandPrinceStep(rhs, time, state, stepSize, options) {
  const dim = state.length;
  const stage = (coefficients) => {
    const out = new Float64Array(dim);
    for (let idx = 0; idx < dim; idx++) {
      let sum = state[idx];
      for (const [weight, slopes] of coefficients) sum += stepSize * weight * slopes[idx];
      out[idx] = sum;
    }
    return out;
  };

  const k1 = rhs(time, state);
  const k2 = rhs(time + C2 * stepSize, stage([[A21, k1]]));
  const k3 = rhs(time + C3 * stepSize, stage([[A31, k1], [A32, k2]]));
  const k4 = rhs(time + C4 * stepSize, stage([[A41, k1], [A42, k2], [A43, k3]]));
  const k5 = rhs(time + C5 * stepSize, stage([[A51, k1], [A52, k2], [A53, k3], [A54, k4]]));
  const k6 = rhs(time + stepSize, stage([[A61, k1], [A62, k2], [A63, k3], [A64, k4], [A65, k5]]));
  const newState = stage([[A71, k1], [A73, k3], [A74, k4], [A75, k5], [A76, k6]]);
  const k7 = rhs(time + stepSize, newState);

  let sumSquares = 0;
  for (let idx = 0; idx < dim; idx++) {
    const errorEstimate =
      stepSize * (E1 * k1[idx] + E3 * k3[idx] + E4 * k4[idx] + E5 * k5[idx] + E6 * k6[idx] + E7 * k7[idx]);
    const scale =
      options.absoluteTolerance +
      options.relativeTolerance * Math.max(Math.abs(state[idx]), Math.abs(newState[idx]));
    sumSquares += (errorEstimate / scale) ** 2;
  }
  return { newState, errorNorm: Math.sqrt(sumSquares / dim) };
}

/**
 * Integrate dy/dt = rhs(t, y) from `startTime` to `endTime`.
 *
 * @param {function(number, Float64Array): Float64Array} rhs
 * @param {number[]} initialState
 * @param {number} startTime
 * @param {number} endTime
 * @param {object} [config]
 * @param {number[]} [config.outputTimes] times at which to record the state
 *   (sorted; values outside [startTime, endTime] are ignored)
 * @param {{time: number, apply: function(Float64Array): void}[]} [config.events]
 *   instantaneous state changes. `apply` mutates the state in place. An event
 *   at time t is applied before the state at t is recorded.
 * @param {object} [config.options] tolerance and step-size overrides
 * @returns {{times: number[], states: Float64Array[]}}
 */
export function integrate(rhs, initialState, startTime, endTime, config = {}) {
  const options = { ...DEFAULT_OPTIONS, ...(config.options ?? {}) };
  const outputTimes = (config.outputTimes ?? [startTime, endTime]).filter(
    (time) => time >= startTime && time <= endTime,
  );
  const events = [...(config.events ?? [])]
    .filter((event) => event.time >= startTime && event.time <= endTime)
    .sort((first, second) => first.time - second.time);

  // Every time at which integration must stop: events and outputs.
  const stopTimes = [...new Set([...outputTimes, ...events.map((event) => event.time), endTime])].sort(
    (first, second) => first - second,
  );
  const outputSet = new Set(outputTimes);

  const times = [];
  const states = [];
  let state = Float64Array.from(initialState);
  let time = startTime;
  let stepSize = Math.min(options.initialStep, options.maxStep);
  let eventIdx = 0;
  let stepCount = 0;

  const applyEventsAt = (eventTime) => {
    while (eventIdx < events.length && events[eventIdx].time === eventTime) {
      events[eventIdx].apply(state);
      eventIdx++;
    }
  };

  applyEventsAt(time);
  if (outputSet.has(time)) {
    times.push(time);
    states.push(Float64Array.from(state));
  }

  for (const stopTime of stopTimes) {
    if (stopTime <= time) continue;

    while (time < stopTime) {
      if (++stepCount > options.maxSteps) {
        throw new Error(`integrate: exceeded ${options.maxSteps} steps at t = ${time}`);
      }
      const remaining = stopTime - time;
      // Land exactly on the stop time; avoid leaving a sliver of a step.
      const landsOnStop = stepSize >= remaining * (1 - 1e-12);
      const trialStep = landsOnStop ? remaining : stepSize;

      const { newState, errorNorm } = dormandPrinceStep(rhs, time, state, trialStep, options);

      // Standard step-size controller for a 5th-order method.
      const growth = errorNorm === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * errorNorm ** -0.2));
      if (errorNorm <= 1) {
        time = landsOnStop ? stopTime : time + trialStep;
        state = newState;
        // A step shortened only to land on a stop time says nothing about
        // the achievable step size, so it must not shrink the next step.
        const proposed = trialStep * growth;
        stepSize = Math.min(options.maxStep, landsOnStop ? Math.max(stepSize, proposed) : proposed);
      } else {
        stepSize = trialStep * growth;
        if (stepSize < 1e-14 * Math.max(1, Math.abs(time))) {
          throw new Error(`integrate: step size underflow at t = ${time}`);
        }
      }
    }

    applyEventsAt(time);
    if (outputSet.has(time)) {
      times.push(time);
      states.push(Float64Array.from(state));
    }
  }

  return { times, states };
}
