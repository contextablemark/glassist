# Glassist

Todoist and Vikunja tasks on Even Realities G2 smart glasses. Bring your own API token — no backend, no OAuth, no developer-operated server.

## Status

v0.1.0 — scaffolding. Boot splash + dual-mode bootstrap + phone settings shell. Backend adapters, STT, and real task rendering not yet implemented.

## Stack

- Vite 6 + TypeScript (strict) + React 19 + Tailwind 4
- `@evenrealities/even_hub_sdk` directly
- `@evenrealities/evenhub-cli` for QR sideload + `.ehpk` packaging
- Vitest + jsdom for tests

## Local development

```bash
npm install
npm run dev       # Vite on :5175
npm run typecheck
npm test
```

Open `http://localhost:5175` in a browser for the phone settings UI. Sideload to G2 glasses via:

```bash
npm run qr        # shows QR; scan with the Even App
```

## Getting your API token

**Todoist** — Settings → Integrations → Developer → Copy API token
**Vikunja Cloud** — app.vikunja.cloud → Settings → API Tokens → create a `tk_...` token
**Vikunja self-hosted** — same flow on your instance; make sure CORS is configured to allow the Even Hub WebView origin

Paste the token into the Connect tab of the phone settings UI. It is stored only on-device (via the SDK bridge or localStorage fallback) and never transmitted anywhere except directly to Todoist/Vikunja.

## Voice quick-add (optional)

If you add a Soniox or Deepgram API key in the Voice tab, long-pressing on the glasses opens a listening screen and creates a task in your backend's default project from your speech. Without a key, voice is hidden and tasks are created via the phone keyboard only.

## Publishing

```bash
npm run pack      # Builds and produces glassist.ehpk
```

Upload `glassist.ehpk` to Even Hub per the portal instructions.

## License

MIT
