import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import clsx from 'clsx'
import { Icon } from '@/components/ui/Icon'
import type { CycleInfo } from '@/types'
import { gsap, useGSAP } from '../animation'

interface Props {
  cycles: CycleInfo[]
  value: string
  onChange: (id: string) => void
}

/** Animated month selector. Presentation only — it forwards the existing cycle id. */
export function MonthPicker({ cycles, value, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const mountedRef = useRef(false)
  const menuId = useId()
  const [open, setOpen] = useState(false)

  const selectedIndex = Math.max(0, cycles.findIndex(cycle => cycle.id === value))
  const selected = cycles[selectedIndex]
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  useEffect(() => {
    optionRefs.current.length = cycles.length
    if (!open) setActiveIndex(selectedIndex)
  }, [cycles.length, selectedIndex, open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus())
    return () => cancelAnimationFrame(frame)
    // Arrow keys move focus themselves; only re-focus when the menu opens.
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback((focusTrigger = false) => {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }, [])

  const moveActive = (next: number) => {
    if (!cycles.length) return
    const index = (next + cycles.length) % cycles.length
    setActiveIndex(index)
    optionRefs.current[index]?.focus()
  }

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(selectedIndex)
      setOpen(true)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      close(true)
    }
  }

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        close(true)
        break
      case 'ArrowDown':
        event.preventDefault()
        moveActive(activeIndex + 1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveActive(activeIndex - 1)
        break
      case 'Home':
        event.preventDefault()
        moveActive(0)
        break
      case 'End':
        event.preventDefault()
        moveActive(cycles.length - 1)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  const choose = (cycle: CycleInfo) => {
    close(true)
    if (cycle.id !== value) onChange(cycle.id)
  }

  useGSAP(() => {
    const menu = menuRef.current
    const trigger = triggerRef.current
    if (!menu || !trigger) return

    const chevron = trigger.querySelector<HTMLElement>('.month-chevron')
    const options = gsap.utils.toArray<HTMLElement>('[data-month-option]', menu)

    // Keep the menu hidden on first paint so it never flashes before animating.
    if (!mountedRef.current) {
      mountedRef.current = true
      gsap.set(menu, { display: 'none', opacity: 0, y: -8, scale: 0.98 })
      if (chevron) gsap.set(chevron, { rotate: 0 })
      return
    }

    const mm = gsap.matchMedia()

    mm.add('(prefers-reduced-motion: reduce)', () => {
      gsap.set(menu, {
        display: open ? 'block' : 'none',
        opacity: open ? 1 : 0,
        y: 0,
        scale: 1,
        pointerEvents: open ? 'auto' : 'none'
      })
      if (chevron) gsap.set(chevron, { rotate: open ? 180 : 0 })
      if (options.length) gsap.set(options, { clearProps: 'all' })
    })

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (open) {
        gsap.set(menu, { display: 'block', pointerEvents: 'auto' })
        gsap.fromTo(menu,
          { opacity: 0, y: -10, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power3.out', clearProps: 'transform' }
        )
        if (options.length) {
          gsap.fromTo(options,
            { opacity: 0, y: 7 },
            { opacity: 1, y: 0, duration: 0.22, stagger: 0.028, delay: 0.04, ease: 'power2.out', clearProps: 'all' }
          )
        }
        if (chevron) gsap.fromTo(chevron, { rotate: 0 }, { rotate: 180, duration: 0.24, ease: 'power3.out' })
        gsap.fromTo(trigger, { scale: 0.985 }, { scale: 1, duration: 0.26, ease: 'back.out(2)', clearProps: 'transform' })
      } else {
        gsap.set(menu, { display: 'block', opacity: 1, y: 0, scale: 1, pointerEvents: 'none' })
        gsap.to(menu, {
          opacity: 0,
          y: -8,
          scale: 0.98,
          duration: 0.16,
          ease: 'power2.in',
          onComplete: () => gsap.set(menu, { display: 'none', clearProps: 'transform,pointerEvents' })
        })
        if (chevron) gsap.fromTo(chevron, { rotate: 180 }, { rotate: 0, duration: 0.2, ease: 'power2.out' })
      }
    })

    return () => mm.revert()
  }, { scope: rootRef, dependencies: [open], revertOnUpdate: true })

  if (!selected) return null

  return (
    <div className="report-month-picker" data-report-month ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={clsx('month-trigger', open && 'is-open')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="month-icon-wrap"><Icon name="calendar" size={18} /></span>
        <span className="month-copy">
          <small>Report period</small>
          <strong>{selected.label}</strong>
        </span>
        <span className={clsx('month-status', selected.status === 'closed' && 'is-closed')}>
          {selected.status === 'closed' ? 'Closed' : 'Live'}
        </span>
        <span className="month-chevron"><Icon name="chevronDown" size={16} /></span>
      </button>

      <div
        ref={menuRef}
        id={menuId}
        className="month-menu"
        role="listbox"
        aria-label="Select report month"
        onKeyDown={onMenuKeyDown}
      >
        <div className="month-menu-head">
          <span>Choose month</span>
          <span>{cycles.length} available</span>
        </div>
        <div className="month-menu-list">
          {cycles.map((cycle, index) => {
            const isSelected = cycle.id === value
            const isActive = index === activeIndex
            return (
              <button
                key={cycle.id}
                id={`${menuId}-${index}`}
                ref={element => { optionRefs.current[index] = element }}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-month-option
                className={clsx('month-option', isSelected && 'is-selected', isActive && 'is-active')}
                onClick={() => choose(cycle)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="month-option-dot" aria-hidden="true" />
                <span className="month-option-copy">
                  <strong>{cycle.label}</strong>
                  <small>{cycle.status === 'closed' ? 'Closed cycle' : 'Open cycle'}</small>
                </span>
                {isSelected && <span className="month-option-check"><Icon name="check" size={16} /></span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
