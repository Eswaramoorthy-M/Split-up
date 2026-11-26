import { useRef } from 'react'
import clsx from 'clsx'
import type { GroupMember } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { gsap, useGSAP } from '../animation'

interface Props {
  members: GroupMember[]
  selected: string[]
  onChange: (userIds: string[]) => void
}

export function MemberSelector({ members, selected, onChange }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  // Chip "pop" on toggle — transform only, and only when motion is allowed.
  useGSAP(() => {
    const root = listRef.current
    if (!root) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      if (!context.conditions?.motion) return
      const onToggle = (event: Event) => {
        const chip = (event.target as HTMLElement).closest<HTMLElement>('.member-chip')
        if (!chip) return
        gsap.fromTo(chip, { scale: 0.97 }, { scale: 1, duration: 0.2, ease: 'back.out(2.2)', overwrite: 'auto' })
      }
      root.addEventListener('change', onToggle)
      return () => root.removeEventListener('change', onToggle)
    })
    return () => mm.revert()
  }, { scope: listRef })

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  return (
    <div className="member-selector">
      <div className="member-selector-toolbar">
        <span className="member-selector-count">
          {selected.length} of {members.length} selected
        </span>
        <span className="member-selector-actions">
          <button type="button" onClick={() => onChange(members.map(m => m.user_id))} disabled={selected.length === members.length}>
            Select all
          </button>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={() => onChange([])} disabled={selected.length === 0}>
            Clear
          </button>
        </span>
      </div>
      <div className="member-chip-list" ref={listRef}>
        {members.map(m => {
          const checked = selected.includes(m.user_id)
          const name = m.profile?.name ?? 'Member'
          return (
            <label key={m.user_id} className={clsx('member-check', 'member-chip', checked && 'checked')}>
              <input
                className="member-chip-input"
                type="checkbox"
                checked={checked}
                aria-checked={checked}
                aria-label={name}
                onChange={() => toggle(m.user_id)}
              />
              <span className="avatar avatar-xs member-chip-avatar" aria-hidden="true">
                {name[0]?.toUpperCase()}
              </span>
              <span className="member-chip-name" title={name}>{name}</span>
              <span className="member-chip-check" aria-hidden="true">
                <Icon name={checked ? 'check' : 'plus'} size={14} strokeWidth={2.4} />
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
