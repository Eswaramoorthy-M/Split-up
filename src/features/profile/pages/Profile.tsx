import { FormEvent, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { isValidUpiId, normalizeUpiId } from '@/lib/upi'

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [mobile, setMobile] = useState(profile?.mobile ?? '')
  const [upiId, setUpiId] = useState(profile?.upi_id ?? '')
  const [upiError, setUpiError] = useState('')
  const [profileMessage, setProfileMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile) return

    // Validate before saving so a malformed UPI ID never reaches the database,
    // where it would fail silently inside the user's UPI app later.
    const normalizedUpi = normalizeUpiId(upiId)
    if (normalizedUpi && !isValidUpiId(normalizedUpi)) {
      setUpiError('Enter a valid UPI ID, like name@okhdfcbank or 9876543210@ybl.')
      return
    }
    setUpiError('')
    setProfileMessage(null)
    setSaving(true)

    const { error } = await supabase.from('profiles').update({
      name: name.trim(),
      mobile: mobile.trim() || null,
      upi_id: normalizedUpi || null
    }).eq('id', profile.id)

    if (error) {
      setSaving(false)
      setProfileMessage({ ok: false, text: error.message })
      return
    }

    setUpiId(normalizedUpi)
    await refreshProfile()
    setSaving(false)
    setProfileMessage({ ok: true, text: 'Profile saved.' })
  }

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwMessage(null)
    if (newPassword.length < 8) { setPwMessage({ ok: false, text: 'Password must be at least 8 characters.' }); return }
    if (newPassword !== confirmPassword) { setPwMessage({ ok: false, text: 'The two passwords do not match.' }); return }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (error) { setPwMessage({ ok: false, text: error.message }); return }
    setNewPassword(''); setConfirmPassword('')
    setPwMessage({ ok: true, text: 'Password changed.' })
  }

  return (
    <div>
      <h1 className="page-title">Profile</h1>
      <Card className="mt-lg profile-header profile-card">
        <div className="avatar">{profile?.name?.[0]?.toUpperCase()}</div>
        <div>
          <p className="fw-semibold">{profile?.name}</p>
          <p className="muted text-sm">{profile?.email}</p>
        </div>
      </Card>

      <h2 className="section-title">Personal details</h2>
      <Card>
      <form onSubmit={onSubmit} className="stack-md">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} />
        <Input label="Mobile number" value={mobile} onChange={e => setMobile(e.target.value)} />
        <div>
          <Input
            label="UPI ID"
            value={upiId}
            onChange={e => { setUpiId(e.target.value); if (upiError) setUpiError('') }}
            error={upiError || undefined}
            placeholder="name@okhdfcbank"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <p className="field-hint">
            Optional. Group members use this to pay you directly from their UPI app.
            Money moves bank-to-bank — SplitUp never touches it. Leave blank to remove it.
          </p>
        </div>
        {profileMessage && (
          <p className={profileMessage.ok ? 'banner banner-ok' : 'error-text'} role={profileMessage.ok ? 'status' : 'alert'}>
            {profileMessage.text}
          </p>
        )}
        <div><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
      </form>
      </Card>

      <h2 className="section-title">Change password</h2>
      <Card>
      <form onSubmit={onChangePassword} className="stack-md">
        <Input label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        {pwMessage && <p className={pwMessage.ok ? 'banner banner-ok' : 'error-text'} role={pwMessage.ok ? 'status' : 'alert'}>{pwMessage.text}</p>}
        <div><Button type="submit" variant="secondary" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Change password'}</Button></div>
      </form>
      </Card>

      <Button variant="danger" className="mt-xl" onClick={signOut}><Icon name="logout" size={17} />Log out</Button>
    </div>
  )
}
