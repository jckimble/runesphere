export type CalibrationSpawn = {
    actualTimestamp: number;
    resetTimestamp: number;
    drift: number;
    cycle: number;
}

export const CalibrationSpawnTimestamp = (actualTimestamp: number): CalibrationSpawn => {
    const now = new Date(actualTimestamp * 1000);
    const currentDay = now.getUTCDay();
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
    const resetDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        10, 30, 0, 0
    ));
    resetDate.setUTCDate(resetDate.getUTCDate() - daysToSubtract);
    if (now.getTime() < resetDate.getTime()) {
        resetDate.setUTCDate(resetDate.getUTCDate() - 7);
    }
    const resetTimestamp = Math.floor(resetDate.getTime() / 1000);

    const drift = (actualTimestamp - resetTimestamp) % 9050;
    const cycle = Math.floor((actualTimestamp - resetTimestamp) / 9050);
    return {
        actualTimestamp,
        resetTimestamp,
        drift,
        cycle
    }
}

export class CalibrationState {
  public confirmedSpawns: CalibrationSpawn[] = [];
  private readonly STORAGE_KEY = "calibrationState";

  constructor() {
    this.load();
  }

  addSpawn(actualTimestamp: number) {
    this.confirmedSpawns.push(
      CalibrationSpawnTimestamp(actualTimestamp)
    );
    this.save();
  }

  removeSpawn(index: number) {
    this.confirmedSpawns.splice(index, 1);
    this.save();
  }

  reset() {
    this.confirmedSpawns = [];
    this.save();
  }

  getDrift(): number {
    if (this.confirmedSpawns.length === 0) {
      return 0;
    }
    const weeklySpawns = Array.from(
        this.confirmedSpawns.reduce((map, spawn) => {
            const existing = map.get(spawn.resetTimestamp);
            if (!existing || spawn.cycle < existing.cycle) {
                map.set(spawn.resetTimestamp, spawn);
            }
            return map;
        }, new Map<number, CalibrationSpawn>())
    .values())
    const totalDrift = weeklySpawns.reduce((sum, spawn) => sum + spawn.drift,0);
    return Math.round(totalDrift / weeklySpawns.length);
  }

  getCycle(): number {
    if (this.confirmedSpawns.length === 0) {
      return 0;
    }
    const weekResetTimestamp = this.getResetTimestamp();
    const currentWeekSpawns = this.confirmedSpawns.filter(
        spawn => spawn.resetTimestamp === weekResetTimestamp
    );

    if (currentWeekSpawns.length === 0) {
        return 0;
    }

    return Math.max(
        ...currentWeekSpawns.map(spawn => spawn.cycle)
    );
  }

  private getResetTimestamp(now: Date = new Date()): number {
    const currentDay = now.getUTCDay();
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
    const resetDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        10, 30, 0, 0
    ));
    resetDate.setUTCDate(resetDate.getUTCDate() - daysToSubtract);
    if (now.getTime() < resetDate.getTime()) {
        resetDate.setUTCDate(resetDate.getUTCDate() - 7);
    }
    return Math.floor(resetDate.getTime() / 1000);
  }

  private load() {
    if (typeof window === 'undefined') {
      return;
    }

    const stored = window.localStorage.getItem(this.STORAGE_KEY);

    if (!stored) {
      return;
    }

    try {
      const data = JSON.parse(stored);
      this.confirmedSpawns = data.confirmedSpawns ?? [];
    } catch {
      this.confirmedSpawns = [];
    }
  }

  private save() {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify({
        confirmedSpawns: this.confirmedSpawns,
      })
    );
  }
}