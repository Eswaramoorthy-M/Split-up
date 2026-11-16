import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon, LogoMark } from '@/components/ui/Icon'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    const { error } = await signUp(email, password, name)
    setLoading(false)
    if (error) setError(error)
    else setDone(true)
  }

  if (done) {
    return (
      <div className="auth-page auth-done">
        <div className="auth-card">
          <span className="done-icon" aria-hidden="true"><Icon name="message" size={26} /></span>
          <h1 className="page-title">Check your email</h1>
          <p className="muted mt-sm">We sent a confirmation link to {email}. Confirm it, then log in.</p>
          <Button className="mt-lg" fullWidth size="lg" onClick={() => navigate('/login')}>Go to login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-brand">
          <LogoMark size={34} />
          <span className="brand-word">SplitUp</span>
        </div>
        <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="muted mt-xs">Track shared expenses without the WhatsApp math.</p>

        <form onSubmit={onSubmit} className="stack-md auth-form">
          <Input label="Name" required value={name} onChange={e => setName(e.target.value)} />
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          <Input label="Password" type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} />
          {error && <p className="error-text" role="alert">{error}</p>}
          <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'Creating account…' : 'Create account'}</Button>
        </form>

        <p className="auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
        </div>
      </div>
    </div>
  )
}
