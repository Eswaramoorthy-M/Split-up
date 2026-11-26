import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import clsx from 'clsx'
import { Icon, type IconName } from '@/components/ui/Icon'
import { gsap, useGSAP } from '../animation'

export interface ExpenseSelectOption {
  value: string
  label: string
  /** Emoji shown before the label, e.g. a category icon. */
  icon?: string | null
  meta?: string
  metaTone?: 'live' | 'closed' | 'settled'
}

interface Props {
  options: ExpenseSelectOption[]
  value: string
  onChange: (value: string) => void
  label: string
  icon?: IconName
  className?: string
  id?: string
  ariaLabel?: string
  ariaLabelledBy?: string
  hideEyebrow?: boolean
  disabled?: boolean
}

/**
 * The same trigger/menu pattern as the Reports month picker, with expense data.
 * Presentation only — it forwards the existing value strings unchanged.
 */
export function ExpenseSelect({
  options,
  value,
  onChange,
  label,
  icon = 'tag',
  className,
  id,
  ariaLabel,
  ariaLabelledBy,
  hideEyebrow = false,
  disabled = false
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const mountedRef = useRef(false)
  const menuId = useId()
  const [open, setOpen] = useState(false)

  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value))
  const selected = options[selectedIndex]
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  useEffect(() => {
    optionRefs.current.length = options.length
    if (!open) setActiveIndex(selectedIndex)
  }, [options.length, selectedIndex, open])

  useEffect(() => {
    if (!open || disabled) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, disabled])

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
    if (!options.length) return
    const index = (next + options.length) % options.length
    setActiveIndex(index)
    optionRefs.current[index]?.focus()
  }

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
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
        moveActive(options.length - 1)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  const choose = (option: ExpenseSelectOption) => {
    close(true)
    if (option.value !== value) onChange(option.value)
  }

  useGSAP(() => {
    const menu = menuRef.current
    const trigger = triggerRef.current
    if (!menu || !trigger) return

    const chevron = trigger.querySelector<HTMLElement>('.expense-select-chevron')
    const optionsEls = gsap.utils.toArray<HTMLElement>('[data-expense-option]', menu)

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
      if (optionsEls.length) gsap.set(optionsEls, { clearProps: 'all' })
    })

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      if (open) {
        gsap.set(menu, { display: 'block', pointerEvents: 'auto' })
        gsap.fromTo(menu,
          { opacity: 0, y: -10, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'power3.out', clearProps: 'transform' }
        )
        if (optionsEls.length) {
          gsap.fromTo(optionsEls,
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
    <div className={clsx('expense-select', className, disabled && 'is-disabled')} data-expense-select ref={rootRef}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={clsx('expense-select-trigger', open && 'is-open')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabelledBy ? undefined : ariaLabel ?? label}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="expense-select-icon-wrap"><Icon name={icon} size={18} /></span>
        <span className="expense-select-copy">
          {!hideEyebrow && <small>{label}</small>}
          <strong>
            {selected.icon && <span className="expense-select-selected-icon" aria-hidden="true">{selected.icon}</span>}
            {selected.label}
          </strong>
        </span>
        {selected.meta && (
          <span className={clsx('expense-select-meta', selected.metaTone === 'closed' && 'is-closed')}>
            {selected.meta}
          </span>
        )}
        <span className="expense-select-chevron"><Icon name="chevronDown" size={16} /></span>
      </button>

      <div
        ref={menuRef}
        id={menuId}
        className="expense-select-menu"
        role="listbox"
        aria-label={ariaLabel ?? label}
        onKeyDown={onMenuKeyDown}
      >
        <div className="expense-select-menu-head">
          <span>{label}</span>
          <span>{options.length} available</span>
        </div>
        <div className="expense-select-menu-list">
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex
            return (
              <button
                key={option.value}
                type="button"
                ref={element => { optionRefs.current[index] = element }}
                role="option"
                aria-selected={isSelected}
                data-expense-option
                className={clsx('expense-select-option', isSelected && 'is-selected', isActive && 'is-active')}
                onClick={() => choose(option)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="expense-select-option-dot" aria-hidden="true" />
                <span className="expense-select-option-copy">
                  <strong>
                    {option.icon && <span className="expense-select-selected-icon" aria-hidden="true">{option.icon}</span>}
                    {option.label}
                  </strong>
                </span>
                {isSelected && <span className="expense-select-option-check"><Icon name="check" size={16} /></span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
