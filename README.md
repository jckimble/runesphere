# RuneSphere Finder

RuneSphere Finder is a Progressive Web App for predicting RuneScape 3 RuneSphere search windows using a configurable anchor timestamp and interval.

## Features
- Predicts search windows using UTC-based timing
- Supports stock and user-calibrated anchors
- Stores calibration data in browser local storage
- Shows recent spawns, upcoming windows, diagnostics, and calibration history
- Uses cycle-based confidence that gently decays after each calibration event
- Supports import/export of diagnostics and configuration JSON
- Includes browser notifications and vibration when available
- Works as an installable PWA

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

### Run tests
```bash
npm test
```

### Build for production
```bash
npm run build
```

## Project structure
- src/App.tsx: main app UI and tabbed experience
- src/services/prediction.ts: prediction and calibration logic
- src/services/storage.ts: local storage helpers and import/export utilities
- public/: static assets, manifest, and data files
- SPEC.md: current project specification
