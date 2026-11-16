import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Modal } from './Modal'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'
import {
  getCurrentDialog,
  settleDialog,
  subscribeDialogs,
  type DialogTone,
  type QueuedDialog
} from '@/lib/dialogs'

export { alertDialog, confirmDialog } from '@/lib/dialogs'
export type { DialogOptions, DialogTone } from '@/lib/dialogs'

const ICONS: Record<DialogTone, IconName> = {
  default: 'info',
  danger: 'trash',
  success: 'checkCircle',
  warning: 'alert'
}

/**
 * Mounted once in the app shell. Renders the current confirm/alert request in
 * the same bottom-sheet-on-mobile / dialog-on-desktop style as every other
 * modal in SplitUp.
 */
export function ConfirmDialogHost() {
  const [dialog, setDialog] = useState<QueuedDialog | null>(getCurrentDialog)

  useEffect(() => subscribeDialogs(setDialog), [])

  if (!dialog) return null

  const tone = dialog.tone
  const confirmLabel = dialog.confirmLabel ?? (dialog.alertOnly ? 'Got it' : 'Confirm')

  return (
    <Modal open title={dialog.title} onClose={() => settleDialog(false)}>
      <div className={clsx('confirm-dialog', `confirm-dialog-${tone}`)}>
        <span className="confirm-dialog-icon" aria-hidden="true">
          <Icon name={ICONS[tone]} size={22} />
        </span>
        {dialog.message && <p className="confirm-dialog-message">{dialog.message}</p>}
      </div>
      <div className="confirm-dialog-actions">
        {!dialog.alertOnly && (
          <Button variant="secondary" onClick={() => settleDialog(false)}>
            {dialog.cancelLabel ?? 'Cancel'}
          </Button>
        )}
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} autoFocus onClick={() => settleDialog(true)}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
