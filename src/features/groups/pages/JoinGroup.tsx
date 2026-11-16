import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { joinGroupByCode } from '@/services/groups'
import { useGroup } from '@/contexts/GroupContext'
import { LogoMark } from '@/components/ui/Icon'

export default function JoinGroup() {
  const navigate = useNavigate()
  const { refreshGroups, setActiveGroupId } = useGroup()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const groupId = await joinGroupByCode(code)
      await refreshGroups()
      setActiveGroupId(groupId)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Could not find that group code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="standalone-page">
      <div className="standalone-brand">
        <LogoMark size={32} />
        <span className="brand-word">SplitUp</span>
      </div>
      <h1 className="page-title">Join a group</h1>
      <p className="page-sub">Enter the code someone shared with you.</p>

      <form onSubmit={onSubmit} className="stack-md mt-lg">
        <Input label="Group code" placeholder="BGF2026" required className="input-code" value={code} onChange={e => setCode(e.target.value.toUpperCase())} />
        {error && <p className="error-text" role="alert">{error}</p>}
        <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'Joining…' : 'Join group'}</Button>
      </form>
    </div>
  )
}
