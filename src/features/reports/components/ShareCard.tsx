import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { whatsappUrl } from '@/services/sharing'
import { Card } from '@/components/ui/Card'

interface Props {
  reportText: string
  monthLabel: string
  onShare: () => Promise<'shared' | 'copied' | 'cancelled'>
}

export function ShareCard({ reportText, monthLabel, onShare }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  const copy = async () => {
    const result = await onShare()
    if (result !== 'copied') return
    setCopied(true)
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="report-card report-share-card" data-animate>
      <div className="report-card-head">
        <div>
          <p className="report-card-label">Ready to send</p>
          <h2 className="report-card-title">Share this report</h2>
        </div>
        <span className="share-badge"><Icon name="message" size={16} /> WhatsApp</span>
      </div>

      <p className="report-card-copy">
        A ready-made summary of {monthLabel || 'this month'} — categories, member balances and who pays whom.
      </p>

      <div className="chat-preview" aria-label={`${monthLabel} report preview`}>
        <div className="chat-bubble">{reportText}</div>
        <span className="chat-fade" aria-hidden="true" />
      </div>

      <div className="report-actions">
        <a
          className="btn btn-primary share-whatsapp"
          href={whatsappUrl(reportText)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="message" size={18} />
          Share on WhatsApp
        </a>
        <Button variant="secondary" onClick={copy} className={copied ? 'is-copied' : undefined}>
          <span className={`copy-icon${copied ? ' copied' : ''}`} aria-hidden="true">
            <Icon name={copied ? 'check' : 'copy'} size={18} />
          </span>
          <span aria-live="polite">{copied ? 'Copied ✓' : 'Share / copy'}</span>
        </Button>
      </div>
    </Card>
  )
}
