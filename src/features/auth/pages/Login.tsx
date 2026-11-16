import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LogoMark } from '@/components/ui/Icon'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError(error)
    else navigate('/dashboard')
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-brand">
          <LogoMark size={34} />
          <span className="brand-word">SplitUp</span>
        </div>
        <div className="auth-card">
        <h1 className="auth-title">Welcome back</h1>
        <p className="muted mt-xs">Log in to see your group's balances.</p>

        <form onSubmit={onSubmit} className="stack-md auth-form">
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="error-text" role="alert">{error}</p>}
          <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'Logging in…' : 'Log in'}</Button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create account</Link>
        </div>
        </div>
      </div>
    </div>
  )
}
