import type { CalibrationState, Schedule } from './prediction';
import defaultScheduleJson from '../../public/data/defaultSchedule.json';

const STORAGE_KEYS = {
  customSchedule: 'runesphere-custom-schedule',
  calibration: 'runesphere-calibration',
} as const;

const scheduleData: Schedule = defaultScheduleJson as Schedule;

const defaultCalibration: CalibrationState = {
  confirmedSpawns: [],
  userAnchor: null,
  averageDrift: 0,
  confidence: 1,
  lastCalibrationCycle: 0,
};

export function loadSchedule(): Schedule {
  if (typeof window === 'undefined') {
    return scheduleData;
  }

  const stored = window.localStorage.getItem(STORAGE_KEYS.customSchedule);
  if (!stored) {
    return scheduleData;
  }

  try {
    return JSON.parse(stored) as Schedule;
  } catch {
    return scheduleData;
  }
}

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

export function saveSchedule(schedule: Schedule) {
  window.localStorage.setItem(STORAGE_KEYS.customSchedule, JSON.stringify(schedule));
}

export function exportDiagnostics(schedule: Schedule, calibration: CalibrationState) {
  return JSON.stringify({ schedule, calibration }, null, 2);
}

export function importDiagnostics(text: string) {
  const parsed = JSON.parse(text) as { schedule?: Schedule; calibration?: CalibrationState };
  return {
    schedule: parsed.schedule ?? scheduleData,
    calibration: parsed.calibration ?? defaultCalibration,
  };
}
