# Changelog

All notable changes to Glassist are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Cloudflare Worker CORS relay** in [`proxy/`](./proxy/README.md). Forwards any path to a configured `UPSTREAM` (defaults to `https://app.vikunja.cloud`) with permissive CORS headers, preserving the caller's `Authorization` header. Required for packaged builds and Vercel deploys since Vikunja Cloud's CORS allowlist blocks non-`localhost` origins. Deploys in one `npm run deploy`.
- **`vikunjaProxyUrl`** field on the Connect tab. When set, `VikunjaBackend` routes all requests through the proxy instead of hitting Vikunja directly. Takes precedence over the dev-mode Vite middleware too, so you can test your Worker end-to-end before shipping.
- **`vercel.json`** static-site config. `npm run build` → `dist/` ships as a Vercel web deployment for browser-based testing without packaging to `.ehpk`.
- **`VikunjaBackend`** — hand-rolled REST client against the `/api/v1/*` surface that Vikunja v2.x still exposes. Same `TodoBackend` interface as `TodoistBackend`: projects, views (inbox / today / upcoming / all / project), complete / uncomplete / create / delete, and subtasks. Priority scale (Vikunja 0–5) maps directly onto our normalized 1–5 + undefined. Zero-date sentinels (`0001-01-01T00:00:00Z`) are filtered out of the due-date field. Base URL is normalised (appends `/api/v1` if absent). Handles both v1's array-shaped `related_tasks` and v2's object-map shape with inlined child tasks (skipping N+1 fetches when possible).
- **Vite dev-mode CORS proxy for Vikunja** (`/vikunja-proxy`). Vikunja Cloud's CORS allowlist includes `localhost` / `127.0.0.1` but blocks LAN IPs used for phone-sideload testing. The proxy middleware forwards requests server-side so the WebView sees same-origin calls. Configurable via `VIKUNJA_PROXY_TARGET` for self-hosted instances. Documented in the README.
- **Voice quick-add** on glasses: `+ Speak a task` row at the top of Home when an STT API key is configured. Tapping pushes a Listening scene (title + body TextContainers). Soniox (default) or Deepgram via `even-toolkit/stt`. Transcript updates in the body via `textContainerUpgrade` on every interim token. Tap submits; swipe-up cancels; **2 s of silence auto-submits** (client-side timer, since `even-toolkit` filters out Soniox's `<end>` VAD token). On submit: `backend.createTask` → return Home with `added: <title>` toast.
- **Phone Voice tab** — real form: provider picker (Off / Soniox / Deepgram), API key input, language selector. Settings persist through the existing storage wrapper and fire `glassist:settings-changed` so the glasses Nav picks up changes without a reload.
- **Glasses nav now reads real backend data** (fake-data module removed). Home shows Inbox / Today / Upcoming / All counts; each tap drills into the live list. `(N+)` suffix when the backend has more pages than we fetched.
- **`▲ Back` synthetic row** on every pushed list / subtasks frame. The `ListContainer` primitive only emits `SCROLL_TOP_EVENT` at real scroll boundaries — lists that fit the container never fire one, so an explicit tap target is the only reliable way back.
- **Header-only toast feedback** on completion: tapping a task shows `done: <title>` (or `undo: <title>` on re-tap) in the header for ~2.5 seconds. The list container is not rebuilt, so the firmware's selection cursor stays put through bursts of completions.
- **`▶` indicator** for tasks known to be parents. Parent IDs are derived from the `all` fetch we already run for Home counts — no extra network calls.
- **Phone↔glasses sync** via `glassist:settings-changed` CustomEvent. Token, backend choice, STT keys all reflect on-glass without a restart.
- **`TodoBackend.getSubtasks(parentId)`** on the interface.
- **Empty lists** render with a `▲ Back` row + `(no tasks)` instead of a dead-end status screen.
- **Home header** shows `Glassist`.

### Changed

- **Home menu order**: Inbox → Today → Upcoming → All tasks (was Today-first). When voice is enabled, `+ Speak a task` sits above Inbox. Counts refresh whenever we pop back to Home.
- **Glasses rendering**: single `TextContainer` + per-gesture upgrades → `ListContainer` + optional `TextContainer` header. Firmware owns the selection border and internal scroll — no more paint flash on every swipe.
- **Deferred completion UX**: tap calls the backend but does not rebuild the list. Inline `×` glyph removed; feedback lives in the header toast. Rebuilds happen only on navigation, errors, and settings changes.
- **Vikunja project / inbox queries** now include `filter=done = false` so completed tasks drop out on the next re-entry (Vikunja's default is to return all tasks regardless of completion).
- **`TodoBackend.getTasks`** returns `{ tasks, hasMore }`. Todoist requests `limit: 200`; Vikunja requests `per_page: 50` (v2.x `max_items_per_page`).
- **Priority** widened to 1–5 + undefined, matching Vikunja's scale; Todoist occupies 1–4.
- **Priority glyphs** tuned on-glass: `★ ● ◆ ◇ ○` for 5 levels, blank slot for no-priority.
- **`▸` → `▶`** (U+25B8 is absent from the firmware LVGL font; U+25B6 is present).
- **`TodoistBackend`** uses the official `@doist/todoist-sdk` (v9.3.0).
- **`makeBackend`** is async — adapter modules load via dynamic `import()`. Vikunja and Todoist chunks are on-demand; initial load stays around 96 KB gz.
- **`@evenrealities/even_hub_sdk`** bumped 0.0.9 → 0.0.10. No API changes; the `readNumber` zero-as-missing quirk is still present (on-hardware probed).

### Fixed

- **Tapping the first item** on any `ListContainer` was a no-op. The SDK's `readNumber` treats 0 as a missing field, so `currentSelectItemIndex=0` arrived as `undefined`. `input.ts` now snaps undefined / null back to 0.
- **Subtasks no longer leak** into flat list views (Today / Upcoming / Inbox / All). Filtered to top-level tasks before both counts and list render.
- **Header toast truncation**. `renderMenuLine` stops padding headers with trailing spaces (proportional font could push them past container width); the header `TextContainer` is slightly taller (32 → 36 px) so the font doesn't get clipped.

### Removed

- Inline `×` on completed items (feedback moved to the header toast).
- Manual windowing / `itemsPerPage` plumbing in `Nav` — the `ListContainer` scrolls natively.
- `node-vikunja` dependency. Briefly used during the Vikunja slice, then dropped: the SDK targets Vikunja v1.x and breaks on v2.x (hits deprecated `/tasks/all`, over-large `per_page`, `+`-encoded filter spaces). Hand-rolled REST is ~240 lines and sidesteps all of these.
- `src/glasses/fake.ts` (no longer used).

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
