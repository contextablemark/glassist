/// <reference types="vite/client" />
import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { makeBackend, type TodoBackend } from '../backends'
import { getSettings, SETTINGS_CHANGED_EVENT } from '../lib/storage'
import type { GlassistSettings } from '../types'
import { Nav, type Scene } from './nav'
import { setupInput } from './input'

function devLog(msg: string): void {
  if (import.meta.env.DEV) {
    fetch('/dev-log', {
      method: 'POST',
      body: JSON.stringify({ msg: `[glasses] ${msg}` }),
    }).catch(() => {})
  }
}

// Container IDs. Stable across renders.
const HEADER_ID = 1
const LIST_ID = 2
const STATUS_ID = 3

const DISPLAY_W = 576
const DISPLAY_H = 288
// Header TextContainer height. 32 pixels was just enough for the firmware
// font vertically, which left toasts looking clipped; 36 gives ~4 px of
// breathing room top+bottom without eating into the list area noticeably.
const HEADER_H = 36
// Approximate firmware row height for list items. Empirically tuned so
// short lists don't look stretched (firmware stretches items to fill the
// container if we make it bigger than needed).
const ITEM_H = 40

type Layout =
  | { kind: 'status' }
  | { kind: 'list'; withHeader: boolean }
  | { kind: 'listening' }

const LISTENING_TITLE_ID = 4
const LISTENING_BODY_ID = 5

function sameItems(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

async function buildBackend(settings: GlassistSettings): Promise<TodoBackend | null> {
  try {
    return await makeBackend(settings)
  } catch (err) {
    devLog(`makeBackend ERROR: ${err}`)
    return null
  }
}

function containersForScene(scene: Scene): {
  containerTotalNum: number
  textObject: TextContainerProperty[]
  listObject: ListContainerProperty[]
  layout: Layout
} {
  if (scene.kind === 'status') {
    return {
      containerTotalNum: 1,
      layout: { kind: 'status' },
      textObject: [
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_W,
          height: DISPLAY_H,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: 4,
          containerID: STATUS_ID,
          containerName: 'status',
          content: scene.text,
          isEventCapture: 1,
        }),
      ],
      listObject: [],
    }
  }

  if (scene.kind === 'listening') {
    return {
      containerTotalNum: 2,
      layout: { kind: 'listening' },
      textObject: [
        new TextContainerProperty({
          xPosition: 0,
          yPosition: 0,
          width: DISPLAY_W,
          height: HEADER_H,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: 4,
          containerID: LISTENING_TITLE_ID,
          containerName: 'lstTitle',
          content: scene.title,
          isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0,
          yPosition: HEADER_H,
          width: DISPLAY_W,
          height: DISPLAY_H - HEADER_H,
          borderWidth: 0,
          borderColor: 0,
          borderRadius: 0,
          paddingLength: 6,
          containerID: LISTENING_BODY_ID,
          containerName: 'lstBody',
          content: scene.body,
          isEventCapture: 1,
        }),
      ],
      listObject: [],
    }
  }

  const headerHeight = scene.header ? HEADER_H : 0
  const text: TextContainerProperty[] = []
  if (scene.header) {
    text.push(
      new TextContainerProperty({
        xPosition: 0,
        yPosition: 0,
        width: DISPLAY_W,
        height: headerHeight,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        paddingLength: 4,
        containerID: HEADER_ID,
        containerName: 'hdr',
        content: scene.header,
        isEventCapture: 0,
      }),
    )
  }

  const maxListHeight = DISPLAY_H - headerHeight
  const listHeight = Math.min(scene.items.length * ITEM_H, maxListHeight)

  const list = new ListContainerProperty({
    xPosition: 0,
    yPosition: headerHeight,
    width: DISPLAY_W,
    height: listHeight,
    borderWidth: 0,
    borderColor: 0,
    borderRadius: 0,
    paddingLength: 4,
    containerID: LIST_ID,
    containerName: 'list',
    itemContainer: new ListItemContainerProperty({
      itemCount: scene.items.length,
      itemWidth: DISPLAY_W,
      isItemSelectBorderEn: 1,
      itemName: scene.items,
    }),
    isEventCapture: 1,
  })

  return {
    containerTotalNum: text.length + 1,
    layout: { kind: 'list', withHeader: !!scene.header },
    textObject: text,
    listObject: [list],
  }
}

