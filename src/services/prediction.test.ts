import { describe, expect, it } from 'vitest';
import { buildPrediction, getCalibrationConfidence, getRecentSpawnTimestamps } from './prediction';
import { StaticSchedule } from './schedule';
import { CalibrationSpawn, CalibrationState } from './calibration';

class TestCalibrationState extends CalibrationState {
  private cycle: number
  constructor(cs: CalibrationSpawn[] = [],cycle:number = -1) {
    super();
    this.cycle=cycle
    this.confirmedSpawns = cs;
  }
  getCycle(): number {
    if (this.cycle != -1){
      return this.cycle
    }
    return super.getCycle()
  }
}
const emptyCalibration = new TestCalibrationState();

describe('prediction math', () => {
  it('calculates the next window around the anchor', () => {
    const schedule = new StaticSchedule(
      1000,
      50,
      100,
      10,
      1,
    );

    const prediction = buildPrediction(schedule, emptyCalibration, 1050);
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

    const prediction = buildPrediction(schedule, emptyCalibration, 1105);
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

    const prediction = buildPrediction(schedule, emptyCalibration, 1155);
    expect(prediction.cycle).toBe(1);
    expect(prediction.displayTimestamp).toBe(1200);
    expect(prediction.windowStart).toBe(1200 - 600);
    expect(prediction.windowEnd).toBe(1200 + 600);
  });

  it('calculates the next window after a confirmed spawn', () => {
    const schedule = new StaticSchedule(
      1000,
      100,
      50,
      10,
      1
    );
    const calibration = new TestCalibrationState([{ actualTimestamp: 1105, resetTimestamp: 1100, drift: 5, cycle:1 }]);

    const prediction = buildPrediction(schedule, calibration, 1150);
    expect(prediction.displayTimestamp).toBe(1105);
    expect(prediction.driftSeconds).toBe(45);
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
    const calibration = new TestCalibrationState([],3);
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
