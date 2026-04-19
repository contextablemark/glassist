import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type {
  STTProviderType,
  STTState,
  STTTranscript,
} from 'even-toolkit/stt'

export interface STTSessionCallbacks {
  /** Interim or accumulated text; called on every transcript update. */
  onTranscript(text: string): void
  /** State change, e.g. 'listening', 'error'. */
  onState?(state: STTState): void
  /** Fatal error during the session. */
  onError(message: string): void
}

export interface STTSessionOptions {
  bridge: EvenAppBridge
  provider: 'soniox' | 'deepgram'
  apiKey: string
  language: string
  /**
   * Silence timeout in ms: if no transcript tokens arrive for this long
   * after the user starts speaking, the session auto-submits. Soniox's
   * server-side VAD emits an `<end>` token that even-toolkit filters out
   * without surfacing it, so we detect silence ourselves.
   * Defaults to 2000 ms.
   */
  silenceMs?: number
}

const DEFAULT_SILENCE_MS = 2000

/**
 * Wraps even-toolkit's STTEngine for a one-shot dictation session. The
 * engine is loaded dynamically on start so the toolkit + provider code
 * stays out of the initial bundle.
 *
 * Usage:
 *   const session = new STTSession(opts, callbacks)
 *   await session.start()   // opens mic, begins streaming
 *   session.submit()        // finalize + return accumulated text
 *   session.cancel()        // abort, no callback fired
 */
export class STTSession {
  private accumulated: string[] = []
  private interim = ''
  private engine: unknown = null // STTEngine — loaded lazily
  private disposed = false
  private submittedCb: ((text: string) => void) | null = null
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private sawAnyTranscript = false

  constructor(
    private readonly options: STTSessionOptions,
    private readonly callbacks: STTSessionCallbacks,
  ) {}

  async start(onFinalSubmit: (text: string) => void): Promise<void> {
    this.submittedCb = onFinalSubmit
    // GlassBridgeSource auto-detects the bridge from window.__evenBridge.
    // Inject it here; safe to overwrite on every start since each session
    // is a one-shot.
    ;(window as unknown as { __evenBridge?: unknown }).__evenBridge = {
      rawBridge: this.options.bridge,
      onEvent: (cb: (event: unknown) => void) =>
        this.options.bridge.onEvenHubEvent(
          cb as Parameters<EvenAppBridge['onEvenHubEvent']>[0],
        ),
    }

    const { STTEngine } = await import('even-toolkit/stt')
    if (this.disposed) return
    const engine = new STTEngine({
      provider: this.options.provider as STTProviderType,
      source: 'glass-bridge',
      apiKey: this.options.apiKey,
      language: this.options.language,
      mode: 'streaming',
      continuous: true,
    })
    this.engine = engine

    engine.onTranscript((t: STTTranscript) => {
      // Soniox occasionally tacks trailing dots onto tokens; strip them
      // so they don't pile up in the displayed transcript.
      const text = t.text.replace(/\.+$/, '').trim()
      if (!text) return
      if (t.isFinal) {
        this.accumulated.push(text)
        this.interim = ''
      } else {
        this.interim = text
      }
      this.sawAnyTranscript = true
      this.armSilenceTimer()
      this.callbacks.onTranscript(this.currentText())
    })

    engine.onStateChange((s: STTState) => {
      this.callbacks.onState?.(s)
    })

    engine.onError((err: { message: string }) => {
      this.callbacks.onError(err.message)
    })

    try {
      await engine.start()
    } catch (err) {
      this.callbacks.onError(err instanceof Error ? err.message : String(err))
    }
  }

  /** Finalize the session and deliver the accumulated text (if any). */
  submit(): void {
    const text = this.currentText()
    this.teardown()
    if (text && this.submittedCb) this.submittedCb(text)
  }

  /** Abort the session without delivering text. */
  cancel(): void {
    this.teardown()
  }

  private currentText(): string {
    const parts = [...this.accumulated]
    if (this.interim) parts.push(this.interim)
    return parts.join(' ').trim()
  }

  private teardown(): void {
    if (this.disposed) return
    this.disposed = true
    this.clearSilenceTimer()
    const engine = this.engine as
      | { abort(): void; dispose(): void }
      | null
    try {
      engine?.abort()
    } catch { /* ignore */ }
    try {
      engine?.dispose()
    } catch { /* ignore */ }
    this.engine = null
  }

  /**
   * (Re)arm the silence timer. Called on every transcript token; if the
   * timer fires without another token arriving, we treat it as end of
   * utterance and submit.
   */
  private armSilenceTimer(): void {
    if (this.disposed) return
    this.clearSilenceTimer()
    const ms = this.options.silenceMs ?? DEFAULT_SILENCE_MS
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = null
      // Only auto-submit if we actually heard something — otherwise let
      // the user keep the session open.
      if (this.sawAnyTranscript && !this.disposed) this.submit()
    }, ms)
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
  }
}
