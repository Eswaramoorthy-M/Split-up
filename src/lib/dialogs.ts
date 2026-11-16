export type DialogTone = 'default' | 'danger' | 'success' | 'warning'

export interface DialogOptions {
  title: string
  message?: string
  /** Primary button label. Defaults to "Confirm" (or "Got it" for alerts). */
  confirmLabel?: string
  /** Secondary button label. Defaults to "Cancel". */
  cancelLabel?: string
  tone?: DialogTone
}

export interface QueuedDialog extends DialogOptions {
  id: number
  tone: DialogTone
  alertOnly: boolean
  resolve: (confirmed: boolean) => void
}

// A tiny module-level queue keeps the dialog API usable from anywhere —
// components and plain services — without threading a provider through the app.
const queue: QueuedDialog[] = []
let current: QueuedDialog | null = null
let nextId = 0
const listeners = new Set<(dialog: QueuedDialog | null) => void>()

function emit() {
  listeners.forEach(listener => listener(current))
}

function open(options: DialogOptions, alertOnly: boolean): Promise<boolean> {
  return new Promise(resolve => {
    queue.push({ ...options, id: ++nextId, tone: options.tone ?? 'default', alertOnly, resolve })
    if (!current) {
      current = queue.shift() ?? null
      emit()
    }
  })
}

/** Ask the person to confirm an action. Resolves `true` when they confirm. */
export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return open(options, false)
}

/** Show a message with a single "Got it" button. */
export function alertDialog(options: DialogOptions): Promise<boolean> {
  return open(options, true)
}

/** Used by the host to render the current request. */
export function getCurrentDialog(): QueuedDialog | null {
  return current
}

export function subscribeDialogs(listener: (dialog: QueuedDialog | null) => void): () => void {
  listeners.add(listener)
  listener(current)
  return () => { listeners.delete(listener) }
}

/** Close the visible dialog and move on to the next queued one. */
export function settleDialog(confirmed: boolean) {
  current?.resolve(confirmed)
  current = queue.shift() ?? null
  emit()
}
