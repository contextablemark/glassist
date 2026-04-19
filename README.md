# Glassist

Todoist and Vikunja tasks on Even Realities G2 smart glasses. Bring your own API token — no developer-operated server, no OAuth flow, no data leaving your device except to your chosen provider.

## Status

Active development. Read, complete, create-by-voice, and phone-side settings all work end-to-end against both backends.

## Stack

- Vite 6 + TypeScript (strict) + React 19 + Tailwind 4
- `@evenrealities/even_hub_sdk` directly
- `@evenrealities/evenhub-cli` for QR sideload + `.ehpk` packaging
- `@doist/todoist-sdk` (Todoist) + hand-rolled REST (Vikunja v2.x)
- `even-toolkit/stt` for on-glass voice quick-add (Soniox or Deepgram)
- Vitest + jsdom for tests

## Local development

```bash
npm install
npm run dev          # Vite on :5173
npm run typecheck
npm test
```

Open `http://localhost:5173` in a desktop browser for the phone settings UI. Sideload to G2 glasses:

```bash
npm run qr           # shows QR; scan with the Even App
```

## Vercel deployment

A static web build deploys to Vercel as-is. Push to GitHub, import the repo at vercel.com, and it'll pick up `vercel.json` (`buildCommand: npm run build`, `outputDirectory: dist`). The deployed site runs the phone UI; it'll only drive the glasses via the SDK bridge when opened from inside the Even Hub WebView.

## Getting your API token

- **Todoist**: Settings → Integrations → Developer → Copy API token.
- **Vikunja Cloud**: app.vikunja.cloud → Settings → API Tokens → create a `tk_…` token.
- **Vikunja self-hosted**: same flow on your instance; configure `cors.origins` to allow the deployed origin (or use a proxy — see below).

Paste the token into the Connect tab. It's stored only on-device (via the Even Hub bridge with `localStorage` fallback) and sent directly to the provider — never to any Glassist-operated server.

## Vikunja CORS: dev vs production

Vikunja Cloud's CORS allowlist includes `localhost` / `127.0.0.1` only, so any LAN IP (phone sideload), Even Hub WebView, or Vercel host will be blocked.

**Dev mode** — the Vite server runs a `/vikunja-proxy` middleware that forwards to Vikunja server-side. Works transparently; just run `npm run dev` and sideload.

```bash
# For a self-hosted Vikunja during dev, point the middleware at your instance:
VIKUNJA_PROXY_TARGET=https://vikunja.my-domain.com npm run dev
```

**Production** — the Vite middleware doesn't run in packaged builds. Options:

1. **Use the community Worker**: paste `https://glassist-vikunja-proxy.mark-83e.workers.dev` into the Connect tab's "CORS proxy URL" field. Pure relay, no server-side token, forwards to Vikunja Cloud.
2. **Deploy your own Worker** from [`proxy/`](./proxy/README.md) — sub-2-minute setup if you'd rather not trust the community instance, or if you're pointing at self-hosted Vikunja.
3. **Self-host Vikunja** with `cors.origins` configured to allow the Even Hub WebView / Vercel origin. Leave the proxy URL blank.
4. **Use Todoist** — its CORS allows `*`, so no proxy is ever needed.

## Voice quick-add (optional)

Set a Soniox or Deepgram API key in the Voice tab. A `+ Speak a task` row appears at the top of Home on-glass. Tap it → speak → tap to submit (or pause 2s for auto-submit) → the transcript is created as a task in your default project.

## Publishing

```bash
npm run pack        # Builds and produces glassist.ehpk
```

Upload `glassist.ehpk` to the Even Hub portal.

## License

MIT
