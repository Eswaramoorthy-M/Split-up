import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { LogoMark } from '@/components/ui/Icon'
import { ThemeToggle } from '@/components/ui/ThemeToggle'

// Opened from the link in the password-reset email. Supabase signs the person
// in with a temporary recovery session so they can choose a new password.
export default function ResetPassword() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) setError(error.message)
    else navigate('/dashboard', { replace: true })
  }

  if (loading) return <div className="center-screen"><Spinner size={32} /></div>

  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-theme"><ThemeToggle /></div>
        <div className="auth-box">
          <div className="auth-brand">
            <LogoMark size={34} />
            <span className="brand-word">SplitUp</span>
          </div>
          <div className="auth-card">
            <h1 className="auth-title">Link expired</h1>
            <p className="muted mt-xs">This reset link is invalid or has expired. Request a new one.</p>
            <p className="auth-footer"><Link to="/forgot-password">Send a new link</Link></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-theme"><ThemeToggle /></div>
      <div className="auth-box">
        <div className="auth-brand">
          <LogoMark size={34} />
          <span className="brand-word">SplitUp</span>
        </div>
        <div className="auth-card">
        <h1 className="auth-title">Choose a new password</h1>
        <form onSubmit={onSubmit} className="stack-md auth-form">
          <Input label="New password" type="password" autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} />
          <Input label="Confirm password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />
          {error && <p className="error-text" role="alert">{error}</p>}
          <Button type="submit" fullWidth size="lg" disabled={saving}>{saving ? 'Saving…' : 'Save password'}</Button>
        </form>
        </div>
      </div>
    </div>
  )
}
