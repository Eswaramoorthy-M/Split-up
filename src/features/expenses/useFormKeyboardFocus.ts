import { useEffect } from 'react'

const FOCUSABLE = 'input, textarea, select, .expense-select-trigger'

/**
 * Phones only: when the on-screen keyboard resizes the visual viewport, a
 * focused control can end up behind the sticky Save bar. Centre the control
 * whenever it would be clipped by the keyboard or the sticky action bar.
 * Uses native scrolling only; no layout-affecting styles or extra listeners on
 * tablet/desktop.
 */
export function useFormKeyboardFocus() {
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const element = event.target
      if (!(element instanceof HTMLElement) || !element.matches(FOCUSABLE)) return
      if (!window.matchMedia('(max-width: 639px)').matches) return

      // Wait for the browser's own focus scroll so we measure the final rect.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!element.isConnected || !window.matchMedia('(max-width: 639px)').matches) return
        const rect = element.getBoundingClientRect()
        const viewportBottom = window.visualViewport?.height ?? window.innerHeight
        const sticky = document.querySelector<HTMLElement>('.sticky-submit, .expense-mobile-save')
        const stickyTop = sticky ? sticky.getBoundingClientRect().top : viewportBottom
        const limit = Math.min(stickyTop, viewportBottom) - 12
        if (rect.bottom > limit || rect.top < 0) {
          element.scrollIntoView({ block: 'center', behavior: 'auto' })
        }
      }))
    }

    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [])
}
