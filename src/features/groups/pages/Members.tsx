import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { listMembers, setMemberRole, removeMember } from '@/services/groups'
import { getGroupBalances } from '@/services/balances'
import type { GroupMember, GroupBalance } from '@/types'
import { Card } from '@/components/ui/Card'
import { balanceLabel } from '@/lib/money'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { confirmDialog } from '@/components/ui/ConfirmDialog'
import { AddMemberModal } from '../components/AddMemberModal'

export default function Members() {
  const { activeGroup, activeMembership } = useGroup()
  const { user } = useAuth()
  const [members, setMembers] = useState<GroupMember[]>([])
  const [balances, setBalances] = useState<Record<string, GroupBalance>>({})
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const isAdmin = activeMembership?.role === 'admin'

  useEffect(() => {
    if (!activeGroup) return
    Promise.all([listMembers(activeGroup.id), getGroupBalances(activeGroup.id)]).then(([m, b]) => {
      setMembers(m)
      setBalances(Object.fromEntries(b.map(x => [x.user_id, x])))
      setLoading(false)
    })
  }, [activeGroup])

  if (loading) return <div className="center-spinner"><Spinner /></div>

  const stateClass = (s: string) => (s === 'receive' ? 'text-receive' : s === 'owe' ? 'text-owe' : 'faint')

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Members</h1>
          <p className="page-sub">{members.length} people in {activeGroup?.group_name}</p>
        </div>
        {isAdmin && <Button onClick={() => setAdding(true)}><Icon name="userPlus" size={18} />Add member</Button>}
      </div>

      <div className="stack-sm mt-lg">
        {members.map(m => {
          const bal = balances[m.user_id]
          const label = bal ? balanceLabel(bal.net_balance, activeGroup?.currency) : null
          return (
            <Card key={m.id} className="card-row member-card">
              <Link to={`/members/${m.user_id}`} className="member-info">
                <span className="avatar avatar-sm" aria-hidden="true">{m.profile?.name?.[0]?.toUpperCase()}</span>
                <div>
                  <p className="member-name">
                    <span>{m.profile?.name} {m.user_id === user?.id && <span className="faint">(you)</span>}</span>
                    <span className={m.role === 'admin' ? 'badge badge-brand' : 'badge'}>{m.role}</span>
                  </p>
                  {label && <p className={`text-sm fw-medium mt-xs ${stateClass(label.state)}`}>{label.text}</p>}
                </div>
              </Link>
              {isAdmin && m.user_id !== user?.id && (
                <div className="member-actions">
                  <button
                    className="link-btn"
                    onClick={async () => { await setMemberRole(m.id, m.role === 'admin' ? 'member' : 'admin'); setMembers(await listMembers(activeGroup!.id)) }}
                  >
                    {m.role === 'admin' ? 'Make member' : 'Make admin'}
                  </button>
                  <button
                    className="link-btn-danger"
                    onClick={async () => {
                      const confirmed = await confirmDialog({
                        title: `Remove ${m.profile?.name}?`,
                        message: 'They will lose access to this group. Their past expenses stay in the records.',
                        confirmLabel: 'Remove member',
                        tone: 'danger'
                      })
                      if (!confirmed) return
                      await removeMember(m.id)
                      setMembers(await listMembers(activeGroup!.id))
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {adding && activeGroup && (
        <AddMemberModal
          groupId={activeGroup.id}
          groupName={activeGroup.group_name}
          onClose={() => setAdding(false)}
          onAdded={async () => {
            const [m, b] = await Promise.all([listMembers(activeGroup.id), getGroupBalances(activeGroup.id)])
            setMembers(m)
            setBalances(Object.fromEntries(b.map(x => [x.user_id, x])))
          }}
        />
      )}
    </div>
  )
}
