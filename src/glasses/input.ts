import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { OsEventTypeList } from '@evenrealities/even_hub_sdk'

export interface InputCallbacks {
  onTap: () => void
  onScrollUp: () => void
  onScrollDown: () => void
  onDoubleTap: () => void
  onForegroundEnter?: () => void
  onForegroundExit?: () => void
}

const SCROLL_COOLDOWN_MS = 300

// CLICK_EVENT=0 becomes undefined through the SDK's fromJson; treat
// null/undefined as CLICK_EVENT. All other unknown values are ignored.
function resolveEventType(
  eventType: number | undefined | null
): OsEventTypeList | null {
  if (eventType === undefined || eventType === null) {
    return OsEventTypeList.CLICK_EVENT
  }
  switch (eventType) {
    case OsEventTypeList.CLICK_EVENT:
    case OsEventTypeList.SCROLL_TOP_EVENT:
    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:
    case OsEventTypeList.FOREGROUND_EXIT_EVENT:
      return eventType
    default:
      return null
  }
}

export function setupInput(
  bridge: EvenAppBridge,
  callbacks: InputCallbacks
): () => void {
  let lastScrollTime = 0

  function handle(eventType: OsEventTypeList | null): void {
    if (eventType === null) return
    const now = Date.now()
    switch (eventType) {
      case OsEventTypeList.SCROLL_TOP_EVENT:
        if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return
        lastScrollTime = now
        callbacks.onScrollUp()
        break
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return
        lastScrollTime = now
        callbacks.onScrollDown()
        break
      case OsEventTypeList.CLICK_EVENT:
        callbacks.onTap()
        break
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        callbacks.onDoubleTap()
        break
      case OsEventTypeList.FOREGROUND_ENTER_EVENT:
        callbacks.onForegroundEnter?.()
        break
      case OsEventTypeList.FOREGROUND_EXIT_EVENT:
        callbacks.onForegroundExit?.()
        break
    }
  }

  return bridge.onEvenHubEvent((event) => {
    if (event.textEvent) handle(resolveEventType(event.textEvent.eventType))
    if (event.sysEvent) handle(resolveEventType(event.sysEvent.eventType))
    if (event.listEvent) handle(resolveEventType(event.listEvent.eventType))
  })
}
