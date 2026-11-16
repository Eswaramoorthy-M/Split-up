import { Icon } from './Icon'

interface Props { title: string; body?: string; action?: React.ReactNode }

export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true"><Icon name="inbox" size={24} /></span>
      <p className="empty-title">{title}</p>
      {body && <p className="empty-body">{body}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}
