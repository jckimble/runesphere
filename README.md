# RuneSphere Finder

RuneSphere Finder is a Progressive Web App for predicting RuneScape 3 RuneSphere search windows.

The application uses the RuneSphere weekly reset time as an anchor and calculates future RuneSphere spawns using the known spawn interval. Optional user confirmations are used to measure timing drift and improve future predictions.

## Features

- Predicts RuneSphere spawn times and search windows
- Uses UTC-based timing from the weekly reset anchor
- Calculates RuneSphere cycles using the 9050 second spawn interval
- Supports manual RuneSphere confirmations for calibration
- Automatically calculates timing drift from confirmed spawns
- Stores calibration history in browser local storage
- Averages calibration data across weekly reset periods
- Shows recent RuneSphere spawns and upcoming search windows
- Displays calibration confidence based on cycles since confirmation
- Includes browser notifications and vibration support when available
- Works as an installable Progressive Web App (PWA)

## How Calibration Works

Calibration does not replace the schedule. Instead, confirmed RuneSphere spawns are used to calculate the difference between the expected schedule and the observed spawn time.

Each confirmation stores:

- Actual spawn timestamp
- Weekly reset timestamp
- RuneSphere cycle number
- Calculated drift from the expected timing

When calculating drift:
- Confirmed spawns are grouped by weekly reset period
- The earliest cycle confirmation from each period is used
- The average drift across available weeks is applied to predictions

This allows the application to adjust for server timing differences without requiring a manually maintained schedule.

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

## Project Structure

```
src/
├── App.tsx
│   Main application UI and tab navigation
│
├── services/
│   ├── prediction.ts
│   │   RuneSphere prediction calculations,
│   │   confidence calculations, and display helpers
│   │
│   ├── calibration.ts
│   │   Spawn confirmation tracking,
│   │   drift calculation, and local storage persistence
│   │
│   └── schedule.ts
│       RuneSphere schedule definition and weekly reset anchor logic
│
├── index.css
│   Application styling
│
└── main.tsx
    Application entry point
```

## Future Improvements

Potential future improvements include:

- Sharing confirmed timestamps through URLs
- Additional calibration visualization
- More detailed prediction accuracy tracking
