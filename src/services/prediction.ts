export type Schedule = {
  anchorTimestamp: number;
  spawnIntervalSeconds: number;
  searchWindowMinutes: number;
  version: number;
};

export type Prediction = {
  cycle: number;
  nextTimestamp: number;
  windowStart: number;
  windowEnd: number;
  driftSeconds: number;
  progressPercent: number;
  secondsUntilNext: number;
};

export type CalibrationState = {
  confirmedSpawns: Array<{
    actualTimestamp: number;
    predictedTimestamp: number;
    drift: number;
  }>;
  userAnchor: number | null;
  averageDrift: number;
  confidence: number;
  lastCalibrationCycle?: number;
};

export function getCurrentUtcTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function buildPrediction(schedule: Schedule, calibration: CalibrationState, now: number): Prediction {
  const anchor = calibration.userAnchor ?? schedule.anchorTimestamp;
  const elapsed = now - anchor;
  const cycle = Math.floor(elapsed / schedule.spawnIntervalSeconds);
  const nextTimestamp = anchor + (cycle + 1) * schedule.spawnIntervalSeconds;
  const windowMinutes = schedule.searchWindowMinutes;
  const windowStart = nextTimestamp - windowMinutes * 60;
  const windowEnd = nextTimestamp + windowMinutes * 60;
  const driftSeconds = now - nextTimestamp;
  const secondsUntilNext = Math.max(0, nextTimestamp - now);
  const progressPercent = Math.min(100, Math.max(0, ((now - windowStart) / (windowEnd - windowStart)) * 100));

  return {
    cycle,
    nextTimestamp,
    windowStart,
    windowEnd,
    driftSeconds,
    progressPercent,
    secondsUntilNext,
  };
}

export function applyCalibrationConfirmation(schedule: Schedule, calibration: CalibrationState, actualTimestamp: number, predictedTimestamp: number): CalibrationState {
  const drift = actualTimestamp - predictedTimestamp;
  const confirmedSpawns = [
    ...calibration.confirmedSpawns,
    { actualTimestamp, predictedTimestamp, drift },
  ];
  const averageDrift = confirmedSpawns.reduce((sum, entry) => sum + entry.drift, 0) / confirmedSpawns.length;
  const userAnchor = calibration.userAnchor ?? schedule.anchorTimestamp;
  const nextUserAnchor = userAnchor + averageDrift;
  const lastCalibrationCycle = Math.max(0, Math.floor((actualTimestamp - (calibration.userAnchor ?? schedule.anchorTimestamp)) / schedule.spawnIntervalSeconds));

  return {
    ...calibration,
    confirmedSpawns,
    userAnchor: nextUserAnchor,
    averageDrift,
    confidence: 1,
    lastCalibrationCycle,
  };
}

export function getCalibrationConfidence(calibration: CalibrationState, prediction: Prediction) {
  const lastCalibrationCycle = calibration.lastCalibrationCycle ?? 0;
  const cyclesSinceCalibration = Math.max(0, prediction.cycle - lastCalibrationCycle);
  const confidence = Math.max(0, 1 - cyclesSinceCalibration * 0.02);
  return Number(confidence.toFixed(2));
}

export function createWindowLabel(prediction: Prediction) {
  const start = new Date(prediction.windowStart * 1000);
  const end = new Date(prediction.windowEnd * 1000);

  const formatFriendly = (value: Date) =>
    value.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  return `${formatFriendly(start)} → ${formatFriendly(end)}`;
}

export function formatCountdown(prediction: Prediction) {
  const hours = Math.floor(prediction.secondsUntilNext / 3600);
  const minutes = Math.floor((prediction.secondsUntilNext % 3600) / 60);
  const seconds = prediction.secondsUntilNext % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function getRecentSpawnTimestamps(prediction: Prediction, schedule: Schedule, count = 3) {
  return Array.from({ length: count }, (_, index) => prediction.nextTimestamp - (index + 1) * schedule.spawnIntervalSeconds);
}
