# RuneSphere Finder Project Spec

## Overview
- Product: RuneSphere Finder
- Purpose: Predict RuneScape 3 RuneSphere search windows using a configurable anchor timestamp and interval.
- Model: Predictions are based on UTC time and use a configurable search window around the next predicted spawn.

## Current Implementation Status
- React + Vite + TypeScript app scaffolded and running.
- Tailwind-powered UI with a multi-tab experience for Home, Upcoming, Settings, Calibration, and Developer views.
- Prediction logic isolated in the services layer and covered by Vitest tests.
- Local storage-backed calibration state for user-adjusted anchors, confirmation history, and cycle-based confidence decay.
- Recent spawns and upcoming windows shown together on the home experience and in the dedicated upcoming view.
- Import/export support for configuration and diagnostics JSON.
- Browser notifications and vibration support when available.
- PWA manifest and service worker integration via Vite PWA.
- GitHub Actions workflow for install, lint, test, build, and deployment to GitHub Pages.

## Core Data Model
- Schedule: anchor timestamp, spawn interval in seconds, search window in minutes, version.
- Calibration state: confirmed spawns, user anchor, average drift, confidence, and last calibration cycle.
- Predictions: cycle number, next timestamp, window start/end, drift, progress percent, and seconds until next.

## Functional Requirements
- Use UTC internally for all calculations.
- Use the user anchor when calibration is present; otherwise fall back to the stock anchor.
- Store and load calibration locally in browser storage.
- Support reset of calibration without destroying the stock schedule.
- Support export/import of diagnostics and configuration payloads.
- Support browser notifications for active search windows.
- Derive confidence from the number of cycles since the last calibration event, with a gentle 2% decay per cycle.

## Validation
- Tests: Vitest for prediction math, calibration updates, and recent-spawn helpers.
- Build: TypeScript + Vite production build.
- Lint: ESLint for app code.

## Notes
- This spec should be updated when the project shape, workflows, or user-facing features change.
