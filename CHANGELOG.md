# Changelog

All notable changes to Glassist are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Glasses nav state machine with Home → List → Subtasks levels and per-frame cursor
- Single-container rendering pipeline: `createStartUpPageContainer` once, `textContainerUpgrade` for every subsequent input (flicker-free)
- Home menu rendering: Today / Upcoming / Inbox / All tasks with task counts
- Task-line renderer with a 38-char budget: cursor, glyph slot, title, right-aligned due
- List renderer with tap-header-to-pop and inline subtask drill-down via `▶` trailing
- In-session completion tracking per list frame (session `×` marker; flush on level exit)
- Fake task and project dataset to iterate on glasses UX before backends land
- Due-date formatter: `late` / `today` / `tmrw` / `2d`–`6d` / day-of-week / `M/D`, max 5 chars
- 21 unit tests across `priority`, `due`, `line`, and `nav`

### Changed
- Cursor indicator: `> ` → `│ ` (U+2502, thinner pixel footprint on the non-monospaced font)
- Priority type widened from 1–4 to 1–5 with optional undefined, matching Vikunja's scale; Todoist tasks fit naturally in 1–4
- Priority glyphs tuned on-hardware: `★` (5) / `●` (4) / `◆` (3) / `◇` (2) / `○` (1) — same-family geometric shapes for consistent scale
- "Has subtasks" indicator: `▸` → `▶` (firmware font lacks U+25B8)
- "No priority" slot widened to 5 spaces; "Completed" slot is ` × ` padded — on-glass tuning achieves title alignment across states
- List headers preserve original case (was all-caps)
- Dev server port: 5175 → 5173

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
