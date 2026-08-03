import { CalibrationState } from "./calibration";
import { SPAWN_INTERVAL_SECONDS } from "./constants";
import { Timestamp } from "./timestamp";

export function getCurrentUtcTimestamp() {
  return Math.floor(Date.now() / 1000);
}

export interface CalibrationWeekSummary {
  reset: number;
  entries: Timestamp[];
  firstDrift: number;
  averageIntervalDrift: number;
  weekDrift: number;
}

export class PredictedTimestamp extends Timestamp {
  type = "predicted";

  // eslint-disable-next-line no-unused-vars
  constructor(private resetTimestamp: Timestamp, private calibration: CalibrationState, private cycle?: number) {
    super();
  }

  getCycle(): number {
    if (this.cycle != null) {
      return this.cycle;
    }

    const now = getCurrentUtcTimestamp();
    const drift = this.getDrift();
    const firstSpawn = this.resetTimestamp.getTimestamp() + drift;
    const elapsedSinceFirstSpawn = now - firstSpawn;
    return Math.max(0, Math.floor(elapsedSinceFirstSpawn / SPAWN_INTERVAL_SECONDS));
  }
  getTimestamp(): number {
    return this.resetTimestamp.getTimestamp() + (this.getCycle() * SPAWN_INTERVAL_SECONDS) + this.getDrift();
  }

  getNormalizedTimestamp(): number {
    return this.getTimestamp();
  }

  getDrift(): number {
    const weeklySummaries = this.getCalibrationWeekSummary();
    if (weeklySummaries.length === 0) {
      return 0;
    }

    const currentReset = this.getResetTimestamp();
    const currentWeek = weeklySummaries.find((summary) => summary.reset === currentReset);
    if (currentWeek) {
      return currentWeek.weekDrift;
    }

    const totalWeekDrift = weeklySummaries.reduce((sum, summary) => sum + summary.weekDrift, 0);
    return Math.round(totalWeekDrift / weeklySummaries.length);
  }

  getCalibrationSummary() {
    const weeklySummaries = this.getCalibrationWeekSummary();
    const currentReset = this.getResetTimestamp();
    const currentWeek = weeklySummaries.find((summary) => summary.reset === currentReset);

    return {
      totalEntries: weeklySummaries.reduce((sum, summary) => sum + summary.entries.length, 0),
      weeks: weeklySummaries.length,
      currentWeekCount: currentWeek?.entries.length ?? 0,
      currentWeekFirstDrift: currentWeek?.firstDrift ?? 0,
      currentWeekAverageIntervalDrift: currentWeek?.averageIntervalDrift ?? 0,
      appliedDrift: this.getDrift(),
      weekSummaries: weeklySummaries,
    };
  }

  private getCalibrationWeekSummary(): CalibrationWeekSummary[] {
    const timestamps = this.calibration.getTimestamps();
    const timedSpawns = timestamps.filter(
      (entry) => entry.type === "spawn" || entry.type === "despawn" || entry.type === "imported_spawn",
    );

    if (timedSpawns.length === 0) {
      return [];
    }

    const grouped = timedSpawns.reduce((map, entry) => {
      const normalizedTimestamp = entry.getNormalizedTimestamp();
      const resetTimestamp = this.getResetTimestamp(new Date(normalizedTimestamp * 1000));
      const items = map.get(resetTimestamp) ?? [];
      items.push(entry);
      map.set(resetTimestamp, items);
      return map;
    }, new Map<number, Timestamp[]>());

    return Array.from(grouped.entries()).map(([reset, entries]) => {
      const sorted = entries.slice().sort((a, b) => a.getNormalizedTimestamp() - b.getNormalizedTimestamp());
      const firstEntry = sorted[0];
      const firstDrift = firstEntry.getDrift();

      let totalIntervalDrift = 0;
      let intervalCount = 0;

      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const expectedDelta = (current.getCycle() - previous.getCycle()) * SPAWN_INTERVAL_SECONDS;
        const actualDelta = current.getNormalizedTimestamp() - previous.getNormalizedTimestamp();
        totalIntervalDrift += actualDelta - expectedDelta;
        intervalCount += 1;
      }

      const averageIntervalDrift = intervalCount === 0 ? 0 : Math.round(totalIntervalDrift / intervalCount);
      const weekDrift = firstDrift + averageIntervalDrift;

      return {
        reset,
        entries: sorted,
        firstDrift,
        averageIntervalDrift,
        weekDrift,
      };
    });
  }
}
