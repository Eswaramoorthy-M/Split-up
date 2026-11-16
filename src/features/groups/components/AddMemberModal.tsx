import { FormEvent, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { addMemberByAdmin, AddMemberResult } from '@/services/groups'
import { shareText, whatsappUrl } from '@/services/sharing'
import { generatePassword } from '@/lib/password'
import { Icon } from '@/components/ui/Icon'

interface Props {
  groupId: string
  groupName: string
  onClose: () => void
  onAdded: () => void
}

interface Added { name: string; email: string; password: string; created: boolean }

export function AddMemberModal({ groupId, groupName, onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(() => generatePassword())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<Added | null>(null)
  const [copied, setCopied] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSaving(true)
    try {
      const res: AddMemberResult = await addMemberByAdmin({ group_id: groupId, name: name.trim(), email: email.trim(), password })
      setAdded({ name: name.trim(), email: email.trim().toLowerCase(), password, created: res.created })
      onAdded()
    } catch (err: any) {
      setError(err.message ?? 'Could not add the member. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const loginMessage = (a: Added) =>
    a.created
      ? `Hi ${a.name}! You have been added to "${groupName}" on Expense Tracker.\n\nOpen: ${window.location.origin}\nEmail: ${a.email}\nPassword: ${a.password}\n\nPlease change your password after you log in (Profile > Change password).`
      : `Hi ${a.name}! You have been added to "${groupName}" on Expense Tracker.\n\nOpen: ${window.location.origin}\nLog in with your existing account: ${a.email}`

  const again = () => {
    setAdded(null); setName(''); setEmail(''); setPassword(generatePassword()); setCopied(false)
  }

  if (added) {
    const text = loginMessage(added)
    return (
      <Modal open title="Member added" onClose={onClose}>
        <p className="banner banner-ok" role="status">
          <Icon name="checkCircle" size={18} />
          <span className="flex-1">
          {added.created
            ? `${added.name} can log in now.`
            : `${added.name} already had an account, so they were added to the group. Their password was not changed.`}
          </span>
        </p>

        <pre className="cred-box">{text}</pre>

        <div className="action-row mt-md">
          <a className="btn btn-primary" href={whatsappUrl(text)} target="_blank" rel="noopener noreferrer"><Icon name="message" size={18} />WhatsApp</a>
          <Button variant="secondary" className="flex-1" onClick={async () => { if ((await shareText(text, 'Expense Tracker login')) === 'copied') setCopied(true) }}>
            {copied ? <><Icon name="check" size={18} />Copied</> : <><Icon name="share" size={18} />Share / copy</>}
          </Button>
        </div>
        <div className="row mt-sm">
          <Button variant="ghost" className="flex-1" onClick={again}>Add another</Button>
          <Button className="flex-1" onClick={onClose}>Done</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open title="Add a member" onClose={onClose}>
      <p className="muted text-sm">
        Create a login for someone and add them to <strong>{groupName}</strong>. Share the email and password with them.
      </p>

      <form onSubmit={onSubmit} className="stack-md mt-md">
        <Input label="Name" required autoFocus value={name} onChange={e => setName(e.target.value)} />
        <Input label="Email" type="email" required autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} />
        <div className="field">
          <label className="field-label" htmlFor="member-password">Password</label>
          <div className="row">
            <Input
              id="member-password" type="password" autoComplete="off" required minLength={8}
              value={password} onChange={e => setPassword(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={() => setPassword(generatePassword())}><Icon name="refresh" size={17} />New</Button>
          </div>
          <p className="field-hint">At least 8 characters. You will see it once more after saving so you can share it.</p>
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="row">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Adding…' : 'Add member'}</Button>
        </div>
      </form>
    </Modal>
  )
}
