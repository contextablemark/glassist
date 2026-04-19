import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { GlassistSettings, TodoTask } from '../types'
import type { TaskView, TodoBackend } from '../backends'
import { renderHomeItems, type HomeMenuItem } from './render/home'
import { renderHeader, renderListItems } from './render/list'
import { renderStatusText } from './render/status'
import { STTSession } from './stt'

type HomeId = Extract<TaskView, 'today' | 'upcoming' | 'inbox' | 'all'>

const HOME_MENU: { id: HomeId; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'all', label: 'All tasks' },
]

/** Displayed as the voice quick-add row on Home when STT is enabled. */
const SPEAK_ROW_LABEL = '+ Speak a task'

// SDK limit is 20 items per ListContainer; we truncate lists that exceed
// this cap in v1. Longer lists surface as "+" on the home count.
const MAX_LIST_ITEMS = 20

// Milliseconds the "done: X" / "undo: X" header toast remains visible
// after a tap before reverting to the normal title.
const TOAST_MS = 2500

// Synthetic "back" row prepended to every pushed list/subtasks frame.
// ListContainer doesn't emit SCROLL_TOP_EVENT when content fits (no
// scrollable range), and the title TextContainer can't capture events
// (only one container per page may), so this synthetic item is the
// reliable way to pop a level via tap.
const BACK_ITEM_LABEL = '\u25b2 Back'

interface HomeFrame {
  kind: 'home'
  counts: Partial<Record<HomeId, number>>
  hasMore: Partial<Record<HomeId, boolean>>
}

interface ListFrame {
  kind: 'list'
  view: HomeId
  title: string
  tasks: TodoTask[] | null
  completedInSession: Set<string>
}

interface SubtasksFrame {
  kind: 'subtasks'
  parentId: string
  title: string
  tasks: TodoTask[] | null
  completedInSession: Set<string>
}

interface ListeningFrame {
  kind: 'listening'
  body: string
  /** Target project for the created task; stamped at entry time. */
  projectId?: string
}

type Frame = HomeFrame | ListFrame | SubtasksFrame | ListeningFrame

/**
 * Scene: the visual state Nav wants painted. boot.ts converts this to
 * SDK container primitives.
 *
 * - `status`    → a single TextContainer covering the screen
 * - `list`      → optional TextContainer header + ListContainer
 * - `listening` → title TextContainer + body TextContainer (voice dictation)
 */
export type Scene =
  | { kind: 'status'; text: string; dismissible: boolean }
  | { kind: 'list'; header: string | null; items: string[] }
  | { kind: 'listening'; title: string; body: string }

export interface NavOptions {
  backend: TodoBackend | null
  settings: GlassistSettings
  /** Required for voice quick-add; `null` in phone-only mode. */
  bridge?: EvenAppBridge | null
  onChange?: () => void
  /** Optional tracer; boot.ts wires this to the dev-server `/dev-log` POST. */
  log?: (msg: string) => void
}

export class Nav {
  private backend: TodoBackend | null
  private settings: GlassistSettings
  private bridge: EvenAppBridge | null
  private onChange?: () => void
  private log: (msg: string) => void
  private stack: Frame[]
  private error: { message: string } | null = null
  private knownParentIds: Set<string> = new Set()
  // Transient header message shown for TOAST_MS after a completion tap.
  // Lives on the Nav instance rather than the frame because a toast is
  // always scoped to the current frame (cleared on navigation).
  private toast: string | null = null
  private toastTimer: ReturnType<typeof setTimeout> | null = null
  // Live STT session when a ListeningFrame is on top of the stack.
  private sttSession: STTSession | null = null

  constructor(options: NavOptions) {
    this.backend = options.backend
    this.settings = options.settings
    this.bridge = options.bridge ?? null
    this.onChange = options.onChange
    this.log = options.log ?? (() => {})
    this.stack = [blankHome()]
    if (this.backend) void this.loadHomeCounts()
  }

  setBackend(backend: TodoBackend | null): void {
    this.backend = backend
    this.stack = [blankHome()]
    this.error = null
    this.knownParentIds = new Set()
    this.clearToast()
    this.cancelSttSession()
    if (this.backend) void this.loadHomeCounts()
    this.change()
  }

