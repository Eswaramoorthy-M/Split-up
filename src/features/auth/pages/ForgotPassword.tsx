import { FormEvent, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { AuthLayout, AuthLayoutHandle } from '@/features/auth/components/AuthLayout'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const layoutRef = useRef<AuthLayoutHandle>(null)
  const successRef = useRef<HTMLDivElement>(null)

  // Pop the confirmation state in after a successful send.
  useLayoutEffect(() => {
    if (!sent || !successRef.current || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      // Animate each row individually. A shared stagger tween can leave a
      // router <Link> stuck at its start opacity, so keep the tweens separate
      // and clear the inline styles once they finish.
      gsap.utils.toArray<HTMLElement>('.reset-success > *').forEach((item, index) => {
        gsap.from(item, {
          y: 14,
          opacity: 0,
          duration: 0.45,
          delay: index * 0.07,
          ease: 'power3.out',
          clearProps: 'opacity,transform'
        })
      })
      gsap.from('.reset-note-icon .icon', {
        scale: 0.5,
        rotate: -12,
        duration: 0.5,
        ease: 'back.out(1.8)'
      })
    }, successRef)

    return () => ctx.revert()
  }, [sent])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) {
      setError(error)
      layoutRef.current?.shake()
    } else {
      setSent(true)
    }
  }

  return (
    <AuthLayout
      ref={layoutRef}
      footnote={<><Icon name="lock" size={13} /> Secure reset · Your email is never shared</>}
    >
      {sent ? (
        <div className="reset-success" ref={successRef}>
          <p className="login-kicker">Link sent</p>
          <h1 className="login-title">Check your inbox</h1>
          <p className="login-sub">
            We sent a password reset link to <strong className="reset-email">{email}</strong>.
          </p>

          <div className="reset-note">
            <span className="reset-note-icon"><Icon name="inbox" size={22} /></span>
            <div>
              <p className="reset-note-title">Open the link to set a new password.</p>
              <p className="reset-note-body">It expires shortly for your security. Check your spam folder if it doesn't arrive.</p>
            </div>
          </div>

          <Link to="/login" className="btn btn-primary btn-lg btn-block reset-primary">Back to login</Link>
          <button
            type="button"
            className="link-btn reset-retry"
            onClick={() => { setSent(false); setError(null) }}
          >
            Use a different email
          </button>
        </div>
      ) : (
        <>
          <p className="login-kicker" data-reveal>Account recovery</p>
          <h1 className="login-title" data-reveal>Reset your password</h1>
          <p className="login-sub" data-reveal>Enter the email linked to your account and we'll send a secure reset link.</p>

          <form onSubmit={onSubmit} className="stack-md login-form">
            <div data-reveal>
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            {error && <p className="error-text login-error" role="alert">{error}</p>}
            <div data-reveal>
              <Button type="submit" fullWidth size="lg" disabled={loading} className="login-submit">
                <span>{loading ? 'Sending…' : 'Send reset link'}</span>
                {!loading && <Icon name="arrowRight" size={18} className="login-submit-arrow" />}
              </Button>
            </div>
          </form>

          <div className="login-links" data-reveal>
            <Link to="/login">Back to login</Link>
            <Link to="/register">Create account</Link>
          </div>
        </>
      )}
    </AuthLayout>
  )
}
