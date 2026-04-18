# Changelog

All notable changes to Glassist are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-04-18

Initial scaffold. Dual-mode bootstrap, splash screen on glasses, three-tab phone settings shell. Backend adapters and voice input are stubs.

### Added
- Vite 6 + TypeScript (strict) + React 19 + Tailwind 4 project scaffold
- `@evenrealities/even_hub_sdk` integration with `waitForEvenAppBridge` bootstrap and phone/glasses context detection
- Glasses splash screen rendered via `createStartUpPageContainer`; double-tap exits with the store-required confirmation dialog
- Gesture input module handling `CLICK_EVENT=0` → `undefined` quirk and a 300 ms scroll cooldown
- Phone settings shell with Connect / Glasses / Voice tabs (placeholder bodies)
- `TodoBackend` interface plus `TodoistBackend` and `VikunjaBackend` adapter stubs
- Storage wrapper that prefers `bridge.setLocalStorage` and falls back to `localStorage`
- `app.json` manifest with `network` (open whitelist) and `g2-microphone` permissions
- `evenhub` CLI wired up via `npm run qr` and `npm run pack`
- MIT license
