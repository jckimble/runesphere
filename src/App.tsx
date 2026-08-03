import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import { getCurrentUtcTimestamp, PredictedTimestamp } from './services/prediction';
import { CalibrationState } from './services/calibration';
import { CircleCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { SEARCH_WINDOW_MINUTES, SPAWN_INTERVAL_SECONDS, SPHERE_LIFETIME_SECONDS } from './services/constants';
import { DespawnTimestamp, ImportedSpawnTimestamp, ResetTimestamp, SpawnTimestamp, Timestamp } from './services/timestamp';

const tabs = ['Home', 'Upcoming', 'Settings', 'Calibration', 'Developer'] as const;
type Tab = (typeof tabs)[number];

const CALIBRATION_STATUS = {
  verified: {
    label: 'Verified',
    badgeClass: "border-green-500/30 bg-green-500/10 text-green-200",
    textClass: "text-green-300",
    description: 'Based on a RuneSphere you have confirmed this week',
    icon: CircleCheck,
  },
  calibrated: {
    label: 'Calibrated',
    badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
    textClass: "text-cyan-300",
    description: 'Using your average timing from the last 4 weeks',
    icon: Sparkles,
  },
  estimated: {
    label: 'Estimated',
    badgeClass: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    textClass: "text-yellow-300",
    description: 'Using weekly reset timing only. Confirm a RuneSphere to improve accuracy',
    icon: TriangleAlert,
  },
} as const;

function formatCountdown(secondsUntilNext: number) {
  const hours = Math.floor(secondsUntilNext / 3600);
  const minutes = Math.floor((secondsUntilNext % 3600) / 60);
  const seconds = secondsUntilNext % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function createWindowLabel(timestamp: Timestamp, active: boolean) {
  const spawn = timestamp.getNormalizedTimestamp();
  const start = new Date((spawn - (SEARCH_WINDOW_MINUTES * 60)) * 1000);
  const end = new Date((spawn + (active ? SPHERE_LIFETIME_SECONDS : 0) + (SEARCH_WINDOW_MINUTES * 60)) * 1000);

  const formatFriendly = (value: Date) =>
    value.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  return `${formatFriendly(start)} → ${formatFriendly(end)}`;
}

function formatDuration(seconds: number) {
  const absolute = Math.abs(seconds);
  const minutes = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  const sign = seconds < 0 ? '-' : '';

  if (minutes > 0) {
    return `${sign}${minutes}m ${remainder}s`;
  }

  return `${sign}${remainder}s`;
}

function formatLocalLabel(timestampSeconds: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestampSeconds * 1000));
}

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RuneSphere app render error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [now, setNow] = useState(() => getCurrentUtcTimestamp());
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
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [calibrationVersion, setCalibrationVersion] = useState(0);

  const restartTimestamp = useMemo(() => new ResetTimestamp(), []);
  const calibration = useMemo(() => new CalibrationState(), []);
  const prediction = useMemo(
    () => new PredictedTimestamp(restartTimestamp, calibration),
    [restartTimestamp, calibration, calibrationVersion],
  );

  const calibrationStatus = useMemo(() => CALIBRATION_STATUS[calibration.getStatus()], [calibration]);
  const calibrationSummary = useMemo(() => calibration.getSummary(), [calibration]);

  const nextPrediction = useMemo(
    () => new PredictedTimestamp(restartTimestamp, calibration, prediction.getCycle() + 1),
    [restartTimestamp, calibration, prediction],
  );

  const displayPrediction = useMemo(() => {
    const currentSpawn = prediction.getNormalizedTimestamp();
    const currentEnd = currentSpawn + SPHERE_LIFETIME_SECONDS;

    if (now < currentEnd) {
      return prediction;
    }

    return nextPrediction;
  }, [prediction, nextPrediction, now]);

  const runesphere = useMemo(() => {
    const currentSpawn = displayPrediction.getNormalizedTimestamp();
    const currentEnd = currentSpawn + SPHERE_LIFETIME_SECONDS;
    const active = now >= currentSpawn && now < currentEnd;
    const secondsUntilNext = active ? currentEnd - now : currentSpawn - now;

    const offPeriodStart = now < currentSpawn
      ? currentSpawn - (SPAWN_INTERVAL_SECONDS - SPHERE_LIFETIME_SECONDS)
      : currentEnd;

    const progressPercent = active
      ? ((now - currentSpawn) / SPHERE_LIFETIME_SECONDS) * 100
      : ((now - offPeriodStart) / (SPAWN_INTERVAL_SECONDS - SPHERE_LIFETIME_SECONDS)) * 100;

    const progress = Math.min(100, Math.max(0, progressPercent));
    return {
      progressPercent: progress,
      secondsUntilNext,
      active,
      currentSpawn,
      currentEnd,
    };
  }, [displayPrediction, now]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(getCurrentUtcTimestamp()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const search = new window.URLSearchParams(window.location.search);
    const importValue = search.get('t');
    if (!importValue) {
      return;
    }

    const value = importValue.trim();
    const parsed = /^[0-9]+$/.test(value)
      ? Number(value)
      : Date.parse(value);

    const timestampSeconds = Number.isNaN(parsed) || parsed <= 0 ? NaN : parsed > 1_000_000_0000 ? Math.floor(parsed / 1000) : parsed;

    if (Number.isNaN(timestampSeconds) || timestampSeconds <= 0) {
      setStatusMessage('Unable to import timestamp. Use a valid Unix or ISO timestamp.');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const imported = new ImportedSpawnTimestamp(parsed);
    if (calibration.getTimestamps().some((entry) => entry.matches(imported))) {
      setStatusMessage('Timestamp already imported into calibration.');
    } else {
      calibration.addTimestamp(imported);
      setStatusMessage('Imported timestamp from query string and updated calibration.');
      setCalibrationVersion((version) => version + 1);
    }

    window.history.replaceState({}, '', window.location.pathname);
  }, [calibration]);

  useEffect(() => {
    if (!notificationsEnabled || notificationPermission !== 'granted') {
      return;
    }
    const start = (prediction.getNormalizedTimestamp() - (SEARCH_WINDOW_MINUTES * 60));
    const end = (prediction.getNormalizedTimestamp() + SPHERE_LIFETIME_SECONDS + (SEARCH_WINDOW_MINUTES * 60));

    const windowKey = `${start}-${end}`;
    const isInsideWindow = now >= start && now <= end;

    if (isInsideWindow && notifiedWindowKey !== windowKey) {
      const title = 'RuneSphere search window is open';
      const body = `Window starts at ${new Date(start * 1000).toLocaleTimeString()} UTC.`;
      new Notification(title, { body, tag: 'runesphere-window' });
      setNotifiedWindowKey(windowKey);
    }
  }, [notificationsEnabled, notificationPermission, notifiedWindowKey, now, prediction]);

  const recentSpawns = useMemo(() => {
    return Array.from({ length: displayCount }, (_, index) => new PredictedTimestamp(restartTimestamp, calibration, prediction.getCycle() - (index + 1)).getNormalizedTimestamp());
  }, [prediction, displayCount]);

  const upcomingWindows = useMemo(() => {
    return Array.from({ length: displayCount }, (_, index) => new PredictedTimestamp(restartTimestamp, calibration, prediction.getCycle() + (index + 1)).getNormalizedTimestamp());
  }, [prediction, displayCount]);

  const handleConfirmSpawn = () => {
    try {
      calibration.addTimestamp(new SpawnTimestamp());
      setStatusMessage('Calibration updated from the latest confirmation.');
      setCalibrationVersion((version) => version + 1);
    } catch (error) {
      console.error('Unable to record spawn confirmation', error);
      setStatusMessage('Unable to record the confirmation. Please try again.');
    }
  };
  const handleConfirmDespawn = () => {
    try {
      calibration.addTimestamp(new DespawnTimestamp());
      setStatusMessage('Calibration updated from the latest confirmation.');
      setCalibrationVersion((version) => version + 1);
    } catch (error) {
      console.error('Unable to record despawn confirmation', error);
      setStatusMessage('Unable to record the confirmation. Please try again.');
    }
  }

  const handleResetCalibration = () => {
    calibration.reset();
    setStatusMessage('Calibration reset. Stock timing remains unchanged.');
    setCalibrationVersion((version) => version + 1);
  };

  const handleDeleteCalibrationEntry = (index: number) => {
    calibration.removeTimestamp(index);
    setStatusMessage('Calibration entry removed.');
  };

  const handleShareCalibrationEntry = async (entry: Timestamp) => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}?t=${entry.getNormalizedTimestamp()}`;
    const shareData = {
      title: 'RuneSphere calibration link',
      text: 'Share this RuneSphere timestamp to help calibrate the prediction.',
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShareMessage('Shared successfully.');
      } catch (error) {
        // eslint-disable-next-line no-undef
        if ((error as DOMException).name !== 'AbortError') {
          setStatusMessage('Unable to share link using the browser share API.');
        }
      }
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      setShareMessage('Link copied to clipboard.');
    } else {
      setStatusMessage('Unable to share or copy link on this browser.');
    }

    window.setTimeout(() => setShareMessage(null), 3000);
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

  return (
    <ErrorBoundary fallback={(
      <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-800 bg-slate-900/80 p-6 text-center shadow-2xl shadow-black/30">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-3 text-sm text-slate-400">The app hit an unexpected error while rendering. Please refresh and try again.</p>
        </div>
      </div>
    )}>
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-400">RuneSphere Finder</p>
            <h1 className="text-3xl font-semibold">Predict search windows before they open</h1>
            <p className="mt-2 text-sm text-slate-400">Track recent spawns, upcoming windows, and calibration status in one view.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
              <p className="text-sm uppercase tracking-[0.3em] text-slate-400">{runesphere.active?"Current RuneSphere":"Next search window"}</p>
              <p className="text-sm text-slate-600">{runesphere.active?"Runesphere spawned at: "+formatLocalLabel(prediction.getNormalizedTimestamp()):"Runesphere will spawn soon"}</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">{createWindowLabel(displayPrediction,runesphere.active)}</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">{runesphere.active?"RuneSphere despawns in ":"RuneSphere spawns in "}</p>
                  <p className="mt-2 text-2xl font-semibold">{formatCountdown(runesphere.secondsUntilNext)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <p className="text-sm text-slate-400">Cycle number</p>
                  <p className="mt-2 text-2xl font-semibold">{prediction.getCycle()}</p>
                </div>
              </div>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500" style={{ width: `${runesphere.progressPercent}%` }} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button onClick={handleConfirmSpawn} className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-slate-950">RuneSphere Spawned</button>
                <button onClick={handleConfirmDespawn} className="rounded-xl bg-fuchsia-500 px-4 py-2 font-medium text-slate-950">RuneSphere Despawned</button>
              </div>
            </motion.section>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold">Prediction Details</h3>
                  <div className={`flex items-center gap-3 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] ${calibrationStatus.badgeClass}`}>
                    <calibrationStatus.icon size={14} />
                    {calibrationStatus.label}
                  </div>
                </div>
                <ul className="mt-4 space-y-3 text-sm text-slate-300">
                  <li className={calibrationStatus.textClass}>{calibrationStatus.description}</li>
                  <li>Base Timestamp: {formatLocalLabel(restartTimestamp.getNormalizedTimestamp())}</li>
                  <li>Calibration Offset: {prediction.getDrift() !== 0 ? formatDuration(prediction.getDrift()) : 'not set'}</li>
                  <li>Search window: ±{SEARCH_WINDOW_MINUTES} minutes</li>
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
          </section>
        )}

        {activeTab === 'Calibration' && (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">Your calibration history</h3>
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">Your adjusted time: {prediction.getDrift() !== 0 ? formatLocalLabel(prediction.getNormalizedTimestamp()) : 'not set'}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={handleResetCalibration} className="rounded-xl bg-fuchsia-500 px-4 py-2 font-medium text-slate-950">Reset calibration</button>
            </div>
            <div className="mt-4 text-sm text-slate-400">Calibration status: <span className={calibrationStatus.textClass}>{calibrationStatus.label}</span></div>
            {shareMessage && (
              <div className="mt-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-200">{shareMessage}</div>
            )}
            <div className="mt-4 space-y-3">
              {calibration.getTimestamps().length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-400">No confirmations yet. Mark a spawn when it happens to refine the model.</div>
              ) : (
                calibration.getTimestamps().map((entry, index) => (
                  <div key={`${entry.getNormalizedTimestamp()}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">#{index + 1} • {entry.type.replace('_', ' ')}</div>
                        <div className="mt-1 text-slate-400">Observed {formatLocalLabel(entry.getNormalizedTimestamp())}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleShareCalibrationEntry(entry)} className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">Share</button>
                        <button onClick={() => { handleDeleteCalibrationEntry(index); setCalibrationVersion((v) => v + 1); }} className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">Delete</button>
                      </div>
                    </div>
                    <div className="mt-3 text-slate-300">Offset: {entry.getDrift()}s</div>
                    <div className="mt-1 text-slate-400">Cycle: {entry.getCycle()}</div>
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
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Base time: {formatLocalLabel(restartTimestamp.getNormalizedTimestamp())}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Your adjusted time: {prediction.getDrift() !== 0 ? formatLocalLabel(prediction.getNormalizedTimestamp()) : 'not set'}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Cycle number: {prediction.getCycle()}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Average offset: {prediction.getDrift()}s</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Prediction Status: {calibrationStatus.label}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Prediction window: {createWindowLabel(prediction,runesphere.active)}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Search window: {formatLocalLabel(prediction.getNormalizedTimestamp() - (SEARCH_WINDOW_MINUTES * 60))} → {formatLocalLabel(prediction.getNormalizedTimestamp() + (SEARCH_WINDOW_MINUTES * 60))}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Calibration entries: {calibrationSummary.totalEntries}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Calibration weeks: {calibrationSummary.weeks}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Current week count: {calibrationSummary.currentWeekCount}</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Current week first drift: {calibrationSummary.currentWeekFirstDrift}s</div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">Current week avg interval drift: {calibrationSummary.currentWeekAverageIntervalDrift}s</div>
            </div>
          </section>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default App;
