import { defineConfig } from 'vite'
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

export default defineConfig({
  plugins: [react(), tailwindcss(), devLog()],
  server: {
    host: true,
    port: 5173,
  },
})
