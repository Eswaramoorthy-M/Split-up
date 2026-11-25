import { FormEvent, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { AuthLayout, AuthLayoutHandle } from '@/features/auth/components/AuthLayout'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const layoutRef = useRef<AuthLayoutHandle>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError(error)
      layoutRef.current?.shake()
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <AuthLayout ref={layoutRef}>
      <p className="login-kicker" data-reveal>Welcome back</p>
      <h1 className="login-title" data-reveal>Log in to SplitUp</h1>
      <p className="login-sub" data-reveal>See your group's balances in one glance.</p>

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
        <div data-reveal>
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text login-error" role="alert">{error}</p>}
        <div data-reveal>
          <Button type="submit" fullWidth size="lg" disabled={loading} className="login-submit">
            <span>{loading ? 'Logging in…' : 'Log in'}</span>
            {!loading && <Icon name="arrowRight" size={18} className="login-submit-arrow" />}
          </Button>
        </div>
      </form>

      <div className="login-links" data-reveal>
        <Link to="/forgot-password">Forgot password?</Link>
        <Link to="/register">Create account</Link>
      </div>
    </AuthLayout>
  )
}
