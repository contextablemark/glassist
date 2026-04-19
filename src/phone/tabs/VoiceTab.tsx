import { useEffect, useState } from 'react'
import type { GlassistSettings, STTProviderName } from '../../types'
import { DEFAULT_SETTINGS } from '../../types'
import { getSettings, saveSettings } from '../../lib/storage'

const PROVIDER_OPTIONS: { value: STTProviderName; label: string; hint: string }[] = [
  { value: 'off', label: 'Off', hint: 'Hide voice quick-add on glasses' },
  { value: 'soniox', label: 'Soniox', hint: 'Streaming STT with endpoint detection' },
  { value: 'deepgram', label: 'Deepgram', hint: 'Streaming STT, alternative to Soniox' },
]

export function VoiceTab() {
  const [settings, setSettings] = useState<GlassistSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s)
      setLoaded(true)
    })
  }, [])

  function updateStt<K extends keyof GlassistSettings['stt']>(
    key: K,
    value: GlassistSettings['stt'][K],
  ): void {
    setSettings((prev) => {
      const next = { ...prev, stt: { ...prev.stt, [key]: value } }
      void saveSettings(next)
      return next
    })
  }

  if (!loaded) return <p className="text-sm text-neutral-500">Loading…</p>

  const enabled = settings.stt.provider !== 'off' && settings.stt.apiKey.length > 0

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-medium">Voice quick-add</h2>
        <p className="text-sm text-neutral-400">
          When enabled, a <span className="font-mono">+ Speak a task</span> row
          appears on the glasses Home menu. Tap it to dictate a task; tap again
          to submit.
        </p>
        <p className="text-sm text-neutral-400">
          Your API key is stored only on this device and sent directly to the
          provider's WebSocket — never to a Glassist-operated server.
        </p>
      </div>

      <Field label="Provider">
        <select
          value={settings.stt.provider}
          onChange={(e) => updateStt('provider', e.target.value as STTProviderName)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
        >
          {PROVIDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <p className="text-xs text-neutral-500 mt-1">
          {PROVIDER_OPTIONS.find((o) => o.value === settings.stt.provider)?.hint}
        </p>
      </Field>

      {settings.stt.provider !== 'off' && (
        <>
          <Field label="API key">
            <input
              type="password"
              value={settings.stt.apiKey}
              onChange={(e) => updateStt('apiKey', e.target.value)}
              placeholder={
                settings.stt.provider === 'soniox'
                  ? 'Soniox API key'
                  : 'Deepgram API key'
              }
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-neutral-500 mt-1">
              Get one at {providerKeyUrl(settings.stt.provider)}.
            </p>
          </Field>

          <Field label="Language">
            <select
              value={settings.stt.language}
              onChange={(e) => updateStt('language', e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="zh">Chinese</option>
            </select>
          </Field>
        </>
      )}

      <div className="border-t border-neutral-800 pt-4">
        <p className="text-sm">
          {enabled ? (
            <span className="text-emerald-400">✓ Voice quick-add is enabled. A <span className="font-mono">+ Speak a task</span> row will appear on Home.</span>
          ) : (
            <span className="text-neutral-500">Voice quick-add is disabled.</span>
          )}
        </p>
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

function providerKeyUrl(provider: STTProviderName): string {
  if (provider === 'soniox') return 'console.soniox.com'
  if (provider === 'deepgram') return 'console.deepgram.com'
  return ''
}