export async function startGlassesMode(bridge: EvenAppBridge): Promise<void> {
  const settings = await getSettings()
  devLog(`settings loaded, backend=${settings.backend}, hasToken=${!!settings.token}`)

  const backend = await buildBackend(settings)

  // Track the last painted scene so we can decide between
  // `textContainerUpgrade` (cheap) and `rebuildPageContainer` (flickery)
  // when repainting.
  let lastScene: Scene | null = null
  let lastLayout: Layout | null = null

  async function paint(scene: Scene): Promise<void> {
    const { containerTotalNum, textObject, listObject, layout } =
      containersForScene(scene)

    // Fast path 1: status → status, only text changed.
    if (
      lastScene?.kind === 'status' &&
      scene.kind === 'status' &&
      lastLayout?.kind === 'status'
    ) {
      try {
        await bridge.textContainerUpgrade(
          new TextContainerUpgrade({
            containerID: STATUS_ID,
            containerName: 'status',
            contentOffset: 0,
            contentLength: 2000,
            content: scene.text,
          }),
        )
      } catch (err) {
        devLog(`textContainerUpgrade ERROR: ${err}`)
      }
      lastScene = scene
      return
    }

    // Fast path 2a: listening → listening. Transcript body changes on every
    // interim token; title only changes when a toast fires. Both updates
    // are cheap textContainerUpgrade calls.
    if (
      lastScene?.kind === 'listening' &&
      scene.kind === 'listening' &&
      lastLayout?.kind === 'listening'
    ) {
      try {
        if (scene.body !== lastScene.body) {
          await bridge.textContainerUpgrade(
            new TextContainerUpgrade({
              containerID: LISTENING_BODY_ID,
              containerName: 'lstBody',
              contentOffset: 0,
              contentLength: 2000,
              content: scene.body,
            }),
          )
        }
        if (scene.title !== lastScene.title) {
          await bridge.textContainerUpgrade(
            new TextContainerUpgrade({
              containerID: LISTENING_TITLE_ID,
              containerName: 'lstTitle',
              contentOffset: 0,
              contentLength: 2000,
              content: scene.title,
            }),
          )
        }
      } catch (err) {
        devLog(`textContainerUpgrade(listening) ERROR: ${err}`)
      }
      lastScene = scene
      return
    }

    // Fast path 2: list → list with identical items. Only the header can
    // have changed (toast in/out, title swap) — textContainerUpgrade the
    // header so the firmware's list selection doesn't reset.
    if (
      lastScene?.kind === 'list' &&
      scene.kind === 'list' &&
      lastLayout?.kind === 'list' &&
      lastLayout.withHeader &&
      layout.kind === 'list' &&
      layout.withHeader &&
      sameItems(lastScene.items, scene.items)
    ) {
      if (lastScene.header !== scene.header) {
        try {
          await bridge.textContainerUpgrade(
            new TextContainerUpgrade({
              containerID: HEADER_ID,
              containerName: 'hdr',
              contentOffset: 0,
              contentLength: 2000,
              content: scene.header ?? '',
            }),
          )
        } catch (err) {
          devLog(`textContainerUpgrade(header) ERROR: ${err}`)
        }
      }
      lastScene = scene
      return
    }

    if (lastScene === null) {
      try {
        const result = await bridge.createStartUpPageContainer(
          new CreateStartUpPageContainer({
            containerTotalNum,
            textObject,
            listObject,
          }),
        )
        devLog(`createStartUpPageContainer result: ${result}`)
      } catch (err) {
        devLog(`createStartUpPageContainer ERROR: ${err}`)
      }
    } else {
      try {
        await bridge.rebuildPageContainer(
          new RebuildPageContainer({
            containerTotalNum,
            textObject,
            listObject,
          }),
        )
      } catch (err) {
        devLog(`rebuildPageContainer ERROR: ${err}`)
      }
    }
    lastScene = scene
    lastLayout = layout
  }

  const nav = new Nav({
    backend,
    settings,
    bridge,
    onChange: () => {
      void paint(nav.render())
    },
    log: (msg) => devLog(`[nav] ${msg}`),
  })

  await paint(nav.render())

  setupInput(bridge, {
    onTap: ({ itemIndex }) => {
      devLog(`tap index=${itemIndex}`)
      nav.onTap(itemIndex)
    },
    onScrollUp: () => {
      devLog('scrollUp (top boundary)')
      nav.onScrollUp()
    },
    onScrollDown: () => {
      devLog('scrollDown (bottom boundary)')
      nav.onScrollDown()
    },
    onDoubleTap: async () => {
      devLog('doubleTap -> shutDown(1)')
      await bridge.shutDownPageContainer(1)
    },
    onForegroundEnter: () => devLog('foreground enter'),
    onForegroundExit: () => devLog('foreground exit'),
  })

  let lastAppliedSettings = settings
  window.addEventListener(SETTINGS_CHANGED_EVENT, async () => {
    devLog('settings changed — re-reading')
    const updated = await getSettings()
    const backendChanged =
      updated.backend !== lastAppliedSettings.backend ||
      updated.token !== lastAppliedSettings.token ||
      updated.vikunjaBaseUrl !== lastAppliedSettings.vikunjaBaseUrl
    nav.setSettings(updated)
    if (backendChanged) {
      const nextBackend = await buildBackend(updated)
      nav.setBackend(nextBackend)
    }
    lastAppliedSettings = updated
  })
}
