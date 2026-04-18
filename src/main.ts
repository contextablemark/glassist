/// <reference types="vite/client" />
import { initStorage } from './lib/storage'
import { mountSettings } from './phone/mount'

function devLog(msg: string): void {
  if (import.meta.env.DEV) {
    fetch('/dev-log', {
      method: 'POST',
      body: JSON.stringify({ msg }),
    }).catch(() => {})
  }
}

async function main(): Promise<void> {
  const hasFlutter =
    !!(window as any).flutter_inappwebview ||
    !!(window as any).webkit?.messageHandlers?.callHandler

  devLog(`hasFlutter: ${hasFlutter}`)

  if (hasFlutter) {
    try {
      devLog('waiting for EvenAppBridge...')
      const { waitForEvenAppBridge } = await import('@evenrealities/even_hub_sdk')
      const bridge = await waitForEvenAppBridge()
      devLog('bridge ready, entering glasses mode')

      initStorage(bridge)
      mountSettings()

      const { startGlassesMode } = await import('./glasses/boot')
      await startGlassesMode(bridge)
    } catch (err) {
      devLog(`glasses mode FAILED: ${err} — falling back to settings-only`)
      mountSettings()
    }
  } else {
    mountSettings()
  }
}

main()