  /**
   * Update settings without resetting navigation. Used when the user
   * changes voice settings on the phone — the Home menu may gain/lose
   * the "+ Speak a task" row, but the current list position shouldn't
   * be disturbed.
   */
  setSettings(settings: GlassistSettings): void {
    this.settings = settings
    this.change()
  }

  // ── rendering ──────────────────────────────────────────────────────────

  render(): Scene {
    if (!this.backend) {
      return {
        kind: 'status',
        text: renderStatusText(
          'GLASSIST',
          'Open Glassist on your phone to connect a backend.',
        ),
        dismissible: false,
      }
    }
    if (this.error) {
      return {
        kind: 'status',
        text: renderStatusText('ERROR', `${this.error.message}\nTap to retry.`),
        dismissible: true,
      }
    }
    const f = this.top
    if (f.kind === 'home') {
      const menuItems = renderHomeItems(this.homeMenuItems(f))
      const items = this.isVoiceAvailable()
        ? [SPEAK_ROW_LABEL, ...menuItems]
        : menuItems
      return {
        kind: 'list',
        header: renderHeader(this.toast ?? 'Glassist'),
        items,
      }
    }
    if (f.kind === 'listening') {
      return {
        kind: 'listening',
        title: this.toast ?? 'Listening',
        body: f.body,
      }
    }
    if (f.tasks === null) {
      return {
        kind: 'status',
        text: renderStatusText(f.title, 'Loading…'),
        dismissible: false,
      }
    }
    const headerText = renderHeader(this.toast ?? f.title)
    if (f.tasks.length === 0) {
      // Empty list still needs a back affordance — a single-item list with
      // just the back row is the most consistent choice.
      return {
        kind: 'list',
        header: headerText,
        items: [BACK_ITEM_LABEL, '  (no tasks)'],
      }
    }
    const tasks = f.tasks.slice(0, MAX_LIST_ITEMS - 1)
    return {
      kind: 'list',
      header: headerText,
      items: [
        BACK_ITEM_LABEL,
        ...renderListItems({ tasks, knownParentIds: this.knownParentIds }),
      ],
    }
  }

  private homeMenuItems(frame: HomeFrame): HomeMenuItem[] {
    return HOME_MENU.map(({ id, label }) => ({
      id,
      label,
      count: frame.counts[id] ?? null,
      hasMore: frame.hasMore[id] ?? false,
    }))
  }

  private isVoiceAvailable(): boolean {
    return (
      !!this.bridge &&
      this.settings.stt.provider !== 'off' &&
      this.settings.stt.apiKey.trim().length > 0
    )
  }

  // ── input handling ─────────────────────────────────────────────────────

  /**
   * Called when the user taps. For list scenes, `itemIndex` is the
   * ListContainer item the firmware reports as currently selected.
   * For status scenes, itemIndex is ignored and the tap dismisses.
   */
  onTap(itemIndex?: number): void {
    if (!this.backend) return
    if (this.error) {
      this.error = null
      // Retry the last thing. If we're still at home, reload counts;
      // otherwise reload the current list/subtasks frame.
      const f = this.top
      if (f.kind === 'home') void this.loadHomeCounts()
      else if (f.kind === 'list') void this.loadList()
      else void this.loadSubtasks()
      this.change()
      return
    }
    const f = this.top
    if (f.kind === 'home') {
      if (itemIndex === undefined) return
      const voiceOn = this.isVoiceAvailable()
      // Speak-a-task row is the first item when voice is on; the four
      // view entries shift down by one.
      if (voiceOn && itemIndex === 0) {
        void this.startListening()
        return
      }
      const menuIndex = voiceOn ? itemIndex - 1 : itemIndex
      const entry = HOME_MENU[menuIndex]
      if (!entry) return
      this.stack.push({
        kind: 'list',
        view: entry.id,
        title: entry.label,
        tasks: null,
        completedInSession: new Set(),
      })
      this.change()
      void this.loadList()
      return
    }
    if (f.kind === 'listening') {
      // Tap → submit whatever we have so far (bypass VAD).
      this.sttSession?.submit()
      return
    }
    // In list/subtasks scenes, index 0 is the synthetic "▲ Back" item;
    // task indices shift by 1.
    if (itemIndex === 0) {
      this.clearToast()
      this.popFrame()
      return
    }
    if (f.tasks === null) return
    if (itemIndex === undefined) return
    const taskIndex = itemIndex - 1
    if (taskIndex < 0 || taskIndex >= f.tasks.length) return
    const task = f.tasks[taskIndex]
    if (f.completedInSession.has(task.id)) {
      f.completedInSession.delete(task.id)
      this.showToast(`undo: ${task.title}`)
      this.backend.uncompleteTask(task.id).catch((err) => this.setError(err))
      return
    }
    if (f.kind === 'list') {
      void this.tapListTask(task, f)
      return
    }
    // Subtasks frame: tap always completes (no nested subtasks in v1).
    f.completedInSession.add(task.id)
    this.showToast(`done: ${task.title}`)
    this.backend.completeTask(task.id).catch((err) => this.setError(err))
  }

