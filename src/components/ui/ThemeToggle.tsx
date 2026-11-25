import { MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import clsx from 'clsx'
import { useTheme } from '@/contexts/ThemeContext'
import { Icon } from './Icon'

interface ViewTransitionHandle {
  ready: Promise<void>
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ViewTransitionHandle
}

/**
 * A compact light/dark switch. The knob springs across the track and the new
 * theme is revealed with a circular wipe from the button (View Transitions
 * API) when the browser supports it, falling back to an instant swap.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next = isDark ? 'light' : 'dark'
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const doc = document as ViewTransitionDocument

    if (reduceMotion || !doc.startViewTransition) {
      setTheme(next)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const transition = doc.startViewTransition(() => {
      // Flush so the captured "new" frame already has the dark/light tokens.
      flushSync(() => setTheme(next))
    })

    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${radius}px at ${x}px ${y}px)`
            ]
          },
          {
            duration: 560,
            easing: 'cubic-bezier(0.22, 0.7, 0.2, 1)',
            pseudoElement: '::view-transition-new(root)'
          } as KeyframeAnimationOptions
        )
      })
      .catch(() => {
        // The transition was interrupted (for example by a route change).
      })
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={clsx('theme-toggle', className)}
      onClick={toggle}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-stars"><i /><i /><i /></span>
        <span className="theme-toggle-thumb">
          <Icon name={isDark ? 'moon' : 'sun'} size={15} strokeWidth={2} />
        </span>
      </span>
    </button>
  )
}
