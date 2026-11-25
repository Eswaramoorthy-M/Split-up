import { forwardRef, ReactNode, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { Icon, LogoMark } from '@/components/ui/Icon'
import { AuthShowcase } from './AuthShowcase'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export interface AuthLayoutHandle {
  /** Subtle horizontal shake used when a form submission fails. */
  shake: () => void
}

interface Props {
  children: ReactNode
  /** Reassurance line under the card. Pass null to hide it. */
  footnote?: ReactNode
}

/**
 * Shared shell for the auth screens: animated brand showcase on the left,
 * a focused form panel on the right, and the responsive single-column
 * fallback on phones. Pages only provide the card content.
 */
export const AuthLayout = forwardRef<AuthLayoutHandle, Props>(function AuthLayout(
  { children, footnote },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    shake() {
      const card = cardRef.current
      if (!card || prefersReducedMotion()) return
      gsap.timeline({ defaults: { ease: 'power2.out' } })
        .to(card, { x: -7, duration: 0.06 })
        .to(card, { x: 6, duration: 0.06 })
        .to(card, { x: -4, duration: 0.06 })
        .to(card, { x: 2, duration: 0.06 })
        .to(card, { x: 0, duration: 0.08 })
    }
  }), [])

  // Entrance choreography + ambient loops. Everything lives inside a gsap
  // context so it is fully reverted when the page unmounts.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      if (prefersReducedMotion()) return

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      tl.from('.showcase-brand', { y: -14, opacity: 0, duration: 0.55 })
        .from('.showcase-copy > *', { y: 18, opacity: 0, duration: 0.6, stagger: 0.08 }, '-=0.3')
        .from('.showcase-core', { scale: 0.6, opacity: 0, duration: 0.7, ease: 'back.out(1.6)' }, '-=0.5')
        .from('.orbit', { scale: 0.75, opacity: 0, duration: 0.7, stagger: 0.07 }, '-=0.6')
        .from(
          '.float-card, .float-pill',
          { y: 16, opacity: 0, scale: 0.9, duration: 0.6, stagger: 0.12, ease: 'back.out(1.4)' },
          '-=0.45'
        )
        .from('.login-card', { y: 26, opacity: 0, duration: 0.6 }, '-=0.5')
        .from('.login-card [data-reveal]', { y: 14, opacity: 0, duration: 0.45, stagger: 0.06 }, '-=0.3')

      // Ambient motion: slow orbits, a breathing logo, floating cards.
      gsap.to('.orbit-outer', { rotation: 360, duration: 48, repeat: -1, ease: 'none' })
      gsap.to('.orbit-mid', { rotation: -360, duration: 34, repeat: -1, ease: 'none' })
      gsap.to('.orbit-inner', { rotation: 360, duration: 24, repeat: -1, ease: 'none' })
      gsap.to('.showcase-core', { y: -9, duration: 3.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.float-card-a', { y: -12, duration: 3, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.float-card-b', { y: 10, duration: 3.6, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.4 })
      gsap.to('.float-pill-a', { y: -7, duration: 2.6, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.8 })
      gsap.to('.showcase-glow-a', { x: 28, y: -18, duration: 12, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.showcase-glow-b', { x: -22, y: 16, duration: 14, repeat: -1, yoyo: true, ease: 'sine.inOut' })
    }, root)

    return () => ctx.revert()
  }, [])

  // Pointer parallax on the brand panel (desktop, fine pointers only).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const panel = root.querySelector<HTMLElement>('.login-showcase')
    const stage = root.querySelector<HTMLElement>('.showcase-stage')
    if (!panel || !stage) return

    const moveX = gsap.quickTo(stage, 'x', { duration: 0.8, ease: 'power3.out' })
    const moveY = gsap.quickTo(stage, 'y', { duration: 0.8, ease: 'power3.out' })

    const onMove = (event: PointerEvent) => {
      const rect = panel.getBoundingClientRect()
      const nx = (event.clientX - rect.left) / rect.width - 0.5
      const ny = (event.clientY - rect.top) / rect.height - 0.5
      moveX(nx * 16)
      moveY(ny * 12)
    }
    const onLeave = () => {
      moveX(0)
      moveY(0)
    }

    panel.addEventListener('pointermove', onMove)
    panel.addEventListener('pointerleave', onLeave)
    return () => {
      panel.removeEventListener('pointermove', onMove)
      panel.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const resolvedFootnote = footnote === undefined
    ? <><Icon name="lock" size={13} /> Secure sign-in · Your data stays private</>
    : footnote

  return (
    <div className="login-page" ref={rootRef}>
      <div className="login-shell">
        <AuthShowcase />

        <main className="login-main">
          <div className="login-box">
            <div className="login-mobile-brand">
              <LogoMark size={34} />
              <span className="brand-word">SplitUp</span>
            </div>

            <div className="login-card" ref={cardRef}>
              {children}
            </div>

            {resolvedFootnote && <p className="login-footnote">{resolvedFootnote}</p>}
          </div>
        </main>
      </div>
    </div>
  )
})

AuthLayout.displayName = 'AuthLayout'
