import { CalibrationState } from "./calibration";
import { Schedule } from "./schedule";

export type Prediction = {
  cycle: number;
  displayTimestamp: number;
  windowStart: number;
  windowEnd: number;
  driftSeconds: number;
  progressPercent: number;
  secondsUntilNext: number;
  active: boolean;
};

export function getCurrentUtcTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function buildPrediction(schedule: Schedule, calibration: CalibrationState, now: number): Prediction {
  const anchor = schedule.getAnchor() + calibration.getDrift();
  const elapsed = now - anchor;
  const cycle = Math.floor(elapsed / schedule.spawnIntervalSeconds);

  const currentSpawn = anchor + cycle * schedule.spawnIntervalSeconds;
  const nextSpawn = currentSpawn + schedule.spawnIntervalSeconds;

  const currentEnd = currentSpawn + schedule.sphereLifetimeSeconds;

  const showingCurrent = now >= currentSpawn && now < currentEnd;

  const displayTimestamp = showingCurrent ? currentSpawn : nextSpawn;
  
  const windowStart = displayTimestamp - schedule.searchWindowMinutes * 60;
  const windowEnd = showingCurrent ? currentEnd : displayTimestamp + schedule.searchWindowMinutes * 60;


  const active = showingCurrent;

  const driftSeconds = now - displayTimestamp;
  const secondsUntilNext = active ? currentEnd - now : nextSpawn - now;
  const progressPercent = active ? ((now - currentSpawn) / schedule.sphereLifetimeSeconds) * 100 : ((now - currentEnd) / (schedule.spawnIntervalSeconds - schedule.sphereLifetimeSeconds)) * 100;

  const progress = Math.min(100, Math.max(0, progressPercent));

  return {
    cycle,
    displayTimestamp,
    windowStart,
    windowEnd,
    driftSeconds,
    progressPercent: progress,
    secondsUntilNext,
    active,
  };
}

export function getCalibrationConfidence(calibration: CalibrationState, prediction: Prediction) {
  const lastCalibrationCycle = calibration.getCycle();
  const cyclesSinceCalibration = Math.max(0, prediction.cycle - lastCalibrationCycle);
  const confidence = Math.max(0, 1 - cyclesSinceCalibration * 0.01);
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
  return Array.from({ length: count }, (_, index) => prediction.displayTimestamp - (index + 1) * schedule.spawnIntervalSeconds);
}
