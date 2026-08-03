import { CalibrationState } from "./calibration";
import { SPAWN_INTERVAL_SECONDS } from "./constants";
import { Timestamp } from "./timestamp";

export function getCurrentUtcTimestamp() {
  return Math.floor(Date.now() / 1000);
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
    return this.calibration.getAverageDrift();
  }

  getCalibrationSummary() {
    return this.calibration.getSummary(this.getResetTimestamp());
  }
}
