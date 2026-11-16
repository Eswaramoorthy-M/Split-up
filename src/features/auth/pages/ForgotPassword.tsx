import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon, LogoMark } from '@/components/ui/Icon'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) setError(error)
    else setSent(true)
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-brand">
          <LogoMark size={34} />
          <span className="brand-word">SplitUp</span>
        </div>
        <div className="auth-card">
        <h1 className="auth-title">Reset password</h1>
        <p className="muted mt-xs">We'll email you a link to set a new one.</p>

        {sent ? (
          <p className="notice-success" role="status"><Icon name="checkCircle" size={20} />Check {email} for a reset link.</p>
        ) : (
          <form onSubmit={onSubmit} className="stack-md auth-form">
            <Input label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            {error && <p className="error-text" role="alert">{error}</p>}
            <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</Button>
          </form>
        )}

        <p className="auth-footer"><Link to="/login">Back to login</Link></p>
        </div>
      </div>
    </div>
  )
}
