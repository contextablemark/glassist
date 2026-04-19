# Changelog

All notable changes to Glassist are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Glasses now read real data from the configured backend (fake-data module removed). Home shows Today / Upcoming / Inbox / All counts; tapping drills into the live list; tapping a task completes it via the backend.
- Synthetic `▲ Back` row on every pushed list/subtasks frame — the only reliable way to pop a level on a `ListContainer` since the firmware emits no event when the user swipes past a boundary that has no scroll range.
- Header-only toast feedback for completions: tapping a task shows `done: <title>` (or `undo: <title>` on re-tap) in the header for ~2.5 seconds, then reverts. The list container is left untouched so the firmware's selection does not reset.
- `▶` indicator restored for tasks known to have subtasks. Parent IDs are derived from the `all` fetch we already do for Home counts, so no extra network calls.
- Home counts show `(N+)` when the backend reports more pages than we fetched (cap at 200 per request via the Todoist SDK's `limit` arg).
- Phone↔glasses sync: `saveSettings` dispatches a `glassist:settings-changed` CustomEvent and the glasses `Nav` rebuilds its backend when fired.
- `TodoBackend.getSubtasks(parentId)` on the interface, implemented for Todoist via `api.getTasks({ parentId })`.
- Empty lists render as a `▲ Back` + `(no tasks)` list instead of a dead-end status screen, so the user can always navigate back.

### Changed
- Glasses rendering switched from a single `TextContainer` that we updated on every gesture to a `ListContainer` + optional header `TextContainer`. Firmware paints the native selection border and handles internal scrolling — no more scroll-jump flash on every swipe.
- Completion UX is now deferred: tapping a task calls the backend API in the background but does not rebuild the list. The `×` inline glyph is gone; feedback lives in the header toast. Rebuilds happen only on navigation, errors, and settings changes, preserving firmware selection through completion bursts.
- `TodoBackend.getTasks` now returns `{ tasks, hasMore }`; Todoist requests `limit: 200` per page so counts are accurate up to the SDK cap.
- Priority type widened from `1 | 2 | 3 | 4` to `1 | 2 | 3 | 4 | 5 | undefined`, matching Vikunja's scale; Todoist's range fits at 1–4.
- Priority glyphs tuned for the firmware font: `★ ● ◆ ◇ ○` across 5 levels, with blank slots for no-priority. Slot widths chosen on-glass so titles line up reasonably on the non-monospaced font.
- `▸` (U+25B8) replaced with `▶` (U+25B6) — the firmware font's glyph set lacks U+25B8 and was silently dropping it.
- Home now has a persistent `Glassist` header above the menu.
- List/subtasks headers no longer display the `▲` trailing; the synthetic `▲ Back` row makes it redundant and the header can't capture events anyway (only one event-capturing container per page).
- `TodoistBackend` now uses the official `@doist/todoist-sdk` (v9.3.0) instead of hand-rolled REST: the SDK owns pagination, headers, and error shapes, and we stop maintaining them.
- `makeBackend` is now async — backend adapter modules are loaded via dynamic `import()` so the ~210 KB gz of SDK + zod lands in on-demand chunks instead of the initial bundle. First-load size stays at ~92 KB gz.
- A `browserFetch` adapter wraps `window.fetch` to satisfy the SDK's `CustomFetchResponse` contract (headers normalized from `Headers` → `Record<string,string>`).
- `@evenrealities/even_hub_sdk` bumped from 0.0.9 → 0.0.10. No API surface changes; the `readNumber` 0-is-missing quirk is still present in 0.0.10 so our explicit `undefined → 0` fallback stays in `input.ts`.

### Fixed
- Tapping the first item (index 0) on any `ListContainer` — Home's first menu entry, the `▲ Back` row — previously did nothing. The SDK's `readNumber` helper treats zero as a missing field, so `currentSelectItemIndex=0` arrived as `undefined`. `input.ts` now snaps `undefined`/`null` back to `0`.
- Subtasks no longer leak into flat list views (Today / Upcoming / Inbox / All). The backend's results are filtered to top-level tasks before both the count and the list render.

### Removed
- In-session `×` marker on completed items (moved to header toast — see above).
- Manual windowing / `itemsPerPage` plumbing in `Nav`. Firmware handles scrolling inside the `ListContainer` natively.
- `src/glasses/fake.ts` (no longer used now that the glasses read real data).

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
