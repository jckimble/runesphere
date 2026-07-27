import type { CalibrationState } from './prediction';

const STORAGE_KEYS = {
  calibration: 'runesphere-calibration',
} as const;


const defaultCalibration: CalibrationState = {
  confirmedSpawns: [],
  userAnchor: null,
  averageDrift: 0,
  confidence: 1,
  lastCalibrationCycle: 0,
};

export function loadCalibration(): CalibrationState {
  if (typeof window === 'undefined') {
    return defaultCalibration;
  }

  const stored = window.localStorage.getItem(STORAGE_KEYS.calibration);
  if (!stored) {
    return defaultCalibration;
  }

  try {
    return JSON.parse(stored) as CalibrationState;
  } catch {
    return defaultCalibration;
  }
}

export function saveCalibration(calibration: CalibrationState) {
  window.localStorage.setItem(STORAGE_KEYS.calibration, JSON.stringify(calibration));
}