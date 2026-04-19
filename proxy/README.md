# Glassist Vikunja Proxy

Cloudflare Worker that forwards requests to a Vikunja instance and adds
CORS headers. Required because Vikunja Cloud's CORS allowlist only
admits `localhost`; any WebView or Vercel-hosted origin gets blocked.

Pure relay — the worker carries **no secrets of its own**. Each user's
token stays in the `Authorization: Bearer …` header that the caller
sends, forwarded upstream, never logged.

## Community deployment

If you trust `contextablemark` not to MITM your Vikunja token, you can
point Glassist at the community-hosted worker:

```
https://glassist-vikunja-proxy.contextablemark.workers.dev
```

Enter that URL in the Connect tab's **Vikunja CORS proxy URL** field.

If you'd rather not, deploy your own (under 2 minutes):

## Deploy your own

1. Install [wrangler](https://developers.cloudflare.com/workers/wrangler/)
   and sign in with `wrangler login`.
2. Optional: point at a non-Cloud Vikunja by editing `wrangler.toml`:
   ```toml
   [vars]
   UPSTREAM = "https://my-vikunja.example.com"
   ```
   Leave this unset to forward to `app.vikunja.cloud`.
3. Deploy:
   ```bash
   cd proxy
   npm install
   npm run deploy
   ```
4. Wrangler prints a URL like
   `https://glassist-vikunja-proxy.<your-subdomain>.workers.dev`.
   Paste it into the Connect tab.

## How it works

- `OPTIONS` → 204 with permissive CORS (preflight).
- Any other method → path + query forwarded to `${UPSTREAM}/…`.
- The `Authorization` header passes through untouched.
- Upstream `access-control-*` headers stripped; the worker adds its own
  that reflect the incoming `Origin`.
- `cf-*` and `host` / `origin` / `referer` headers are scrubbed before
  forwarding so Vikunja doesn't get confused.

## Security notes

- **No server-side token**: unlike some proxies, this worker has no
  pre-baked Vikunja key. Every request must carry its own `Authorization`
  header.
- **No logging**: the worker doesn't write to any storage or external
  sink. Cloudflare's edge logs (requests / response codes) apply per
  their standard policy.
- **Open forwarding**: the worker forwards anything to `UPSTREAM`. If
  you deploy your own, you're responsible for what UPSTREAM points at.
  Don't set it to arbitrary user input.

## Why not [deno-deploy / fly.io / …]

Worker free tier is generous (100k requests/day), cold-start-free, and
deploys in <30 seconds. Fine-grained routing isn't needed for a CORS
relay.