  /** SCROLL_TOP_EVENT: swipe up past the first item — pop the level. */
  onScrollUp(): void {
    if (!this.backend || this.error) return
    // During dictation, swipe-up cancels and returns to Home.
    if (this.top.kind === 'listening') {
      this.cancelSttSession()
      this.popFrame()
      return
    }
    if (this.stack.length > 1) {
      this.clearToast()
      this.popFrame()
    }
  }

  /**
   * Pop the top frame and re-render. When the pop leaves Home at the top,
   * refresh counts so the menu reflects any completions / additions made
   * in the level we just left.
   */
  private popFrame(): void {
    if (this.stack.length <= 1) return
    this.stack.pop()
    if (this.top.kind === 'home' && this.backend) {
      void this.loadHomeCounts()
    }
    this.change()
  }

  /** SCROLL_BOTTOM_EVENT: swipe down past the last item — no-op in v1. */
  onScrollDown(): void {
    // Reserved for pull-to-refresh in a later slice.
  }

  // ── data loading ───────────────────────────────────────────────────────

  private async loadHomeCounts(): Promise<void> {
    const backend = this.backend
    if (!backend) return
    const home = this.stack[0]
    if (home.kind !== 'home') return
    this.log(`loadHomeCounts start (backend=${backend.name})`)
    const views: HomeId[] = ['today', 'upcoming', 'inbox', 'all']
    await Promise.all(
      views.map(async (view) => {
        try {
          const page = await backend.getTasks(view)
          if (this.stack[0] !== home) return
          if (view === 'all') {
            const parentIds = new Set<string>()
            for (const t of page.tasks) {
              if (t.parentId) parentIds.add(t.parentId)
            }
            this.knownParentIds = parentIds
          }
          const topLevel = page.tasks.filter((t) => !t.parentId)
          home.counts = { ...home.counts, [view]: topLevel.length }
          home.hasMore = { ...home.hasMore, [view]: page.hasMore }
          this.log(`loadHomeCounts ${view}=${topLevel.length}${page.hasMore ? '+' : ''}`)
          this.change()
        } catch (err) {
          this.log(`loadHomeCounts ${view} ERROR: ${describeError(err)}`)
          this.setError(err)
        }
      }),
    )
  }

  private async loadList(): Promise<void> {
    const backend = this.backend
    if (!backend) return
    const frame = this.top
    if (frame.kind !== 'list') return
    try {
      const { tasks } = await backend.getTasks(frame.view)
      if (this.top !== frame) return
      frame.tasks = tasks.filter((t) => !t.parentId)
      this.change()
    } catch (err) {
      this.setError(err)
    }
  }

  private async loadSubtasks(): Promise<void> {
    const backend = this.backend
    if (!backend) return
    const frame = this.top
    if (frame.kind !== 'subtasks') return
    try {
      const tasks = await backend.getSubtasks(frame.parentId)
      if (this.top !== frame) return
      frame.tasks = tasks
      this.change()
    } catch (err) {
      this.setError(err)
    }
  }

  // ── voice quick-add ────────────────────────────────────────────────────

