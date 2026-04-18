/// <reference types="vite/client" />
import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { Nav } from './nav'
import { setupInput } from './input'

function devLog(msg: string): void {
  if (import.meta.env.DEV) {
    fetch('/dev-log', {
      method: 'POST',
      body: JSON.stringify({ msg: `[glasses] ${msg}` }),
    }).catch(() => {})
  }
}

const MAIN_ID = 1
const MAIN_NAME = 'main'

async function createMainPage(bridge: EvenAppBridge, content: string): Promise<void> {
  try {
    const result = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 1,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: 576, height: 288,
            borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 4,
            containerID: MAIN_ID, containerName: MAIN_NAME,
            content, isEventCapture: 1,
          }),
        ],
      })
    )
    devLog(`createStartUpPageContainer result: ${result}`)
  } catch (err) {
    devLog(`createStartUpPageContainer ERROR: ${err}`)
  }
}

async function updateMain(bridge: EvenAppBridge, content: string): Promise<void> {
  try {
    await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: MAIN_ID, containerName: MAIN_NAME,
        contentOffset: 0, contentLength: 2000, content,
      })
    )
  } catch (err) {
    devLog(`textContainerUpgrade ERROR: ${err}`)
  }
}

export async function startGlassesMode(bridge: EvenAppBridge): Promise<void> {
  const nav = new Nav()

  devLog('creating main page...')
  await createMainPage(bridge, nav.render())

  const rerender = () => updateMain(bridge, nav.render())

  setupInput(bridge, {
    onTap: () => {
      const out = nav.tap()
      devLog(`tap -> ${out.kind}`)
      rerender()
    },
    onScrollUp: () => {
      nav.scrollUp()
      rerender()
    },
    onScrollDown: () => {
      nav.scrollDown()
      rerender()
    },
    onDoubleTap: async () => {
      devLog('doubleTap -> shutDown(1)')
      await bridge.shutDownPageContainer(1)
    },
    onForegroundEnter: () => devLog('foreground enter'),
    onForegroundExit: () => devLog('foreground exit'),
  })
}
