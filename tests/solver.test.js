import { test } from "node:test";
import assert from "node:assert/strict";

import { integrate } from "../src/solver.js";

test("exponential decay matches the analytic solution", () => {
  const decayRate = 0.7;
  const outputTimes = [0, 0.5, 1, 2, 5, 10];
  const { times, states } = integrate(
    (time, state) => Float64Array.of(-decayRate * state[0]),
    [3],
    0,
    10,
    { outputTimes },
  );
  assert.deepEqual(times, outputTimes);
  times.forEach((time, idx) => {
    const exact = 3 * Math.exp(-decayRate * time);
    assert.ok(Math.abs(states[idx][0] - exact) <= 1e-7 * exact, `t=${time}: ${states[idx][0]} vs ${exact}`);
  });
});

test("harmonic oscillator stays accurate over ten periods", () => {
  const period = 2 * Math.PI;
  const { states } = integrate(
    (time, state) => Float64Array.of(state[1], -state[0]),
    [1, 0],
    0,
    10 * period,
    { outputTimes: [10 * period] },
  );
  const [position, velocity] = states[0];
  assert.ok(Math.abs(position - 1) < 1e-6, `position ${position}`);
  assert.ok(Math.abs(velocity) < 1e-6, `velocity ${velocity}`);
});

test("events are applied at their times, before the state is recorded", () => {
  const { times, states } = integrate(
    () => Float64Array.of(0),
    [0],
    0,
    4,
    {
      outputTimes: [0, 1, 2, 2.5, 3, 4],
      events: [
        { time: 0, apply: (state) => { state[0] += 1; } },
        { time: 2.5, apply: (state) => { state[0] += 10; } },
        { time: 3.7, apply: (state) => { state[0] += 100; } },
      ],
    },
  );
  assert.deepEqual(times, [0, 1, 2, 2.5, 3, 4]);
  assert.deepEqual(
    states.map((state) => state[0]),
    [1, 1, 1, 11, 11, 111],
  );
});

test("an event between outputs restarts integration from the new state", () => {
  const decayRate = 1.3;
  const { states } = integrate(
    (time, state) => Float64Array.of(-decayRate * state[0]),
    [0],
    0,
    3,
    {
      outputTimes: [3],
      events: [{ time: 1.25, apply: (state) => { state[0] += 5; } }],
    },
  );
  const exact = 5 * Math.exp(-decayRate * (3 - 1.25));
  assert.ok(Math.abs(states[0][0] - exact) <= 1e-8 * exact);
});