  private async startListening(): Promise<void> {
    if (!this.isVoiceAvailable() || !this.bridge) return
    const provider = this.settings.stt.provider
    if (provider === 'off') return
    this.clearToast()
    const frame: ListeningFrame = {
      kind: 'listening',
      body: '',
      projectId: this.settings.defaultProjectId,
    }
    this.stack.push(frame)
    this.change()

    this.sttSession = new STTSession(
      {
        bridge: this.bridge,
        provider,
        apiKey: this.settings.stt.apiKey,
        language: this.settings.stt.language,
      },
      {
        onTranscript: (text) => {
          if (this.top !== frame) return
          frame.body = text
          this.change()
        },
        onError: (message) => {
          this.cancelSttSession()
          if (this.top === frame) this.stack.pop()
          this.setError(new Error(message))
        },
      },
    )

    try {
      await this.sttSession.start((finalText) => {
        void this.commitSpokenTask(finalText, frame)
      })
    } catch (err) {
      this.cancelSttSession()
      if (this.top === frame) this.stack.pop()
      this.setError(err)
    }
  }

  private async commitSpokenTask(
    text: string,
    frame: ListeningFrame,
  ): Promise<void> {
    this.sttSession = null
    if (this.top === frame) this.stack.pop()
    this.change()
    if (!this.backend || !text) return
    try {
      await this.backend.createTask({
        title: text,
        projectId: frame.projectId,
      })
      this.showToast(`added: ${text}`)
      // Refresh home counts so the new task is reflected.
      void this.loadHomeCounts()
    } catch (err) {
      this.setError(err)
    }
  }

  private cancelSttSession(): void {
    try {
      this.sttSession?.cancel()
    } catch { /* ignore */ }
    this.sttSession = null
  }

  // ── list tap flow ──────────────────────────────────────────────────────

  private async tapListTask(task: TodoTask, fromFrame: ListFrame): Promise<void> {
    const backend = this.backend
    if (!backend) return
    // Probe for subtasks before doing anything visible. Most taps will be
    // on leaves, and we don't want a "Loading…" flicker for those — the
    // UX is just "tap → toast in header → stays put".
    try {
      const subs = await backend.getSubtasks(task.id)
      if (this.top !== fromFrame) return // user navigated away mid-probe
      if (subs.length === 0) {
        fromFrame.completedInSession.add(task.id)
        this.showToast(`done: ${task.title}`)
        backend.completeTask(task.id).catch((err) => this.setError(err))
        return
      }
      this.stack.push({
        kind: 'subtasks',
        parentId: task.id,
        title: task.title,
        tasks: subs,
        completedInSession: new Set(),
      })
      this.change()
    } catch (err) {
      this.setError(err)
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────

  /**
   * First-error-wins: when four parallel loadHomeCounts fetches fail
   * simultaneously, we want the earliest root cause preserved for the
   * ERROR scene, not whichever finished last. The error clears when the
   * user taps to retry.
   *
   * The message is flattened (newlines collapsed) and bounded so a long
   * stack trace doesn't scroll the status container off-screen.
   */
  private setError(err: unknown): void {
    if (this.error) return
    this.error = { message: describeError(err) }
    this.change()
  }

  /**
   * Show a transient header message. The list container is untouched —
   * boot.ts recognizes the unchanged items array and updates only the
   * header TextContainer via textContainerUpgrade (no rebuild, firmware
   * selection stays where the user left it).
   */
  private showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toast = message
    this.change()
    this.toastTimer = setTimeout(() => {
      this.toast = null
      this.toastTimer = null
      this.change()
    }, TOAST_MS)
  }

  private clearToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer)
    this.toast = null
    this.toastTimer = null
  }

  private change(): void {
    this.onChange?.()
  }

  private get top(): Frame {
    return this.stack[this.stack.length - 1]
  }

  isAtRoot(): boolean {
    return this.stack.length === 1 && this.stack[0].kind === 'home'
  }
}

function blankHome(): HomeFrame {
  return { kind: 'home', counts: {}, hasMore: {} }
}

function describeError(err: unknown): string {
  const MAX = 200
  const raw = err instanceof Error
    ? `${err.name && err.name !== 'Error' ? err.name + ': ' : ''}${err.message || String(err)}`
    : String(err)
  const flat = raw.replace(/\s+/g, ' ').trim()
  return flat.length > MAX ? flat.slice(0, MAX) + '…' : flat
}
