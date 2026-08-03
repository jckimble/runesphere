import { SPAWN_INTERVAL_SECONDS } from "./constants";
import { Timestamp } from "./timestamp";

export interface CalibrationWeekSummary {
  reset: number;
  entries: Timestamp[];
  firstDrift: number;
  averageIntervalDrift: number;
  weekDrift: number;
}

export class CalibrationState {
  private timestamps: Timestamp[] = [];
  private readonly STORAGE_KEY = "calibrationState";

  constructor() {
    this.load();
    if (this.prune()) {
      this.save();
    }
  }

  getTimestamps(): Timestamp[] {
    return this.timestamps;
  }

  addTimestamp(timestamp: Timestamp) {
    if (this.timestamps.some((entry) => entry.matches(timestamp))) {
      return;
    }
    this.timestamps.push(timestamp);
    this.timestamps.sort((a, b) => a.getNormalizedTimestamp() - b.getNormalizedTimestamp());
    this.save();
  }

  removeTimestamp(index: number) {
    this.timestamps.splice(index, 1);
    this.save();
  }

  reset() {
    this.timestamps = [];
    this.save();
  }

  getStatus(): "verified" | "calibrated" | "estimated" {
    if (this.timestamps.length === 0) {
      return "estimated";
    }

    const currentWeek = this.timestamps.some((entry) => entry.thisWeeklyReset());

    if (currentWeek) {
      return "verified";
    }

    return "calibrated";
  }

  getAverageDrift(): number {
    if (this.timestamps.length === 0) {
      return 0;
    }

    const weeklySummaries = this.getWeekSummaries();
    const currentWeek = weeklySummaries.find((summary) => summary.reset === Timestamp.getResetTimestamp(new Date()));

    if (currentWeek) {
      return currentWeek.weekDrift;
    }

    if (weeklySummaries.length === 0) {
      return 0;
    }

    const totalWeekDrift = weeklySummaries.reduce((sum, summary) => sum + summary.weekDrift, 0);
    return Math.round(totalWeekDrift / weeklySummaries.length);
  }

  getSummary(referenceResetTimestamp?: number) {
    const weeklySummaries = this.getWeekSummaries(referenceResetTimestamp);
    const currentReset = referenceResetTimestamp ?? Timestamp.getResetTimestamp(new Date());
    const currentWeek = weeklySummaries.find((summary) => summary.reset === currentReset);

    return {
      totalEntries: weeklySummaries.reduce((sum, summary) => sum + summary.entries.length, 0),
      weeks: weeklySummaries.length,
      currentWeekCount: currentWeek?.entries.length ?? 0,
      currentWeekFirstDrift: currentWeek?.firstDrift ?? 0,
      currentWeekAverageIntervalDrift: currentWeek?.averageIntervalDrift ?? 0,
      appliedDrift: this.getAverageDrift(),
      weekSummaries: weeklySummaries,
    };
  }

  private prune(): boolean {
    const cutoff = Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 90);
    const before = this.timestamps.length;
    this.timestamps = this.timestamps.filter((entry) => entry.getNormalizedTimestamp() >= cutoff);
    return before !== this.timestamps.length;
  }

  private load() {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(this.STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const data = JSON.parse(stored);
      this.timestamps = (data.spawnTimestamps ?? []).map((entry: { type: string; timestamp: number }) => Timestamp.fromJSON(entry));
    } catch {
      this.timestamps = [];
    }
  }

  private save() {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify({
        spawnTimestamps: this.timestamps.map((entry) => entry.toJSON()),
      }),
    );
  }

  private getWeekSummaries(referenceResetTimestamp?: number): CalibrationWeekSummary[] {
    const timedSpawns = this.timestamps.filter(
      (entry) => entry.type === "spawn" || entry.type === "despawn" || entry.type === "imported_spawn",
    );

    if (timedSpawns.length === 0) {
      return [];
    }

    const grouped = timedSpawns.reduce((map, entry) => {
      const normalizedTimestamp = entry.getNormalizedTimestamp();
      const resetTimestamp = Timestamp.getResetTimestamp(new Date(normalizedTimestamp * 1000));
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
