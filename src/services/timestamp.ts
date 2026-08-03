import { SPAWN_INTERVAL_SECONDS, SPHERE_LIFETIME_SECONDS } from "./constants";

export abstract class Timestamp {
  abstract getCycle(): number;
  abstract getTimestamp(): number;
  abstract getDrift(): number;

  abstract readonly type: string;

  matches(other: Timestamp, bufferSeconds = 60): boolean {
    if (this.getCycle() !== other.getCycle()) {
      return false;
    }
    return Math.abs(this.getNormalizedTimestamp() - other.getNormalizedTimestamp()) < bufferSeconds;
  }

  thisWeeklyReset(): boolean {
    return this.getResetTimestamp() === this.getResetTimestamp(new Date(this.getNormalizedTimestamp() * 1000));
  }

  getNormalizedTimestamp(): number {
    return this.getTimestamp();
  }

  toJSON() {
    return {
        type: this.type,
        timestamp: this.getTimestamp()
    }
  }

  static fromJSON(json: {type: string, timestamp: number}): Timestamp {
    switch (json.type) {
        case "spawn":
            return new SpawnTimestamp(json.timestamp);
        case "despawn":
            return new DespawnTimestamp(json.timestamp);
        case "imported_spawn":
            return new ImportedSpawnTimestamp(json.timestamp);
        default:
            throw new Error(`Unknown timestamp type: ${json.type}`);
    }
  }

  protected getResetTimestamp(now: Date = new Date()): number {
    const currentDay = now.getUTCDay();
    const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;
    const resetDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        10,
        30,
        0,
        0,
      ),
    );
    resetDate.setUTCDate(resetDate.getUTCDate() - daysToSubtract);
    if (now.getTime() < resetDate.getTime()) {
      resetDate.setUTCDate(resetDate.getUTCDate() - 7);
    }
    return Math.floor(resetDate.getTime() / 1000);
  }

};

export class ResetTimestamp extends Timestamp {
  readonly type = "reset";

  getCycle(): number {
    return 0;
  }

  getTimestamp(): number {
    return this.getResetTimestamp() + SPAWN_INTERVAL_SECONDS;
  }

  getNormalizedTimestamp(): number {
    return this.getResetTimestamp();
  }

  getDrift(): number {
    return 0;
  }
}

export class SpawnTimestamp extends Timestamp {
  readonly type = "spawn";

  private timestamp: number;
  private now: Date;

  constructor();
  // eslint-disable-next-line no-unused-vars
  constructor(timestamp: number);
  // eslint-disable-next-line no-unused-vars
  constructor(timestamp: Date);

  constructor(timestamp: number | Date = new Date()) {
    super();
    if (timestamp instanceof Date) {
      this.now = timestamp;
      this.timestamp = Math.floor(timestamp.getTime() / 1000);
    } else {
      this.now = new Date(timestamp * 1000);
      this.timestamp = timestamp;
    }
  } 

  getCycle(): number {
    const resetTimestamp = this.getResetTimestamp(this.now);
    return Math.floor((this.timestamp - resetTimestamp) / SPAWN_INTERVAL_SECONDS);
  }

  getDrift(): number {
    const resetTimestamp = this.getResetTimestamp(this.now);
    const cycle = this.getCycle();
    return this.timestamp - (resetTimestamp + cycle * SPAWN_INTERVAL_SECONDS);
  }

  getTimestamp(): number {
    return this.timestamp;
  }
}

export class DespawnTimestamp extends Timestamp {
  readonly type = "despawn";

  private timestamp: number;

  constructor();
  // eslint-disable-next-line no-unused-vars
  constructor(timestamp: number);
  // eslint-disable-next-line no-unused-vars
  constructor(timestamp: Date);

  constructor(timestamp: number | Date = new Date()) {
    super();

    if (timestamp instanceof Date) {
      this.timestamp = Math.floor(timestamp.getTime() / 1000);
    } else {
      this.timestamp = timestamp;
    }
  }

  getCycle(): number {
    const spawnTimestamp = this.timestamp - SPHERE_LIFETIME_SECONDS;
    const resetTimestamp = this.getResetTimestamp(new Date(this.timestamp * 1000));

    return Math.floor(
      (spawnTimestamp - resetTimestamp) / SPAWN_INTERVAL_SECONDS
    );
  }

  getDrift(): number {
    const spawnTimestamp = this.timestamp - SPHERE_LIFETIME_SECONDS;
    const resetTimestamp = this.getResetTimestamp(new Date(this.timestamp * 1000));
    const cycle = Math.floor((spawnTimestamp - resetTimestamp) / SPAWN_INTERVAL_SECONDS);
    return spawnTimestamp - (resetTimestamp + cycle * SPAWN_INTERVAL_SECONDS);
  }

  getNormalizedTimestamp(): number {
    return this.timestamp - SPHERE_LIFETIME_SECONDS;
  }

  getTimestamp(): number {
    return this.timestamp;
  }
}

export class ImportedSpawnTimestamp extends Timestamp {
  readonly type = "imported_spawn";
 
  private timestamp: number;
  private now: Date;

  // eslint-disable-next-line no-unused-vars
  constructor(timestamp: number);
  // eslint-disable-next-line no-unused-vars
  constructor(timestamp: string);

  constructor(timestamp: number | string) {
    super();
    if (typeof timestamp === 'number' || /^[0-9]+$/.test(timestamp)) {
      const value = typeof timestamp === 'number' ? timestamp : Number(timestamp);
      const seconds = value > 1_000_000_0000 ? Math.floor(value / 1000) : value;
      this.now = new Date(seconds * 1000);
      this.timestamp = seconds;
    } else {
      this.now = new Date(timestamp);
      this.timestamp = Math.floor(this.now.getTime() / 1000);
    }
  } 

  getCycle(): number {
    const resetTimestamp = this.getResetTimestamp(this.now);
    return Math.floor((this.timestamp - resetTimestamp) / SPAWN_INTERVAL_SECONDS);
  }

  getDrift(): number {
    const resetTimestamp = this.getResetTimestamp(this.now);
    const cycle = this.getCycle();
    return this.timestamp - (resetTimestamp + cycle * SPAWN_INTERVAL_SECONDS);
  }

  getTimestamp(): number {
    return this.timestamp;
  }
}