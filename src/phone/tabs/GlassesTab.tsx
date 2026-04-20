import { useEffect, useMemo, useState } from 'react'
import type { GlassistSettings, PinnedProject, TodoProject } from '../../types'
import { DEFAULT_SETTINGS } from '../../types'
import { getSettings, saveSettings } from '../../lib/storage'
import { makeBackend } from '../../backends'

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ok'; projects: TodoProject[] }
  | { kind: 'error'; message: string }

/** Soft cap on pinned rows — plus 4 built-in views + optional voice row
 *  leaves us well under the SDK's 20-item `ListContainer` ceiling. */
const MAX_PINS = 8

export function GlassesTab() {
  const [settings, setSettings] = useState<GlassistSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [projects, setProjects] = useState<LoadState>({ kind: 'idle' })

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!loaded || !settings.token) {
      setProjects({ kind: 'idle' })
      return
    }
    let cancelled = false
    setProjects({ kind: 'loading' })
    ;(async () => {
      try {
        const backend = await makeBackend(settings)
        const list = await backend.getProjects()
        // The built-in Inbox row already covers the user's inbox — both
        // Todoist and Vikunja expose it as a project named "Inbox", but
        // pinning it here would just duplicate the existing Home row.
        const pickable = list.filter((p) => p.name.trim().toLowerCase() !== 'inbox')
        if (!cancelled) setProjects({ kind: 'ok', projects: pickable })
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setProjects({ kind: 'error', message })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loaded, settings.backend, settings.token, settings.vikunjaBaseUrl, settings.vikunjaProxyUrl])

  const pinnedIds = useMemo(
    () => new Set(settings.pinnedHomeProjects.map((p) => p.id)),
    [settings.pinnedHomeProjects],
  )

  function togglePin(project: TodoProject): void {
    setSettings((prev) => {
      const already = prev.pinnedHomeProjects.find((p) => p.id === project.id)
      let nextPins: PinnedProject[]
      if (already) {
        nextPins = prev.pinnedHomeProjects.filter((p) => p.id !== project.id)
      } else {
        if (prev.pinnedHomeProjects.length >= MAX_PINS) return prev
        nextPins = [...prev.pinnedHomeProjects, { id: project.id, name: project.name }]
      }
      const next = { ...prev, pinnedHomeProjects: nextPins }
      void saveSettings(next)
      return next
    })
  }

  if (!loaded) return <p className="text-sm text-neutral-500">Loading…</p>

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Glasses display</h2>
        <p className="text-sm text-neutral-400">
          Pin projects from your backend to the on-glass Home menu. Pinned
          projects appear as additional rows after Inbox / Today / Upcoming /
          All tasks and show live counts.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-neutral-500">
            Pinned projects
          </span>
          <span className="text-xs text-neutral-500">
            {settings.pinnedHomeProjects.length} / {MAX_PINS}
          </span>
        </div>
        <ProjectList
          state={projects}
          pinnedIds={pinnedIds}
          atCap={settings.pinnedHomeProjects.length >= MAX_PINS}
          onToggle={togglePin}
        />
      </div>
    </section>
  )
}

function ProjectList(props: {
  state: LoadState
  pinnedIds: Set<string>
  atCap: boolean
  onToggle: (p: TodoProject) => void
}) {
  const { state, pinnedIds, atCap, onToggle } = props
  if (state.kind === 'idle') {
    return (
      <p className="text-sm text-neutral-500">
        Connect a backend on the Connect tab to pick projects. Demo mode has no
        projects to pin.
      </p>
    )
  }
  if (state.kind === 'loading') {
    return <p className="text-sm text-neutral-500">Loading projects…</p>
  }
  if (state.kind === 'error') {
    return <p className="text-sm text-red-400">✗ {state.message}</p>
  }
  if (state.projects.length === 0) {
    return <p className="text-sm text-neutral-500">No projects found.</p>
  }
  return (
    <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded">
      {state.projects.map((project) => {
        const checked = pinnedIds.has(project.id)
        const disabled = !checked && atCap
        return (
          <li key={project.id}>
            <label
              className={
                'flex items-center gap-3 px-3 py-2 text-sm ' +
                (disabled ? 'text-neutral-600 cursor-not-allowed' : 'cursor-pointer hover:bg-neutral-900')
              }
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(project)}
                className="accent-emerald-500"
              />
              <span className="flex-1 truncate">{project.name}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}
