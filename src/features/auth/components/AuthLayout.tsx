import { forwardRef, ReactNode, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { Icon, LogoMark } from '@/components/ui/Icon'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { guardReveal } from '@/lib/motionFallback'
import { AuthShowcase } from './AuthShowcase'
import { LoginMobileHero } from './LoginMobileHero'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export interface AuthLayoutHandle {
  /** Subtle horizontal shake used when a form submission fails. */
  shake: () => void
  /** Phone-only error feedback: sheet tint and coin recoil. No-op on desktop. */
  mobileError: () => void
  /** Phone-only success transition. Calls `done` immediately on desktop. */
  mobileSuccess: (done: () => void) => void
}

interface Props {
  children: ReactNode
  /** Reassurance line under the card. Pass null to hide it. */
  footnote?: ReactNode
  /** Opt-in phone hero; only Login enables it. */
  mobileHero?: boolean
}

/**
 * Shared shell for the auth screens: animated brand showcase on the left,
 * a focused form panel on the right, and the responsive single-column
 * fallback on phones. Pages only provide the card content.
 */
export const AuthLayout = forwardRef<AuthLayoutHandle, Props>(function AuthLayout(
  { children, footnote, mobileHero = false },
  ref
) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const cycleRef = useRef<gsap.core.Timeline | null>(null)
  const ambientRef = useRef<Array<gsap.core.Tween | gsap.core.Timeline>>([])
  const syncMotionRef = useRef<() => void>(() => {})
  const applyKeyboardRef = useRef<(open: boolean) => void>(() => {})
  const keyboardOpenRef = useRef(false)
  const transientMmRef = useRef<{ revert: () => void } | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

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
    },

    mobileError() {
      const root = rootRef.current
      if (!root || prefersReducedMotion() || window.matchMedia('(min-width: 1024px)').matches) return
      transientMmRef.current?.revert()
      const mm = gsap.matchMedia()
      transientMmRef.current = mm

      mm.add('(max-width: 1023px)', () => {
        const flash = root.querySelector<HTMLElement>('.login-error-flash')
        const coins = root.querySelectorAll<HTMLElement>('.scene-coin-main, .scene-chip')
        const tl = gsap.timeline({
          onComplete: () => {
            mm.revert()
            if (transientMmRef.current === mm) transientMmRef.current = null
          }
        })
        if (flash) {
          tl.fromTo(flash, { opacity: 0 }, { opacity: 0.22, duration: 0.12, ease: 'power2.out' })
            .to(flash, { opacity: 0, duration: 0.26, ease: 'power2.in' })
        }
        if (coins.length) {
          tl.fromTo(coins, { x: 0 }, {
            x: (index: number) => (index % 2 ? 7 : -7),
            duration: 0.09,
            repeat: 3,
            yoyo: true,
            ease: 'power2.out',
            stagger: 0.03
          }, 0)
        }
        return () => tl.kill()
      })
    },

    mobileSuccess(done) {
      const root = rootRef.current
      if (!root || prefersReducedMotion() || window.matchMedia('(min-width: 1024px)').matches) {
        done()
        return
      }
      transientMmRef.current?.revert()
      const mm = gsap.matchMedia()
      transientMmRef.current = mm

      mm.add('(max-width: 1023px)', () => {
        const coins = root.querySelectorAll<HTMLElement>('.scene-coin-main, .scene-chip')
        const tl = gsap.timeline({
          onComplete: () => {
            done()
            mm.revert()
            if (transientMmRef.current === mm) transientMmRef.current = null
          }
        })
        if (coins.length) {
          tl.to(coins, {
            x: 0,
            y: 96,
            scale: 0,
            opacity: 0,
            duration: 0.42,
            stagger: 0.04,
            ease: 'power2.in'
          })
        }
        tl.to(root, { opacity: 0, scale: 0.985, duration: 0.28, ease: 'power2.inOut' }, '-=0.12')
        return () => tl.kill()
      })
    }
  }), [])

  // Entrance choreography + ambient loops. Desktop keeps the original
  // timeline; the phone-only scene runs only inside its own matchMedia query.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const mm = gsap.matchMedia()

    mm.add('(min-width: 1024px)', () => {
      if (prefersReducedMotion()) return

      const ctx = gsap.context(() => {
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
    })

    if (mobileHero) {
      mm.add('(max-width: 1023px)', () => {
        if (prefersReducedMotion()) return

        let removeParallax: (() => void) | undefined
        const ctx = gsap.context(() => {
          const hero = root.querySelector<HTMLElement>('.login-mobile-hero')
          const sheet = root.querySelector<HTMLElement>('.login-card')
          const receipt = root.querySelector<HTMLElement>('.scene-receipt')
          const mainCoin = root.querySelector<HTMLElement>('.scene-coin-main')
          const chips = gsap.utils.toArray<HTMLElement>('.scene-chip', root)
          const avatars = gsap.utils.toArray<HTMLElement>('.scene-avatar', root)
          const amounts = gsap.utils.toArray<HTMLElement>('.scene-amount', root)
          const reveals = gsap.utils.toArray<HTMLElement>('.login-card [data-reveal]', root)

          const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
          if (hero) intro.from(hero, { opacity: 0, duration: 0.45 })
          if (receipt) {
            intro.from(receipt, {
              y: -64, opacity: 0, rotation: -6, duration: 0.7, ease: 'back.out(1.5)'
            }, '-=0.18')
          }
          if (mainCoin) {
            intro.from(mainCoin, { y: 12, scale: 0, opacity: 0, duration: 0.42, ease: 'back.out(2.4)' }, '-=0.28')
          }
          if (chips.length) {
            intro.from(chips, {
              x: -18, scale: 0, opacity: 0, duration: 0.4, stagger: 0.07, ease: 'back.out(2.2)'
            }, '-=0.2')
          }
          if (avatars.length) {
            intro.from(avatars, { scale: 0, opacity: 0, duration: 0.45, stagger: 0.07, ease: 'back.out(2)' }, '-=0.18')
          }
          if (amounts.length) {
            intro.from(amounts, {
              y: 6, scale: 0, opacity: 0, duration: 0.32, stagger: 0.06, ease: 'back.out(3)'
            }, '-=0.16')
          }
          if (sheet) intro.from(sheet, { y: 60, opacity: 0, duration: 0.62 }, '-=0.12')
          if (reveals.length) {
            intro.from(reveals, { y: 14, opacity: 0, duration: 0.42, stagger: 0.055 }, '-=0.34')
          }

          // Master coin-split cycle: one coin leaves the receipt, splits into
          // three, lands on A/M/S, then returns before the next round.
          const cycle = gsap.timeline({ repeat: -1, repeatDelay: 0.55, delay: 2.4 })
          if (mainCoin) {
            cycle.to(mainCoin, { y: -14, scale: 1.12, duration: 0.35, ease: 'power2.out' })
              .to(mainCoin, { scale: 0, opacity: 0, duration: 0.2, ease: 'power2.in' }, '+=0.04')
          }
          if (chips.length) {
            cycle.fromTo(chips,
              { x: 0, y: 0, scale: 0, opacity: 0 },
              {
                x: (index: number) => [-82, 0, 82][index] ?? 0,
                y: (index: number) => [-30, -58, -26][index] ?? 0,
                scale: 1,
                opacity: 1,
                duration: 0.62,
                stagger: 0.08,
                ease: 'power2.out'
              }, '-=0.06'
            )
          }
          if (avatars.length) {
            cycle.to(avatars, {
              scale: 1.12, duration: 0.18, stagger: 0.06, yoyo: true, repeat: 1, ease: 'power2.out'
            }, '-=0.24')
          }
          if (amounts.length) {
            cycle.fromTo(amounts,
              { y: 6, scale: 0, opacity: 0 },
              { y: 0, scale: 1, opacity: 1, duration: 0.3, stagger: 0.06, ease: 'back.out(3)' },
              '-=0.28'
            )
          }
          if (chips.length) {
            cycle.to(chips, {
              scale: 0, opacity: 0, duration: 0.26, stagger: 0.04, ease: 'power2.in'
            }, '+=1.7')
          }
          if (avatars.length) {
            cycle.to(avatars, { scale: 1, duration: 0.2, stagger: 0.04 }, '-=0.2')
          }
          if (mainCoin) {
            cycle.to(mainCoin, { y: 0, scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' }, '-=0.1')
          }
          cycleRef.current = cycle

          ambientRef.current = [
            gsap.to('.scene-orbit-a', { rotation: 360, duration: 28, repeat: -1, ease: 'none', transformOrigin: '50% 50%' }),
            gsap.to('.scene-orbit-b', { rotation: -360, duration: 19, repeat: -1, ease: 'none', transformOrigin: '50% 50%' }),
            gsap.to('.scene-receipt', { y: -7, duration: 3.2, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2.4 }),
            gsap.to('.scene-floaters', { y: -9, duration: 4.4, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 2.4 }),
            gsap.to('.scene-phone', { y: -5, duration: 2.7, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.4 }),
            gsap.to('.scene-wallet', { y: 6, duration: 3.6, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 1.2 }),
            gsap.to('.scene-pill', { y: -4, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: 0.9 })
          ]

          syncMotionRef.current = () => {
            const paused = keyboardOpenRef.current || document.hidden
            if (cycleRef.current) paused ? cycleRef.current.pause() : cycleRef.current.resume()
            ambientRef.current.forEach(animation => paused ? animation.pause() : animation.resume())
          }
          syncMotionRef.current()

          // Touch parallax; no device-orientation permission prompt.
          if (window.matchMedia('(pointer: coarse)').matches) {
            const scene = root.querySelector<HTMLElement>('.login-scene')
            const moveX = scene ? gsap.quickTo(scene, 'x', { duration: 0.55, ease: 'power3.out' }) : null
            const moveY = scene ? gsap.quickTo(scene, 'y', { duration: 0.55, ease: 'power3.out' }) : null

            const onMove = (event: PointerEvent) => {
              if (!hero || !moveX || !moveY) return
              const rect = hero.getBoundingClientRect()
              moveX(((event.clientX - rect.left) / rect.width - 0.5) * 12)
              moveY(((event.clientY - rect.top) / rect.height - 0.5) * 9)
            }
            const onLeave = () => {
              moveX?.(0)
              moveY?.(0)
            }
            const onTap = (event: PointerEvent) => {
              const target = (event.target as HTMLElement).closest<HTMLElement>(
                '.scene-receipt, .scene-coin-main, .scene-chip'
              )
              if (!target) return
              gsap.fromTo(target, { scale: 0.9 }, { scale: 1, duration: 0.45, ease: 'back.out(3)', overwrite: 'auto' })
            }

            hero?.addEventListener('pointermove', onMove)
            hero?.addEventListener('pointerleave', onLeave)
            hero?.addEventListener('pointerdown', onTap)
            removeParallax = () => {
              hero?.removeEventListener('pointermove', onMove)
              hero?.removeEventListener('pointerleave', onLeave)
              hero?.removeEventListener('pointerdown', onTap)
            }
          }

          return () => removeParallax?.()
        }, root)

        return () => {
          ctx.revert()
          removeParallax?.()
          cycleRef.current = null
          ambientRef.current = []
          syncMotionRef.current = () => {}
        }
      })
    }

    return () => mm.revert()
  }, [mobileHero])

  // `gsap.from()` paints the hidden state immediately. If the first frame is
  // delayed on a cold PWA launch, settle everything to its visible state.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const revealTargets = () => Array.from(root.querySelectorAll<HTMLElement>(
      '.showcase-brand, .showcase-copy > *, .showcase-core, .orbit, .float-card, .float-pill, ' +
      '.login-card, .login-card [data-reveal], .login-mobile-hero, .scene-receipt, ' +
      '.scene-coin-main, .scene-chip, .scene-avatar, .scene-amount'
    ))

    return guardReveal(revealTargets, () => {
      const targets = revealTargets()
      gsap.killTweensOf(targets)
      gsap.set(targets, { opacity: 1, x: 0, y: 0, yPercent: 0, scale: 1, rotation: 0 })
    }, 3500)
  }, [])

  // Keyboard state: visualViewport is the reliable signal on iOS; focus events
  // make the response immediate while the viewport resize settles.
  useEffect(() => {
    let focusTimer = 0
    const viewport = window.visualViewport
    const readViewport = () => {
      if (viewport) setKeyboardOpen(window.innerHeight - viewport.height > 120)
    }
    const onFocusIn = (event: FocusEvent) => {
      if ((event.target as HTMLElement).matches('input, textarea')) setKeyboardOpen(true)
    }
    const onFocusOut = () => {
      window.clearTimeout(focusTimer)
      focusTimer = window.setTimeout(readViewport, 0)
    }

    viewport?.addEventListener('resize', readViewport)
    window.addEventListener('resize', readViewport)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    readViewport()

    return () => {
      window.clearTimeout(focusTimer)
      viewport?.removeEventListener('resize', readViewport)
      window.removeEventListener('resize', readViewport)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  // Sheet lift, scene fade and ambient pause all live in the mobile
  // matchMedia callback above; this effect only forwards the current state.
  useEffect(() => {
    keyboardOpenRef.current = keyboardOpen
    applyKeyboardRef.current(keyboardOpen)
  }, [keyboardOpen])

  useEffect(() => {
    if (!mobileHero) return
    const mm = gsap.matchMedia()
    mm.add('(max-width: 1023px)', () => {
      const root = rootRef.current
      const sheet = root?.querySelector<HTMLElement>('.login-card')
      const scene = root?.querySelector<HTMLElement>('.login-scene')
      const hero = root?.querySelector<HTMLElement>('.login-mobile-hero')

      applyKeyboardRef.current = open => {
        if (sheet) gsap.to(sheet, { y: open ? -12 : 0, duration: 0.35, ease: 'power3.out', overwrite: 'auto' })
        if (scene) gsap.to(scene, { scale: open ? 0.82 : 1, opacity: open ? 0.45 : 1, duration: 0.35, ease: 'power3.out', overwrite: 'auto' })
        if (hero) gsap.to(hero, { y: open ? -8 : 0, duration: 0.35, ease: 'power3.out', overwrite: 'auto' })
        syncMotionRef.current()
      }
      applyKeyboardRef.current(keyboardOpenRef.current)

      const onVisibility = () => syncMotionRef.current()
      document.addEventListener('visibilitychange', onVisibility)
      return () => {
        applyKeyboardRef.current = () => {}
        document.removeEventListener('visibilitychange', onVisibility)
      }
    })
    return () => mm.revert()
  }, [mobileHero])

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

  useEffect(() => () => transientMmRef.current?.revert(), [])

  const resolvedFootnote = footnote === undefined
    ? <><Icon name="lock" size={13} /> Secure sign-in · Your data stays private</>
    : footnote

  const pageClass = [
    'login-page',
    mobileHero && 'login-page--mobile-hero',
    mobileHero && keyboardOpen && 'login-page--keyboard'
  ].filter(Boolean).join(' ')

  return (
    <div className={pageClass} ref={rootRef}>
      <div className="auth-theme"><ThemeToggle /></div>
      {mobileHero && <LoginMobileHero />}

      <div className="login-shell">
        <AuthShowcase />

        <main className="login-main">
          <div className="login-box">
            <div className="login-mobile-brand">
              <LogoMark size={34} />
              <span className="brand-word">SplitUp</span>
            </div>

            <div className="login-card" ref={cardRef}>
              {mobileHero && <span className="login-error-flash" aria-hidden="true" />}
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
