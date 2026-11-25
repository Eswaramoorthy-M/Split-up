import { Icon, LogoMark } from '@/components/ui/Icon'

/**
 * Decorative brand panel for the login screen.
 * Everything here is purely presentational and animated with GSAP from the
 * parent page; it uses the shared token palette (night / ultramarine).
 */
export function AuthShowcase() {
  return (
    <section className="login-showcase">
      <span className="showcase-glow showcase-glow-a" aria-hidden="true" />
      <span className="showcase-glow showcase-glow-b" aria-hidden="true" />
      <span className="showcase-grid" aria-hidden="true" />

      <div className="showcase-brand">
        <LogoMark size={40} />
        <span className="showcase-wordmark">SplitUp</span>
      </div>

      <div className="showcase-stage" aria-hidden="true">
        <div className="showcase-orbits">
          <span className="orbit orbit-outer" />
          <span className="orbit orbit-mid" />
          <span className="orbit orbit-inner" />
        </div>

        <div className="showcase-core">
          <LogoMark size={58} />
        </div>

        <div className="float-card float-card-a">
          <span className="float-avatar">A</span>
          <span className="float-copy">
            <span className="float-label">Arun paid</span>
            <span className="float-amount">₹1,250</span>
          </span>
        </div>

        <div className="float-card float-card-b">
          <span className="float-avatar float-avatar-b">M</span>
          <span className="float-copy">
            <span className="float-label">Meera owes</span>
            <span className="float-amount float-amount-owe">₹420</span>
          </span>
        </div>

        <span className="float-pill float-pill-a">
          <span className="float-dot" />
          Settled up
        </span>
      </div>

      <div className="showcase-copy">
        <p className="showcase-eyebrow">Shared expenses, simplified</p>
        <h2 className="showcase-title">
          Split the bill,
          <br />
          not the friendship.
        </h2>
        <p className="showcase-sub">
          Track group spending, settle in a tap, and always know exactly where everyone stands.
        </p>
        <ul className="showcase-points">
          <li>
            <span className="showcase-point-icon"><Icon name="users" size={15} /></span>
            Every balance in one clear view
          </li>
          <li>
            <span className="showcase-point-icon"><Icon name="exchange" size={15} /></span>
            Instant UPI settlements
          </li>
          <li>
            <span className="showcase-point-icon"><Icon name="chart" size={15} /></span>
            Monthly spending insights
          </li>
        </ul>
      </div>
    </section>
  )
}
