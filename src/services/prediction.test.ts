import { describe, expect, it } from 'vitest';
import { applyCalibrationConfirmation, buildPrediction, getCalibrationConfidence, getRecentSpawnTimestamps } from './prediction';
import { StaticSchedule } from './schedule';

describe('prediction math', () => {
  it('calculates the next window around the anchor', () => {
    const schedule = new StaticSchedule(
      1000,
      50,
      100,
      10,
      1,
    );
    const calibration = {
      confirmedSpawns: [],
      userAnchor: null,
      averageDrift: 0,
      confidence: 0,
    };

    const prediction = buildPrediction(schedule, calibration, 1050);
    expect(prediction.cycle).toBe(1);
    expect(prediction.displayTimestamp).toBe(1050);
    expect(prediction.windowStart).toBe(1050 - 600);
    expect(prediction.windowEnd).toBe(1050 + 100);
  });

  it('calculates the current window when the runesphere is active', () => {
    const schedule = new StaticSchedule(
      1000,
      100,
      50,
      10,
      1
    );
    const calibration = {
      confirmedSpawns: [],
      userAnchor: null,
      averageDrift: 0,
      confidence: 0,
    };

    const prediction = buildPrediction(schedule, calibration, 1105);
    expect(prediction.cycle).toBe(1);
    expect(prediction.displayTimestamp).toBe(1100);
    expect(prediction.windowStart).toBe(1100 - 600);
    expect(prediction.windowEnd).toBe(1100 + 50);
  });

  it('calculates the next window after the runesphere has expired', () => {
    const schedule = new StaticSchedule(
      1000,
      100,
      50,
      10,
      1
    );
    const calibration = {
      confirmedSpawns: [],
      userAnchor: null,
      averageDrift: 0,
      confidence: 0,
    };

    const prediction = buildPrediction(schedule, calibration, 1155);
    expect(prediction.cycle).toBe(1);
    expect(prediction.displayTimestamp).toBe(1200);
    expect(prediction.windowStart).toBe(1200 - 600);
    expect(prediction.windowEnd).toBe(1200 + 600);
  });

  it('uses the user anchor when provided', () => {
    const schedule = new StaticSchedule(
      1000,
      100,
      50,
      10,
      1,
    );
    const calibration = {
      confirmedSpawns: [],
      userAnchor: 2000,
      averageDrift: 0,
      confidence: 0,
    };

    const prediction = buildPrediction(schedule, calibration, 2100);
    expect(prediction.displayTimestamp).toBe(2100);
  });

  it('calculates the next window after a confirmed spawn', () => {
    const schedule = new StaticSchedule(
      1000,
      100,
      50,
      10,
      1
    );
    const calibration = {
      confirmedSpawns: [{ actualTimestamp: 1105, predictedTimestamp: 1100, drift: 5 }],
      userAnchor: null,
      averageDrift: 5,
      confidence: 1,
    };

    const prediction = buildPrediction(schedule, calibration, 1150);
    expect(prediction.displayTimestamp).toBe(1200);
    expect(prediction.driftSeconds).toBe(-50);
  });

  it('updates the calibration anchor from confirmed drift', () => {
    const schedule = new StaticSchedule(
      1000,
      100,
      50,
      10,
      1,
    );
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
    const schedule = new StaticSchedule(
      1000,
      100,
      50,
      10,
      1,
    );
    const prediction = {
      cycle: 1,
      displayTimestamp: 1100,
      windowStart: 500,
      windowEnd: 1700,
      driftSeconds: 0,
      progressPercent: 0,
      secondsUntilNext: 0,
      active: false
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
      displayTimestamp: 1100,
      windowStart: 500,
      windowEnd: 1700,
      driftSeconds: 0,
      progressPercent: 0,
      secondsUntilNext: 0,
      active: false
    };

    expect(getCalibrationConfidence(calibration, prediction)).toBe(0.96);
  });
});
