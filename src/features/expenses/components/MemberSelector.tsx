import clsx from 'clsx'
import type { GroupMember } from '@/types'

interface Props {
  members: GroupMember[]
  selected: string[]
  onChange: (userIds: string[]) => void
}

export function MemberSelector({ members, selected, onChange }: Props) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }
  return (
    <div className="stack-xs">
      {members.map(m => {
        const checked = selected.includes(m.user_id)
        return (
          <label key={m.user_id} className={clsx('member-check', checked && 'checked')}>
            <input type="checkbox" checked={checked} onChange={() => toggle(m.user_id)} />
            <span>{m.profile?.name}</span>
          </label>
        )
      })}
    </div>
  )
}
