export type MotionVector = {
  x: number | null;
  y: number | null;
  z: number | null;
};

export type MotionSample = {
  acceleration: MotionVector | null;
  accelerationIncludingGravity: MotionVector | null;
  timestamp: number;
};

export type MotionDetectorConfig = {
  hitThreshold: number;
  jerkThreshold: number;
  cooldownMs: number;
  gravitySmoothing: number;
};

export type MotionDetectorState = {
  gravity: { x: number; y: number; z: number } | null;
  lastMagnitude: number;
  lastTimestamp: number | null;
  lastHitAt: number;
};

export type MotionAnalysis = {
  state: MotionDetectorState;
  magnitude: number;
  jerk: number;
  hit: boolean;
  source: "linear" | "gravity-filtered" | "unavailable";
};

export const CALIBRATION_MOTION_CONFIG: MotionDetectorConfig = {
  hitThreshold: 1.15,
  jerkThreshold: 6.5,
  cooldownMs: 340,
  gravitySmoothing: 0.9,
};

export const DEFAULT_MOTION_CONFIG: MotionDetectorConfig = {
  hitThreshold: 1.4,
  jerkThreshold: 7,
  cooldownMs: 300,
  gravitySmoothing: 0.9,
};

export function createMotionDetectorState(): MotionDetectorState {
  return {
    gravity: null,
    lastMagnitude: 0,
    lastTimestamp: null,
    lastHitAt: Number.NEGATIVE_INFINITY,
  };
}

function toFiniteVector(vector: MotionVector | null) {
  if (!vector) return null;
  const x = typeof vector.x === "number" && Number.isFinite(vector.x) ? vector.x : null;
  const y = typeof vector.y === "number" && Number.isFinite(vector.y) ? vector.y : null;
  const z = typeof vector.z === "number" && Number.isFinite(vector.z) ? vector.z : null;
  if (x === null || y === null || z === null) return null;
  return { x, y, z };
}

function magnitude(vector: { x: number; y: number; z: number }) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function analyzeMotionSample(
  previous: MotionDetectorState,
  sample: MotionSample,
  config: MotionDetectorConfig,
): MotionAnalysis {
  const linear = toFiniteVector(sample.acceleration);
  const withGravity = toFiniteVector(sample.accelerationIncludingGravity);
  let nextGravity = previous.gravity;
  let linearVector: { x: number; y: number; z: number } | null = linear;
  let source: MotionAnalysis["source"] = linear ? "linear" : "unavailable";

  if (!linearVector && withGravity) {
    source = "gravity-filtered";
    if (!previous.gravity) {
      nextGravity = withGravity;
      linearVector = { x: 0, y: 0, z: 0 };
    } else {
      const smoothing = clamp(config.gravitySmoothing, 0.5, 0.99);
      nextGravity = {
        x: smoothing * previous.gravity.x + (1 - smoothing) * withGravity.x,
        y: smoothing * previous.gravity.y + (1 - smoothing) * withGravity.y,
        z: smoothing * previous.gravity.z + (1 - smoothing) * withGravity.z,
      };
      linearVector = {
        x: withGravity.x - nextGravity.x,
        y: withGravity.y - nextGravity.y,
        z: withGravity.z - nextGravity.z,
      };
    }
  }

  const currentMagnitude = linearVector ? magnitude(linearVector) : 0;
  const elapsedSeconds =
    previous.lastTimestamp === null
      ? 0
      : clamp((sample.timestamp - previous.lastTimestamp) / 1000, 0.012, 0.25);
  const jerk =
    elapsedSeconds > 0
      ? Math.abs(currentMagnitude - previous.lastMagnitude) / elapsedSeconds
      : 0;
  const outsideCooldown = sample.timestamp - previous.lastHitAt >= config.cooldownMs;
  const hit =
    source !== "unavailable" &&
    currentMagnitude >= config.hitThreshold &&
    jerk >= config.jerkThreshold &&
    outsideCooldown;

  return {
    state: {
      gravity: nextGravity,
      lastMagnitude: currentMagnitude,
      lastTimestamp: sample.timestamp,
      lastHitAt: hit ? sample.timestamp : previous.lastHitAt,
    },
    magnitude: currentMagnitude,
    jerk,
    hit,
    source,
  };
}

export function createCalibratedMotionConfig(
  calibrationPeaks: number[],
): MotionDetectorConfig {
  const usablePeaks = calibrationPeaks
    .filter((peak) => Number.isFinite(peak) && peak > 0)
    .sort((left, right) => left - right);

  if (usablePeaks.length === 0) return DEFAULT_MOTION_CONFIG;

  const middle = Math.floor(usablePeaks.length / 2);
  const median =
    usablePeaks.length % 2 === 0
      ? (usablePeaks[middle - 1] + usablePeaks[middle]) / 2
      : usablePeaks[middle];
  // A real arm target can transmit a softer impulse than the phone-holding hand
  // used during calibration, so use roughly half of the calibrated peak.
  const hitThreshold = clamp(median * 0.48, 1.2, 7.5);

  return {
    hitThreshold,
    jerkThreshold: clamp(hitThreshold * 3.4, 7, 32),
    cooldownMs: 300,
    gravitySmoothing: 0.9,
  };
}
