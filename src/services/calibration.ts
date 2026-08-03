import { Timestamp } from "./timestamp";

export class CalibrationState {
  private spawnTimestamps: Timestamp[] = [];
  private readonly STORAGE_KEY = "calibrationState";

  constructor() {
    this.load();
    if(this.prune()){
      this.save();
    }
  }

  getTimestamps(): Timestamp[] {
    return this.spawnTimestamps;
  }

  addTimestamp(timestamp: Timestamp) {
    if (this.spawnTimestamps.some(t => t.matches(timestamp))) {
      return;
    }
    this.spawnTimestamps.push(timestamp);
    this.spawnTimestamps.sort((a, b) => a.getNormalizedTimestamp() - b.getNormalizedTimestamp());
    this.save();
  }

  removeTimestamp(index: number) {
    this.spawnTimestamps.splice(index, 1);
    this.save();
  }

  reset() {
    this.spawnTimestamps = [];
    this.save();
  }

  getStatus(): "verified" | "calibrated" | "estimated" {
    if (this.spawnTimestamps.length === 0) {
      return "estimated";
    }

    const currentWeek = this.spawnTimestamps.some(
      (spawn) => spawn.thisWeeklyReset(),
    );

    if (currentWeek) {
      return "verified";
    }

    return "calibrated";
  }

  private prune(): boolean {
    const cutoff = Math.floor(Date.now()/1000) - (60*60*24*90);
    const before = this.spawnTimestamps.length;
    this.spawnTimestamps = this.spawnTimestamps.filter(t => t.getNormalizedTimestamp() >= cutoff);
    return before !== this.spawnTimestamps.length;
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
      this.spawnTimestamps = (data.spawnTimestamps ?? []).map((t: {type: string, timestamp: number}) => Timestamp.fromJSON(t));
    } catch {
      this.spawnTimestamps = [];
    }
  }

  private save() {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      this.STORAGE_KEY,
      JSON.stringify({
        spawnTimestamps: this.spawnTimestamps.map(t => t.toJSON()),
      }),
    );
  }
}
