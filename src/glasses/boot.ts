/// <reference types="vite/client" />
import {
  CreateStartUpPageContainer,
  TextContainerProperty,
} from '@evenrealities/even_hub_sdk'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { setupInput } from './input'

function devLog(msg: string): void {
  if (import.meta.env.DEV) {
    fetch('/dev-log', {
      method: 'POST',
      body: JSON.stringify({ msg: `[glasses] ${msg}` }),
    }).catch(() => {})
  }
}

const HEADER_ID = 1
const BODY_ID = 2

async function createSplashPage(bridge: EvenAppBridge): Promise<void> {
  try {
    const result = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [
          new TextContainerProperty({
            xPosition: 0, yPosition: 0, width: 576, height: 40,
            borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 8,
            containerID: HEADER_ID, containerName: 'hdr',
            content: 'GLASSIST', isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 0, yPosition: 40, width: 576, height: 248,
            borderWidth: 0, borderColor: 0, borderRadius: 0, paddingLength: 8,
            containerID: BODY_ID, containerName: 'body',
            content: 'Open the Glassist settings on your phone\nto connect Todoist or Vikunja.\n\nDouble-tap to exit.',
            isEventCapture: 1,
          }),
        ],
      })
    )
    devLog(`createStartUpPageContainer result: ${result}`)
  } catch (err) {
    devLog(`createStartUpPageContainer ERROR: ${err}`)
  }
}

export async function startGlassesMode(bridge: EvenAppBridge): Promise<void> {
  devLog('creating splash page...')
  await createSplashPage(bridge)

  setupInput(bridge, {
    onTap: () => devLog('tap'),
    onScrollUp: () => devLog('scrollUp'),
    onScrollDown: () => devLog('scrollDown'),
    onDoubleTap: async () => {
      devLog('doubleTap -> shutDown(1)')
      await bridge.shutDownPageContainer(1)
    },
    onForegroundEnter: () => devLog('foreground enter'),
    onForegroundExit: () => devLog('foreground exit'),
  })
}
