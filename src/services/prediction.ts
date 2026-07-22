export type Schedule = {
  anchorTimestamp: number;
  spawnIntervalSeconds: number;
  sphereLifetimeSeconds: number;
  searchWindowMinutes: number;
  version: number;
};

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

export function getLastWeeklyResetTimestamp(): number {
  //TODO: Back align this with the actual weekly reset time in the game. For now, we will give the standard time of 11:30
  const now = new Date();
  const currentDay = now.getUTCDay();
  const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
  const resetDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()-1, // Subtract 1 day cause the day is really sunday, but the reset is on monday
    11, 30, 0, 0
  ));
  resetDate.setUTCDate(resetDate.getUTCDate() - daysToSubtract);
  if (now.getTime() < resetDate.getTime()) {
    resetDate.setUTCDate(resetDate.getUTCDate() - 7);
  }
  return Math.floor(resetDate.getTime() / 1000);
}


export function getCurrentUtcTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export function buildPrediction(schedule: Schedule, calibration: CalibrationState, now: number, resetTimestamp: number = 0): Prediction {
  const resetTime = schedule.spawnIntervalSeconds-schedule.sphereLifetimeSeconds
  const firstRunesphere = resetTime + resetTimestamp
  
  const anchor = Math.max(calibration.userAnchor || 0, schedule.anchorTimestamp, firstRunesphere);
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
  return Array.from({ length: count }, (_, index) => prediction.displayTimestamp - (index + 1) * schedule.spawnIntervalSeconds);
}
