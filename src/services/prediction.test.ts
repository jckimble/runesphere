import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CalibrationState } from './calibration';
import { PredictedTimestamp } from './prediction';
import { DespawnTimestamp, ImportedSpawnTimestamp, ResetTimestamp, SpawnTimestamp } from './timestamp';
import { SPAWN_INTERVAL_SECONDS } from './constants';

function createSpawnAt(resetTimestamp: ResetTimestamp, additionalDriftSeconds: number) {
  const timestamp = resetTimestamp.getTimestamp() + additionalDriftSeconds;
  return new SpawnTimestamp(new Date(timestamp * 1000));
}

function createDespawnAt(resetTimestamp: ResetTimestamp, additionalDriftSeconds: number) {
  const spawnTimestamp = resetTimestamp.getTimestamp() + additionalDriftSeconds;
  const despawnTimestamp = spawnTimestamp + 3620;
  return new DespawnTimestamp(new Date(despawnTimestamp * 1000));
}

function createPreviousWeekSpawn(resetTimestamp: ResetTimestamp, driftSeconds: number) {
  const resetDate = new Date(resetTimestamp.getNormalizedTimestamp() * 1000);
  resetDate.setUTCDate(resetDate.getUTCDate() - 7);
  const previousWeekSpawn = new Date((resetTimestamp.getTimestamp() + driftSeconds - 7 * 24 * 3600) * 1000);
  return new SpawnTimestamp(previousWeekSpawn);
}

describe('RuneSphere timing services', () => {
  beforeAll(() => {
    if (typeof window === 'undefined') {
      Object.defineProperty(globalThis, 'window', {
        value: {
        localStorage: {
          storage: {} as Record<string, string>,
          getItem(key: string) {
            return this.storage[key] ?? null;
          },
          setItem(key: string, value: string) {
            this.storage[key] = value;
          },
          removeItem(key: string) {
            delete this.storage[key];
          },
          clear() {
            this.storage = {} as Record<string, string>;
          },
        },
        URLSearchParams: globalThis.URLSearchParams,
        location: {
          pathname: '/',
          origin: 'http://localhost',
          search: '',
        },
        history: {
          replaceState: vi.fn(),
        },
      },
      configurable: true,
    });
    }
  });

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
  });

  it('calculates spawn drift from a confirmed spawn timestamp', () => {
    const resetTimestamp = new ResetTimestamp();
    const spawn = createSpawnAt(resetTimestamp, 42);

    expect(spawn.getDrift()).toBe(42);
    expect(spawn.getCycle()).toBe(1);
  });

  it('calculates despawn drift using normalized spawn time', () => {
    const resetTimestamp = new ResetTimestamp();
    const despawn = createDespawnAt(resetTimestamp, 37);

    expect(despawn.getDrift()).toBe(37);
    expect(despawn.getCycle()).toBe(1);
    expect(despawn.getNormalizedTimestamp()).toBe(resetTimestamp.getTimestamp() + 37);
  });

  it('parses imported unix and ISO timestamps correctly', () => {
    const unixSeconds = 1700000000;
    const importedNumeric = new ImportedSpawnTimestamp(unixSeconds);
    expect(importedNumeric.getTimestamp()).toBe(unixSeconds);
    expect(importedNumeric.getDrift()).toBe(importedNumeric.getDrift());

    const isoString = new Date(unixSeconds * 1000).toISOString();
    const importedIso = new ImportedSpawnTimestamp(isoString);
    expect(importedIso.getTimestamp()).toBe(unixSeconds);
  });

  it('returns zero drift when no calibration history exists', () => {
    const resetTimestamp = new ResetTimestamp();
    const calibration = new CalibrationState();
    calibration.reset();

    const prediction = new PredictedTimestamp(resetTimestamp, calibration);
    expect(prediction.getDrift()).toBe(0);
    expect(prediction.getCalibrationSummary().weeks).toBe(0);
    expect(prediction.getCalibrationSummary().totalEntries).toBe(0);
  });

  it('uses current week first spawn drift when current week has confirmed entries', () => {
    const resetTimestamp = new ResetTimestamp();
    const calibration = new CalibrationState();
    calibration.reset();

    const currentWeekSpawn = createSpawnAt(resetTimestamp, 25);
    calibration.addTimestamp(currentWeekSpawn);

    const prediction = new PredictedTimestamp(resetTimestamp, calibration);
    expect(prediction.getDrift()).toBe(25);
    expect(prediction.getCalibrationSummary().weeks).toBe(1);
    expect(prediction.getCalibrationSummary().currentWeekCount).toBe(1);
    expect(prediction.getCalibrationSummary().currentWeekFirstDrift).toBe(25);
  });

  it('averages week drift when no current-week confirmation exists', () => {
    const resetTimestamp = new ResetTimestamp();
    const calibration = new CalibrationState();
    calibration.reset();

    const previousWeekSpawn = createPreviousWeekSpawn(resetTimestamp, 15);
    calibration.addTimestamp(previousWeekSpawn);

    const otherPreviousWeekSpawn = new SpawnTimestamp(
      new Date((previousWeekSpawn.getTimestamp() + SPAWN_INTERVAL_SECONDS) * 1000),
    );
    calibration.addTimestamp(otherPreviousWeekSpawn);

    const prediction = new PredictedTimestamp(resetTimestamp, calibration);
    const summary = prediction.getCalibrationSummary();

    expect(summary.weeks).toBe(1);
    expect(summary.totalEntries).toBe(2);
    expect(summary.currentWeekCount).toBe(0);
    expect(summary.currentWeekFirstDrift).toBe(0);
    expect(summary.weekSummaries[0].firstDrift).toBe(15);
    expect(summary.weekSummaries[0].entries).toHaveLength(2);
    expect(summary.currentWeekAverageIntervalDrift).toBe(0);
    expect(prediction.getDrift()).toBe(15);
  });
});
