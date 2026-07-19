import { describe, expect, it } from 'vitest';
import { applyCalibrationConfirmation, buildPrediction, getCalibrationConfidence, getRecentSpawnTimestamps } from './prediction';

describe('prediction math', () => {
  it('calculates the next window around the anchor', () => {
    const schedule = {
      anchorTimestamp: 1000,
      spawnIntervalSeconds: 100,
      searchWindowMinutes: 10,
      version: 1,
    };
    const calibration = {
      confirmedSpawns: [],
      userAnchor: null,
      averageDrift: 0,
      confidence: 0,
    };

    const prediction = buildPrediction(schedule, calibration, 1050);
    expect(prediction.cycle).toBe(0);
    expect(prediction.nextTimestamp).toBe(1100);
    expect(prediction.windowStart).toBe(1100 - 600);
    expect(prediction.windowEnd).toBe(1100 + 600);
  });

  it('uses the user anchor when provided', () => {
    const schedule = {
      anchorTimestamp: 1000,
      spawnIntervalSeconds: 100,
      searchWindowMinutes: 10,
      version: 1,
    };
    const calibration = {
      confirmedSpawns: [],
      userAnchor: 2000,
      averageDrift: 0,
      confidence: 0,
    };

    const prediction = buildPrediction(schedule, calibration, 2100);
    expect(prediction.nextTimestamp).toBe(2200);
  });

  it('updates the calibration anchor from confirmed drift', () => {
    const schedule = {
      anchorTimestamp: 1000,
      spawnIntervalSeconds: 100,
      searchWindowMinutes: 10,
      version: 1,
    };
    const calibration = {
      confirmedSpawns: [],
      userAnchor: null,
      averageDrift: 0,
      confidence: 0,
    };

    const next = applyCalibrationConfirmation(schedule, calibration, 1105, 1100);

    expect(next.userAnchor).toBe(1005);
    expect(next.averageDrift).toBe(5);
    expect(next.confirmedSpawns[0].drift).toBe(5);
  });

  it('returns the most recent spawn timestamps', () => {
    const schedule = {
      anchorTimestamp: 1000,
      spawnIntervalSeconds: 100,
      searchWindowMinutes: 10,
      version: 1,
    };
    const prediction = {
      cycle: 1,
      nextTimestamp: 1100,
      windowStart: 500,
      windowEnd: 1700,
      driftSeconds: 0,
      progressPercent: 0,
      secondsUntilNext: 0,
    };

    expect(getRecentSpawnTimestamps(prediction, schedule, 3)).toEqual([1000, 900, 800]);
  });

  it('derives confidence from cycles since the last calibration', () => {
    const calibration = {
      confirmedSpawns: [],
      userAnchor: null,
      averageDrift: 0,
      confidence: 0,
      lastCalibrationCycle: 3,
    };
    const prediction = {
      cycle: 7,
      nextTimestamp: 1100,
      windowStart: 500,
      windowEnd: 1700,
      driftSeconds: 0,
      progressPercent: 0,
      secondsUntilNext: 0,
    };

    expect(getCalibrationConfidence(calibration, prediction)).toBe(0.92);
  });
});
