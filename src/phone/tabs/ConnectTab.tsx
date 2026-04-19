import { useEffect, useState } from 'react'
import type { GlassistSettings, TodoProject } from '../../types'
import { DEFAULT_SETTINGS } from '../../types'
import { getSettings, saveSettings } from '../../lib/storage'
import { isDemoMode, makeBackend } from '../../backends'

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok' }
  | { kind: 'error'; message: string }

export function ConnectTab() {
  const [settings, setSettings] = useState<GlassistSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [test, setTest] = useState<TestState>({ kind: 'idle' })
  const [projects, setProjects] = useState<TodoProject[]>([])

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
  }, [])

  function update<K extends keyof GlassistSettings>(
    key: K,
    value: GlassistSettings[K],
  ): void {
    setSettings((prev) => {
      const next = { ...prev, [key]: value }
      void saveSettings(next)
      return next
    })
  }

  async function onTest(): Promise<void> {
    setTest({ kind: 'testing' })
    setProjects([])

    const backend = await makeBackend(settings)
    const result = await backend.testConnection()
    if (!result.ok) {
      setTest({ kind: 'error', message: result.error })
      return
    }

    setTest({ kind: 'ok' })

    try {
      const projectList = await backend.getProjects()
      setProjects(projectList)
      if (!settings.defaultProjectId) {
        const inbox = projectList.find((p) => p.name.toLowerCase() === 'inbox')
        if (inbox) update('defaultProjectId', inbox.id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setTest({ kind: 'error', message: `Loaded, but couldn't fetch projects: ${message}` })
    }
  }

  if (!loaded) return <p className="text-sm text-neutral-500">Loading…</p>

  const isVikunja = settings.backend === 'vikunja'
  const demoMode = isDemoMode(settings)

  return (
    <section className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Connect a backend</h2>
        {demoMode ? (
          <div className="rounded border border-amber-700/60 bg-amber-950/40 p-3 text-sm text-amber-200 space-y-1">
            <p className="font-medium">Demo mode</p>
            <p className="text-amber-300/80">
              Glassist is showing sample tasks so you can try the navigation,
              completions, and voice flow without signing in. Paste a Todoist
              or Vikunja API token below to connect your own data — the demo
              tasks disappear and nothing persists.
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-400">
            Glassist stores your token only on this device and sends it directly
            to your provider — never to a Glassist-operated server.
          </p>
        )}

        <Field label="Backend">
          <select
            value={settings.backend}
            onChange={(e) => update('backend', e.target.value as GlassistSettings['backend'])}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          >
            <option value="todoist">Todoist</option>
            <option value="vikunja">Vikunja</option>
          </select>
        </Field>

        <Field label="API token">
          <input
            type="password"
            value={settings.token}
            onChange={(e) => update('token', e.target.value)}
            placeholder={isVikunja ? 'tk_…' : 'paste your Todoist token'}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm font-mono"
          />
        </Field>

        {isVikunja && (
          <>
            <Field label="Base URL">
              <input
                type="url"
                value={settings.vikunjaBaseUrl}
                onChange={(e) => update('vikunjaBaseUrl', e.target.value)}
                placeholder="https://app.vikunja.cloud"
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm font-mono"
              />
            </Field>
            <Field label="CORS proxy URL">
              <input
                type="url"
                value={settings.vikunjaProxyUrl}
                onChange={(e) => update('vikunjaProxyUrl', e.target.value)}
                placeholder="Leave blank to hit Vikunja directly"
                className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-neutral-500 mt-1">
                Defaults to the community Cloudflare Worker so Vikunja Cloud
                works from any origin out of the box. Replace with your own
                relay (see <span className="font-mono">proxy/</span>), or
                clear the field if you're using self-hosted Vikunja with
                permissive <span className="font-mono">cors.origins</span>.
              </p>
            </Field>
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onTest}
            disabled={!settings.token || test.kind === 'testing'}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-medium transition-colors"
          >
            {test.kind === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
          <TestStatus state={test} />
        </div>

        {projects.length > 0 && (
          <Field label="Default project (for voice quick-add)">
            <select
              value={settings.defaultProjectId ?? ''}
              onChange={(e) => update('defaultProjectId', e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </section>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wide text-neutral-500">{props.label}</span>
      {props.children}
    </label>
  )
}

function TestStatus({ state }: { state: TestState }) {
  if (state.kind === 'ok') return <span className="text-sm text-emerald-400">✓ Connected</span>
  if (state.kind === 'error') return <span className="text-sm text-red-400">✗ {state.message}</span>
  return null
}
