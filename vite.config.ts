import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/**
 * Client-side log relay for dev mode.
 * Client POSTs to /dev-log; server prints to terminal. Useful for debugging
 * glasses-mode code that otherwise has no visible console.
 */
function devLog(): Plugin {
  return {
    name: 'dev-log',
    configureServer(server) {
      server.middlewares.use('/dev-log', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const body = Buffer.concat(chunks).toString()
        try {
          const { msg } = JSON.parse(body)
          console.log(`[client] ${msg}`)
        } catch {
          console.log(`[client] ${body}`)
        }
        res.writeHead(200)
        res.end()
      })
    },
  }
}

/**
 * Dev-mode CORS-bypass proxy for Vikunja.
 *
 * Vikunja Cloud's CORS allowlist includes localhost and 127.0.0.1 but NOT
 * LAN IPs. When a developer sideloads Glassist to a phone via QR, the
 * WebView origin becomes the host machine's LAN IP (e.g. http://192.168.
 * 1.x:5173), which Vikunja Cloud refuses → "Failed to fetch".
 *
 * The browser treats calls to our own /vikunja-proxy path as same-origin,
 * so no CORS headers are required. The dev server forwards the request
 * server-side to the real Vikunja instance.
 *
 * Self-hosted users can point this at their instance by setting
 * `VIKUNJA_PROXY_TARGET` in `.env` before `npm run dev`.
 *
 * In production, the .ehpk app needs its own proxy (e.g. a Cloudflare
 * Worker) or a self-hosted Vikunja with permissive `cors.origins` —
 * this dev middleware does not run there.
 */
function vikunjaProxy(): Plugin {
  let target = 'https://app.vikunja.cloud'
  return {
    name: 'vikunja-proxy',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '')
      if (env.VIKUNJA_PROXY_TARGET) target = env.VIKUNJA_PROXY_TARGET
      console.log(`[vikunja-proxy] forwarding to ${target}`)
    },
    configureServer(server) {
      server.middlewares.use('/vikunja-proxy', async (req, res) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          })
          res.end()
          return
        }
        const upstream = target.replace(/\/$/, '') + (req.url || '')
        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(req.headers)) {
          const low = k.toLowerCase()
          if (low === 'host' || low === 'origin' || low === 'referer') continue
          if (typeof v === 'string') headers[k] = v
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(Buffer.from(chunk))
        const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined

        try {
          const resp = await fetch(upstream, {
            method: req.method,
            headers,
            body,
          })
          const buffer = await resp.arrayBuffer()
          const respHeaders: Record<string, string> = {}
          resp.headers.forEach((value, key) => {
            // Drop content-encoding; fetch has already decoded.
            if (key.toLowerCase() === 'content-encoding') return
            respHeaders[key] = value
          })
          // Always allow the WebView origin to read the response.
          respHeaders['access-control-allow-origin'] = '*'
          if (resp.status >= 400) {
            const text = new TextDecoder('utf-8').decode(buffer)
            console.log(
              `[vikunja-proxy] ${req.method} ${req.url} → ${resp.status} (${buffer.byteLength}B) body=${text}`,
            )
          } else {
            console.log(
              `[vikunja-proxy] ${req.method} ${req.url} → ${resp.status} (${buffer.byteLength}B)`,
            )
          }
          res.writeHead(resp.status, respHeaders)
          res.end(Buffer.from(buffer))
        } catch (err) {
          console.error('[vikunja-proxy] upstream error:', err)
          res.writeHead(502, {
            'Content-Type': 'application/json',
            'access-control-allow-origin': '*',
          })
          res.end(
            JSON.stringify({
              message: err instanceof Error ? err.message : String(err),
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devLog(), vikunjaProxy()],
  server: {
    host: true,
    port: 5173,
  },
})
