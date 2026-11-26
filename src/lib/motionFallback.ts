/**
 * Safety net for GSAP entrance animations.
 *
 * Entrance tweens apply `opacity: 0` synchronously in a layout effect and rely
 * on requestAnimationFrame to run the reveal. On a cold PWA launch (app opened
 * from the home screen, tab restored in the background) that first frame can
 * be delayed, leaving the page looking blank until a reload restarts it in the
 * foreground.
 *
 * This guard checks after a generous timeout and whenever the app becomes
 * visible again. If the intro never revealed its targets, it forces the final
 * state. It does nothing when the animation completed normally.
 */
export function guardReveal(
  targets: () => Array<Element | null | undefined>,
  reveal: () => void,
  waitMs = 2500
) {
  let settled = false
  let visibilityTimer = 0

  const check = () => {
    if (settled) return
    const elements = targets().filter(Boolean) as Element[]
    if (!elements.length) return

    const visible = elements.every(element => {
      const style = window.getComputedStyle(element)
      return style.visibility !== 'hidden' && Number(style.opacity) > 0.05
    })
    settled = true
    if (!visible) reveal()
  }

  const timer = window.setTimeout(check, waitMs)
  const scheduleCheck = () => {
    window.clearTimeout(visibilityTimer)
    // Give the ticker one beat to catch up before deciding it stalled.
    visibilityTimer = window.setTimeout(check, 200)
  }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') scheduleCheck()
  }
  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted && document.visibilityState === 'visible') scheduleCheck()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', onPageShow)

  return () => {
    window.clearTimeout(timer)
    window.clearTimeout(visibilityTimer)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pageshow', onPageShow)
  }
}
