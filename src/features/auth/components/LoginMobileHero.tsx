import { Icon, LogoMark } from '@/components/ui/Icon'

/**
 * Phone-only decorative hero for Login. It is opt-in through AuthLayout and is
 * hidden above the single-column breakpoint, so desktop auth screens keep the
 * existing split layout untouched. Everything here is aria-hidden: the theme
 * toggle stays outside this section and keeps its normal focus order.
 */
export function LoginMobileHero() {
  return (
    <section className="login-mobile-hero">
      <span className="login-hero-glow login-hero-glow-a" aria-hidden="true" />
      <span className="login-hero-glow login-hero-glow-b" aria-hidden="true" />
      <span className="login-hero-dots" aria-hidden="true" />

      <div className="login-hero-brand">
        <LogoMark size={30} />
        <span className="login-hero-wordmark">SplitUp</span>
      </div>

      <div className="login-scene" aria-hidden="true">
        <span className="scene-orbit scene-orbit-a" />
        <span className="scene-orbit scene-orbit-b" />

        <div className="scene-floaters">
          <span className="scene-float scene-phone">
            <Icon name="phone" size={14} />
            <Icon name="check" size={11} strokeWidth={2.6} />
          </span>
          <span className="scene-float scene-wallet"><Icon name="wallet" size={16} /></span>
          <span className="scene-float scene-pie"><Icon name="chart" size={15} /></span>
          <span className="scene-spark scene-spark-a" />
          <span className="scene-spark scene-spark-b" />
          <span className="scene-note scene-note-paid">Arun paid <strong>₹1,250</strong></span>
          <span className="scene-note scene-note-owe">Meera owes <strong>₹420</strong></span>
          <span className="scene-pill">Settled <Icon name="check" size={12} strokeWidth={2.6} /></span>
        </div>

        <div className="scene-receipt">
          <svg viewBox="0 0 120 146" aria-hidden="true" focusable="false">
            <path
              className="receipt-body"
              d="M12 7h96v132l-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5-8-5z"
            />
            <path className="receipt-line" d="M28 34h64M28 49h64M28 64h43" />
            <path className="receipt-rule" d="M28 86h64" />
            <path className="receipt-total-line" d="M28 103h28" />
          </svg>
          <span className="scene-receipt-total">₹2,090</span>
        </div>

        <span className="scene-coin-main">₹</span>

        <span className="scene-chip scene-chip-a">₹</span>
        <span className="scene-chip scene-chip-b">₹</span>
        <span className="scene-chip scene-chip-c">₹</span>

        <span className="scene-avatar scene-avatar-a">
          A<span className="scene-amount">₹420</span>
        </span>
        <span className="scene-avatar scene-avatar-b">
          M<span className="scene-amount">₹1,250</span>
        </span>
        <span className="scene-avatar scene-avatar-c">
          S<span className="scene-amount">₹420</span>
        </span>
      </div>
    </section>
  )
}
