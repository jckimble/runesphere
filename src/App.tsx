import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import { applyCalibrationConfirmation, buildPrediction, createWindowLabel, formatCountdown, getCalibrationConfidence, getCurrentUtcTimestamp, getLastWeeklyResetTimestamp, getRecentSpawnTimestamps, type CalibrationState, type Prediction, type Schedule } from './services/prediction';
import { exportDiagnostics, importDiagnostics, loadCalibration, loadSchedule, saveCalibration } from './services/storage';

const tabs = ['Home', 'Upcoming', 'Settings', 'Calibration', 'Developer'] as const;
type Tab = (typeof tabs)[number];

function formatLocalLabel(timestampSeconds: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestampSeconds * 1000));
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [schedule, setSchedule] = useState<Schedule>(loadSchedule());
  const [calibration, setCalibration] = useState<CalibrationState>(loadCalibration());
  const [now, setNow] = useState(() => getCurrentUtcTimestamp());
  const [importText, setImportText] = useState('');
  const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied' | null>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return null;
    }
    return Notification.permission;
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notifiedWindowKey, setNotifiedWindowKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('Ready for the next RuneSphere window.');
  const [displayCount, setDisplayCount] = useState(6);

  const [reset, setReset] = useState(() => getLastWeeklyResetTimestamp())

  const prediction = useMemo<Prediction>(() => buildPrediction(schedule, calibration, now), [schedule, calibration, now, reset]);
  const confidence = useMemo(() => getCalibrationConfidence(calibration, prediction), [calibration, prediction]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(getCurrentUtcTimestamp()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setReset(getLastWeeklyResetTimestamp()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    saveCalibration(calibration);
  }, [calibration]);

  useEffect(() => {
    if (!notificationsEnabled || notificationPermission !== 'granted') {
      return;
    }

    const windowKey = `${prediction.windowStart}-${prediction.windowEnd}`;
    const isInsideWindow = now >= prediction.windowStart && now <= prediction.windowEnd;

    if (isInsideWindow && notifiedWindowKey !== windowKey) {
      const title = 'RuneSphere search window is open';
      const body = `Window starts at ${new Date(prediction.windowStart * 1000).toLocaleTimeString()} UTC.`;
      new Notification(title, { body, tag: 'runesphere-window' });
      if ('vibrate' in navigator) {
        navigator.vibrate?.(200);
      }
      setNotifiedWindowKey(windowKey);
    }
  }, [notificationsEnabled, notificationPermission, notifiedWindowKey, now, prediction.windowEnd, prediction.windowStart]);

  const recentSpawns = useMemo(() => {
    return getRecentSpawnTimestamps(prediction, schedule, displayCount);
  }, [prediction, schedule, displayCount]);

  const upcomingWindows = useMemo(() => {
    return Array.from({ length: displayCount }, (_, index) => prediction.displayTimestamp + (index + 1) * schedule.spawnIntervalSeconds);
  }, [prediction.displayTimestamp, schedule.spawnIntervalSeconds, displayCount]);

  const handleConfirmSpawn = () => {
    const nextCalibration = applyCalibrationConfirmation(schedule, calibration, now, prediction.displayTimestamp);
    setCalibration(nextCalibration);
    setStatusMessage('Calibration updated from the latest confirmation.');
  };

  const handleResetCalibration = () => {
    const resetState: CalibrationState = {
      confirmedSpawns: [],
      userAnchor: null,
      averageDrift: 0,
      confidence: 1,
      lastCalibrationCycle: 0,
    };
    setCalibration(resetState);
    setStatusMessage('Calibration reset. Stock timing remains unchanged.');
  };

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setStatusMessage('Browser notifications are not available on this device.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setNotificationsEnabled(permission === 'granted');
    setStatusMessage(permission === 'granted' ? 'Notifications enabled.' : 'Notifications were not enabled.');
  };

  const handleExport = () => {
    const payload = exportDiagnostics(schedule, calibration);
    // eslint-disable-next-line no-undef
    const blob = new Blob([payload], { type: 'application/json' });
    // eslint-disable-next-line no-undef
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'runesphere-diagnostics.json';
    link.click();
    // eslint-disable-next-line no-undef
    URL.revokeObjectURL(url);
    setStatusMessage('Diagnostics exported.');
  };

  const handleImport = () => {
    try {
      const imported = importDiagnostics(importText);
      setSchedule(imported.schedule);
      setCalibration(imported.calibration);
      setStatusMessage('Configuration imported successfully.');
    } catch {
      setStatusMessage('Unable to import that file. Please check the JSON format.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">RuneSphere Finder</p>
            <h1 className="text-3xl font-semibold">Predict search windows before they open</h1>
            <p className="mt-2 text-sm text-slate-400">Track recent spawns, upcoming windows, and calibration confidence in one view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-cyan-200">Live</div>
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
              <div>Current time: {formatLocalLabel(now)}</div>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${activeTab === tab ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          {statusMessage}
        </div>

        {activeTab === 'Home' && (
          <main className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm transition-all duration-200 hover:-translate-y-1 hover:border-cyan-500/30">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{prediction.active?"Current RuneSphere":"Next search window"}</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">{createWindowLabel(prediction)}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Time left</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCountdown(prediction)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Cycle number</p>
                  <p className="mt-2 text-2xl font-semibold">{prediction.cycle}</p>
                </div>
              </div>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500" style={{ width: `${prediction.progressPercent}%` }} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={handleConfirmSpawn} className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950">Found RuneSphere</button>
                <button onClick={handleResetCalibration} className="rounded-xl border border-slate-700 px-4 py-2 font-medium text-slate-200">Reset calibration</button>
              </div>
            </motion.section>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold">Current settings</h3>
                  <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-cyan-200">Confidence {(confidence * 100).toFixed(0)}%</div>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  <li>Base time: {formatLocalLabel(schedule.anchorTimestamp)}</li>
                  <li>Repeat every: {schedule.spawnIntervalSeconds} seconds</li>
                  <li>Search window: ±{schedule.searchWindowMinutes} minutes</li>
                  <li>Calibration decays by 2% per cycle after a confirmation.</li>
                </ul>
              </section>
              <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <h3 className="text-xl font-semibold">Last spawns</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  {recentSpawns.map((candidate, index) => (
                    <div key={candidate} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                      <div>Spawn {index + 1}</div>
                      <div className="mt-1 font-medium">{formatLocalLabel(candidate)}</div>
                      <div className="text-slate-400">{formatDistanceToNowStrict(new Date(candidate * 1000), { addSuffix: true })}</div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <h3 className="text-xl font-semibold">Upcoming windows</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  {upcomingWindows.map((candidate, index) => (
                    <div key={candidate} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
                      <div>Window {index + 1}</div>
                      <div className="mt-1 font-medium">{formatLocalLabel(candidate)}</div>
                      <div className="text-slate-400">{formatDistanceToNowStrict(new Date(candidate * 1000), { addSuffix: true })}</div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </main>
        )}

        {activeTab === 'Upcoming' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">Last spawns</h3>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <span>Show</span>
                  <select value={displayCount} onChange={(event) => setDisplayCount(Number(event.target.value))} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100">
                    {[3, 6, 9, 12].map((count) => (
                      <option key={count} value={count}>{count}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 grid gap-3">
                {recentSpawns.map((candidate, index) => (
                  <div key={candidate} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <p className="text-sm text-slate-400">Spawn {index + 1}</p>
                    <p className="mt-2 font-semibold">{formatLocalLabel(candidate)}</p>
                    <p className="mt-1 text-sm text-slate-400">{formatDistanceToNowStrict(new Date(candidate * 1000), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">Upcoming windows</h3>
                <div className="text-sm text-slate-400">{displayCount} shown</div>
              </div>
              <div className="mt-4 grid gap-3">
                {upcomingWindows.map((candidate, index) => (
                  <div key={candidate} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                    <p className="text-sm text-slate-400">Window {index + 1}</p>
                    <p className="mt-2 font-semibold">{formatLocalLabel(candidate)}</p>
                    <p className="mt-1 text-sm text-slate-400">{formatDistanceToNowStrict(new Date(candidate * 1000), { addSuffix: true })}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'Settings' && (
          <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <h3 className="text-xl font-semibold">Alerts</h3>
              <div className="mt-4 space-y-4 text-sm text-slate-300">
                <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <span>Browser notifications</span>
                  <input type="checkbox" checked={notificationsEnabled} onChange={() => setNotificationsEnabled((value) => !value)} className="h-4 w-4 rounded border-slate-600 bg-slate-900" />
                </label>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="mb-2 text-slate-400">Permission</p>
                  <p>{notificationPermission ?? 'Unavailable'}</p>
                </div>
                <button onClick={handleEnableNotifications} className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950">Request permission</button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
              <h3 className="text-xl font-semibold">Save or restore</h3>
              <div className="mt-4 space-y-4">
                <button onClick={handleExport} className="rounded-xl border border-slate-700 px-4 py-2 font-medium text-slate-200">Export diagnostics</button>
                <textarea
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  className="min-h-40 w-full rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-sm text-slate-200"
                  placeholder="Paste exported JSON here"
                />
                <button onClick={handleImport} className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950">Import configuration</button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'Calibration' && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Your calibration history</h3>
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">Your adjusted time: {calibration.userAnchor ? formatLocalLabel(calibration.userAnchor) : 'not set'}</div>
            </div>
            <div className="mt-4 space-y-3">
              {calibration.confirmedSpawns.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-400">No confirmations yet. Mark a spawn when it happens to refine the model.</div>
              ) : (
                calibration.confirmedSpawns.map((entry, index) => (
                  <div key={`${entry.actualTimestamp}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
                    <div className="font-medium">#{index + 1} • Offset {entry.drift}s</div>
                    <div className="mt-1 text-slate-400">Observed {formatLocalLabel(entry.actualTimestamp)} • Expected {formatLocalLabel(entry.predictedTimestamp)}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {activeTab === 'Developer' && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <h3 className="text-xl font-semibold">Technical details</h3>
            <div className="mt-4 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Current Unix time: {now}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Current time: {formatLocalLabel(now)}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Base time: {formatLocalLabel(schedule.anchorTimestamp)}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Your adjusted time: {calibration.userAnchor ? formatLocalLabel(calibration.userAnchor) : 'not set'}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Cycle number: {prediction.cycle}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Time since predicted spawn: {Math.abs(prediction.driftSeconds)}s</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Average offset: {calibration.averageDrift}s</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Confidence: {(confidence * 100).toFixed(0)}%</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Prediction window: {createWindowLabel(prediction)}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Window range: {formatLocalLabel(prediction.windowStart)} → {formatLocalLabel(prediction.windowEnd)}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Exported diagnostics: {exportDiagnostics(schedule, calibration)}</div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
