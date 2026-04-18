import { useState } from 'react'
import { ConnectTab } from './tabs/ConnectTab'
import { GlassesTab } from './tabs/GlassesTab'
import { VoiceTab } from './tabs/VoiceTab'

type TabKey = 'connect' | 'glasses' | 'voice'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'connect', label: 'Connect' },
  { key: 'glasses', label: 'Glasses' },
  { key: 'voice', label: 'Voice' },
]

export function SettingsApp() {
  const [tab, setTab] = useState<TabKey>('connect')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-5 py-4 border-b border-neutral-800">
        <h1 className="text-xl font-semibold">Glassist</h1>
        <p className="text-sm text-neutral-400">Your todos, at a glance</p>
      </header>

      <nav className="flex border-b border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              'px-4 py-3 text-sm border-b-2 transition-colors ' +
              (tab === t.key
                ? 'border-emerald-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200')
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 p-5 max-w-2xl w-full">
        {tab === 'connect' && <ConnectTab />}
        {tab === 'glasses' && <GlassesTab />}
        {tab === 'voice' && <VoiceTab />}
      </main>
    </div>
  )
}
