/// <reference types="vite/client" />
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { OsEventTypeList } from '@evenrealities/even_hub_sdk'

function devLog(msg: string): void {
  if (import.meta.env.DEV) {
    fetch('/dev-log', {
      method: 'POST',
      body: JSON.stringify({ msg: `[input] ${msg}` }),
    }).catch(() => {})
  }
}

/**
 * Input event information delivered to Nav.
 *
 * For CLICK events from a ListContainer (isEventCapture=1), the firmware
 * reports `itemIndex` — which item the user tapped. For text/sys events,
 * itemIndex is undefined.
 */
export interface InputCallbacks {
  onTap(opts: { itemIndex?: number }): void
  /** SCROLL_TOP_EVENT — swipe up, fires at the top boundary of a list. */
  onScrollUp(opts: { itemIndex?: number }): void
  /** SCROLL_BOTTOM_EVENT — swipe down, fires at the bottom boundary. */
  onScrollDown(opts: { itemIndex?: number }): void
  onDoubleTap(): void
  onForegroundEnter?(): void
  onForegroundExit?(): void
}

const SCROLL_COOLDOWN_MS = 300

// CLICK_EVENT=0 becomes undefined through the SDK's fromJson; treat
// null/undefined as CLICK_EVENT. Unknown values are ignored.
function resolveEventType(
  eventType: number | undefined | null,
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
  callbacks: InputCallbacks,
): () => void {
  let lastScrollTime = 0

  function handle(
    eventType: OsEventTypeList | null,
    itemIndex: number | undefined,
  ): void {
    if (eventType === null) return
    const now = Date.now()
    switch (eventType) {
      case OsEventTypeList.SCROLL_TOP_EVENT:
        if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return
        lastScrollTime = now
        callbacks.onScrollUp({ itemIndex })
        break
      case OsEventTypeList.SCROLL_BOTTOM_EVENT:
        if (now - lastScrollTime < SCROLL_COOLDOWN_MS) return
        lastScrollTime = now
        callbacks.onScrollDown({ itemIndex })
        break
      case OsEventTypeList.CLICK_EVENT:
        callbacks.onTap({ itemIndex })
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
    // Tracing the raw payloads helps confirm (a) whether the SDK's
    // readNumber still drops 0 on currentSelectItemIndex, and (b) whether
    // SCROLL_TOP/BOTTOM fire when the list content fits the container.
    if (event.textEvent) {
      devLog(
        `textEvent eventType=${event.textEvent.eventType} container=${event.textEvent.containerName}`,
      )
      handle(resolveEventType(event.textEvent.eventType), undefined)
    }
    if (event.sysEvent) {
      devLog(
        `sysEvent eventType=${event.sysEvent.eventType} source=${event.sysEvent.eventSource}`,
      )
      handle(resolveEventType(event.sysEvent.eventType), undefined)
    }
    if (event.listEvent) {
      const raw = event.listEvent.currentSelectItemIndex
      devLog(
        `listEvent eventType=${event.listEvent.eventType} rawIdx=${raw} typeof=${typeof raw} name=${event.listEvent.currentSelectItemName}`,
      )
      // SDK 0.0.9 quirk: `readNumber` treats 0 as a missing field, so
      // currentSelectItemIndex=0 arrives as undefined. 0.0.10 may have
      // fixed this — the log above will tell us. Either way, snap to 0.
      const idx = raw === undefined || raw === null ? 0 : raw
      handle(resolveEventType(event.listEvent.eventType), idx)
    }
  })
}
