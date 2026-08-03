import { describe, expect, it } from 'vitest';
import { CalibrationState } from './calibration';
import { SpawnTimestamp } from './timestamp';

describe('calibration state', () => {
  it('starts with no timestamps', () => {
    const calibration = new CalibrationState();
    calibration.reset();
    expect(calibration.getTimestamps()).toHaveLength(0);
    expect(calibration.getStatus()).toBe('estimated');
  });

  it('adds a unique timestamp and preserves order', () => {
    const calibration = new CalibrationState();
    calibration.reset();
    const first = new SpawnTimestamp(new Date(Date.now() - 120000));
    const second = new SpawnTimestamp(new Date());

    calibration.addTimestamp(second);
    calibration.addTimestamp(first);

    expect(calibration.getTimestamps()[0].getTimestamp()).toBe(first.getTimestamp());
    expect(calibration.getTimestamps().length).toBe(2);
  });

  it('ignores duplicate timestamps within a cycle buffer', () => {
    const calibration = new CalibrationState();
    calibration.reset();
    const first = new SpawnTimestamp(new Date());
    const duplicate = new SpawnTimestamp(new Date(first.getTimestamp() * 1000 + 30 * 1000));

    calibration.addTimestamp(first);
    calibration.addTimestamp(duplicate);

    expect(calibration.getTimestamps()).toHaveLength(1);
  });

  it('can remove a specific timestamp entry', () => {
    const calibration = new CalibrationState();
    calibration.reset();
    const first = new SpawnTimestamp(new Date());
    const second = new SpawnTimestamp(new Date(first.getTimestamp() * 1000 + 9050 * 1000));

    calibration.addTimestamp(first);
    calibration.addTimestamp(second);
    calibration.removeTimestamp(0);

    expect(calibration.getTimestamps()).toHaveLength(1);
    expect(calibration.getTimestamps()[0].getTimestamp()).toBe(second.getTimestamp());
  });

  it('restores saved timestamps as Timestamp instances', () => {
    const calibration = new CalibrationState();
    calibration.reset();
    const timestamp = new SpawnTimestamp(new Date());
    calibration.addTimestamp(timestamp);

    const restored = new CalibrationState();
    expect(restored.getTimestamps()).toHaveLength(1);
    expect(restored.getTimestamps()[0]).toBeInstanceOf(SpawnTimestamp);
    expect(restored.getTimestamps()[0].getTimestamp()).toBe(timestamp.getTimestamp());
  });

  it('prefers the current-week drift and otherwise averages historical drift', () => {
    const calibration = new CalibrationState();
    calibration.reset();

    const currentWeekTimestamp = new SpawnTimestamp(new Date(Date.now() - 2 * 60 * 60 * 1000));
    const historicalTimestamp = new SpawnTimestamp(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));

    calibration.addTimestamp(historicalTimestamp);
    calibration.addTimestamp(currentWeekTimestamp);

    expect(calibration.getAverageDrift()).toBe(currentWeekTimestamp.getDrift());
  });

  it('does not throw when local storage is unavailable', () => {
    const calibration = new CalibrationState();
    calibration.reset();

    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('storage unavailable');
        },
        setItem: () => {
          throw new Error('storage unavailable');
        },
        removeItem: () => {
          throw new Error('storage unavailable');
        },
        clear: () => {
          throw new Error('storage unavailable');
        },
      },
    });

    expect(() => calibration.addTimestamp(new SpawnTimestamp(new Date()))).not.toThrow();

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });
});