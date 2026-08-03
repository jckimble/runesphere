# RuneSphere Finder

RuneSphere Finder is a Progressive Web App for predicting RuneScape 3 RuneSphere search windows. It uses RuneScape's weekly reset timing plus optional user calibration to estimate upcoming spawn windows and search intervals.

## How it works

- The app uses a weekly reset anchor at 10:30 UTC on Mondays to establish the base spawn cycle.
- RuneSpheres are expected to follow a fixed cycle interval of `9050` seconds between spawns.
- Each sphere remains active for `3620` seconds, and the app shows a search window around the spawn time.
- The prediction engine can work in three modes:
  - `Verified`: A confirmed RuneSphere spawn or despawn has been recorded this week.
  - `Calibrated`: The app averages timing from prior weeks when no current-week confirmation exists.
  - `Estimated`: No calibration exists yet, so it relies on stock weekly reset timing.

## Key features

- Predicts current and future RuneSphere spawn windows in UTC
- Displays nearby recent spawn times and upcoming search windows
- Confirms spawns or despawns to calibrate timing automatically
- Stores calibration history in browser local storage
- Supports import of timestamps via query string (`?t=<unix|ISO>`) and shareable links
- Shows calibration status, confidence details, and developer diagnostics
- Sends browser notifications and vibration alerts during active windows when permitted
- Built as an installable Progressive Web App

## User workflow

1. Open the app and view the next predicted RuneSphere window.
2. Confirm a spawn or despawn to improve future predictions.
3. The app stores confirmed timestamps locally and updates drift calculations.
4. Use the calibration history tab to review, remove, or share timestamp entries.
5. Import a timestamp by appending `?t=<timestamp>` to the URL, where `<timestamp>` is either:
   - a Unix seconds value
   - an ISO datetime string

## Calibration and prediction logic

- The app groups confirmed timestamps by their weekly reset period.
- Each timestamp is converted into a cycle drift relative to the nearest reset anchor.
- If the current week contains confirmed entries, the latest first spawn drift is used.
- If no current-week data is available, the app averages previous week drift values.
- Calibration state is pruned automatically to remove stale entries older than 90 days.

## Development

### Requirements

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Run unit tests

```bash
npm test
```

### Lint the code

```bash
npm run lint
```

### Build for production

```bash
npm run build
```

## Project structure

- `src/App.tsx` - main React UI, navigation tabs, notification handling, and calibration controls
- `src/services/prediction.ts` - prediction engine, drift calculation, and weekly summary generation
- `src/services/calibration.ts` - calibration state management, local storage persistence, and timestamp CRUD
- `src/services/timestamp.ts` - timestamp abstractions for spawn, despawn, reset, and imported entries
- `src/services/constants.ts` - shared timing constants like spawn interval and sphere lifetime
- `src/services/*.test.ts` - unit tests for prediction, calibration, and timestamp logic
- `public/` - static assets, PWA manifest, and data files

## Notes

- The app is designed for UTC-aligned RuneSphere timing and works best when the browser clock is accurate.
- Local storage calibration is browser-specific and does not sync across devices.
- Importing or sharing a timestamp via URL updates the calibration state without manual typing.
