import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { joinGroupByCode } from '@/services/groups'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Icon, LogoMark } from '@/components/ui/Icon'

export default function GroupSelect() {
  const navigate = useNavigate()
  const { groups, loading, setActiveGroupId, refreshGroups } = useGroup()
  const { profile, signOut } = useAuth()
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onJoin = async (e: FormEvent) => {
    e.preventDefault()
    setJoining(true)
    setError(null)
    try {
      const groupId = await joinGroupByCode(code)
      await refreshGroups()
      setActiveGroupId(groupId)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Could not find that group code.')
    } finally {
      setJoining(false)
    }
  }

  if (loading) return <div className="center-screen"><Spinner size={32} /></div>

  // No groups yet: ask for a code, or offer to create one.
  if (groups.length === 0) {
    const firstName = profile?.name?.split(' ')[0]
    return (
      <div className="standalone-page">
        <div className="standalone-brand">
          <LogoMark size={32} />
          <span className="brand-word">SplitUp</span>
        </div>
        <h1 className="page-title">Welcome{firstName ? `, ${firstName}` : ''}</h1>
        <p className="page-sub">Join your friends' group with a code, or start a new one.</p>

        <form onSubmit={onJoin} className="stack-md mt-lg">
          <Input
            label="Group code" placeholder="BGF2026" required className="input-code"
            value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          />
          {error && <p className="error-text" role="alert">{error}</p>}
          <Button type="submit" fullWidth size="lg" disabled={joining}>
            {joining ? 'Joining…' : 'Join group'}
          </Button>
        </form>

        <div className="or-divider"><span>or</span></div>

        <Link to="/groups/create">
          <Button fullWidth size="lg" variant="secondary">Create a new group</Button>
        </Link>

        <div className="text-center mt-xl">
          <button className="link-btn" onClick={signOut}><Icon name="logout" size={16} />Log out</button>
        </div>
      </div>
    )
  }

  // Has groups: pick one, or join/create another.
  return (
    <div className="standalone-page">
      <div className="standalone-brand">
        <LogoMark size={32} />
        <span className="brand-word">SplitUp</span>
      </div>
      <h1 className="page-title">Your groups</h1>
      <p className="page-sub">Pick a group to see its balances.</p>

      <div className="stack-sm mt-lg">
        {groups.map(g => (
          <Link key={g.id} to="/dashboard" onClick={() => setActiveGroupId(g.id)}>
            <Card className="card-clickable group-card">
              <span className="avatar avatar-sm" aria-hidden="true">{g.group_name?.[0]?.toUpperCase()}</span>
              <div>
                <p className="fw-semibold">{g.group_name}</p>
                <p className="muted text-sm">{g.description || `Code ${g.group_code}`}</p>
              </div>
              <Icon name="chevronRight" size={18} className="chevron-end" />
            </Card>
          </Link>
        ))}
      </div>

      <div className="row mt-xl">
        <Link to="/groups/create" className="flex-1"><Button fullWidth variant="secondary"><Icon name="plus" size={18} />Create group</Button></Link>
        <Link to="/groups/join" className="flex-1"><Button fullWidth><Icon name="userPlus" size={18} />Join group</Button></Link>
      </div>
    </div>
  )
}
