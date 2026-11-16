import { ReactNode, useEffect } from 'react'
import { Icon } from './Icon'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

// Bottom sheet on phones, centered dialog on larger screens.
export function Modal({ open, title, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row-between modal-head">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" aria-label="Close" onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
