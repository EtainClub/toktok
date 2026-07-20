import assert from "node:assert/strict";
import test from "node:test";
import {
  CALIBRATION_MOTION_CONFIG,
  analyzeMotionSample,
  applyMotionSensitivity,
  createCalibratedMotionConfig,
  createMotionDetectorState,
} from "../lib/motionDetection.ts";

const empty = { x: 0, y: 0, z: 0 };

test("a sharp linear acceleration is counted once", () => {
  let state = createMotionDetectorState();
  let result = analyzeMotionSample(
    state,
    { acceleration: empty, accelerationIncludingGravity: null, timestamp: 0 },
    CALIBRATION_MOTION_CONFIG,
  );
  state = result.state;

  result = analyzeMotionSample(
    state,
    {
      acceleration: { x: 2.8, y: 0.4, z: 0.2 },
      accelerationIncludingGravity: null,
      timestamp: 40,
    },
    CALIBRATION_MOTION_CONFIG,
  );

  assert.equal(result.hit, true);
  assert.ok(result.magnitude > 2.8);
});

test("a soft phone impulse is still detectable during calibration", () => {
  let state = createMotionDetectorState();
  state = analyzeMotionSample(
    state,
    { acceleration: empty, accelerationIncludingGravity: null, timestamp: 0 },
    CALIBRATION_MOTION_CONFIG,
  ).state;

  const result = analyzeMotionSample(
    state,
    {
      acceleration: { x: 0.62, y: 0.08, z: 0.05 },
      accelerationIncludingGravity: null,
      timestamp: 40,
    },
    CALIBRATION_MOTION_CONFIG,
  );

  assert.equal(result.hit, true);
});

test("cooldown prevents a single impact from being counted twice", () => {
  let state = createMotionDetectorState();
  for (const [timestamp, x] of [
    [0, 0],
    [40, 3],
    [90, 0],
    [160, 3.4],
  ]) {
    const result = analyzeMotionSample(
      state,
      {
        acceleration: { x, y: 0, z: 0 },
        accelerationIncludingGravity: null,
        timestamp,
      },
      CALIBRATION_MOTION_CONFIG,
    );
    state = result.state;
    if (timestamp === 40) assert.equal(result.hit, true);
    if (timestamp === 160) assert.equal(result.hit, false);
  }
});

test("a later distinct impact is counted", () => {
  let state = createMotionDetectorState();
  let hits = 0;
  for (const [timestamp, x] of [
    [0, 0],
    [40, 3],
    [100, 0],
    [420, 0],
    [470, 2.6],
  ]) {
    const result = analyzeMotionSample(
      state,
      {
        acceleration: { x, y: 0, z: 0 },
        accelerationIncludingGravity: null,
        timestamp,
      },
      CALIBRATION_MOTION_CONFIG,
    );
    state = result.state;
    if (result.hit) hits += 1;
  }
  assert.equal(hits, 2);
});

test("one long-ringing impact cannot count again before the sensor settles", () => {
  let state = createMotionDetectorState();
  let hits = 0;
  for (const [timestamp, x] of [
    [0, 0],
    [40, 3],
    [120, 1.3],
    [390, 1.2],
    [740, 2.8],
    [780, 0.1],
    [820, 0.05],
    [1180, 2.7],
  ]) {
    const result = analyzeMotionSample(
      state,
      {
        acceleration: { x, y: 0, z: 0 },
        accelerationIncludingGravity: null,
        timestamp,
      },
      CALIBRATION_MOTION_CONFIG,
    );
    state = result.state;
    if (result.hit) hits += 1;
  }
  assert.equal(hits, 2);
});

test("gravity-inclusive readings are high-pass filtered", () => {
  let state = createMotionDetectorState();
  let hits = 0;
  for (let index = 0; index < 20; index += 1) {
    const result = analyzeMotionSample(
      state,
      {
        acceleration: null,
        accelerationIncludingGravity: {
          x: index * 0.01,
          y: 0,
          z: 9.81 - index * 0.005,
        },
        timestamp: index * 40,
      },
      CALIBRATION_MOTION_CONFIG,
    );
    state = result.state;
    if (result.hit) hits += 1;
  }
  assert.equal(hits, 0);
});

test("calibration adapts the hit threshold and keeps safe bounds", () => {
  const ordinary = createCalibratedMotionConfig([2.5, 3, 3.5]);
  assert.ok(Math.abs(ordinary.hitThreshold - 1.2) < Number.EPSILON * 2);
  assert.ok(ordinary.jerkThreshold >= 3.2);

  assert.equal(createCalibratedMotionConfig([0.2, 0.3, 0.4]).hitThreshold, 0.5);
  assert.equal(createCalibratedMotionConfig([30, 32, 34]).hitThreshold, 6.5);
});

test("sensitivity profiles trade weak-hit detection for false-positive resistance", () => {
  const base = createCalibratedMotionConfig([2.5, 3, 3.5]);
  const low = applyMotionSensitivity(base, "low");
  const normal = applyMotionSensitivity(base, "normal");
  const high = applyMotionSensitivity(base, "high");

  assert.ok(low.hitThreshold > normal.hitThreshold);
  assert.ok(normal.hitThreshold > high.hitThreshold);
  assert.ok(low.jerkThreshold > normal.jerkThreshold);
  assert.ok(normal.jerkThreshold > high.jerkThreshold);
  assert.equal(low.cooldownMs, 720);
  assert.equal(normal.cooldownMs, 520);
  assert.equal(high.cooldownMs, 420);
});
