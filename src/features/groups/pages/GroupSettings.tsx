import { useEffect, useState } from 'react'
import { useGroup } from '@/contexts/GroupContext'
import { supabase } from '@/lib/supabase'
import { listCycles } from '@/services/expenses'
import type { CycleInfo } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { alertDialog } from '@/components/ui/ConfirmDialog'

export default function GroupSettings() {
  const { activeGroup, activeMembership, refreshGroups } = useGroup()
  const [name, setName] = useState(activeGroup?.group_name ?? '')
  const [description, setDescription] = useState(activeGroup?.description ?? '')
  const [cycles, setCycles] = useState<CycleInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const isAdmin = activeMembership?.role === 'admin'

  useEffect(() => {
    if (!activeGroup) return
    setName(activeGroup.group_name); setDescription(activeGroup.description ?? '')
    listCycles(activeGroup.id).then(setCycles).catch(() => setCycles([]))
  }, [activeGroup])

  const save = async () => {
    if (!activeGroup) return
    await supabase.from('groups').update({ group_name: name, description }).eq('id', activeGroup.id)
    await refreshGroups()
  }

  const toggleCycle = async (c: CycleInfo) => {
    setError(null)
    const { error } = await supabase.rpc(c.status === 'open' ? 'close_month' : 'reopen_month', { p_cycle_id: c.id })
    if (error) { setError(error.message); return }
    setCycles(prev => prev.map(x => (x.id === c.id ? { ...x, status: c.status === 'open' ? 'closed' : 'open' } : x)))
  }

  return (
    <div>
      <h1 className="page-title">Group settings</h1>

      <Card className="invite-card mt-lg">
        <div>
          <p className="card-label">Invite code</p>
          <p className="invite-code">{activeGroup?.group_code}</p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(activeGroup?.group_code ?? '')
              await alertDialog({
                title: 'Code copied',
                message: 'The invite code is on your clipboard. Share it with people you want in this group.',
                tone: 'success'
              })
            } catch {
              await alertDialog({
                title: 'Could not copy',
                message: 'Select the invite code above and copy it manually.',
                tone: 'warning'
              })
            }
          }}
        >
          <Icon name="copy" size={17} />Copy code
        </Button>
      </Card>

      <Card className="stack-md mt-md">
        <Input label="Group name" value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin} />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} disabled={!isAdmin} />
        {isAdmin && <div><Button onClick={save}>Save</Button></div>}
      </Card>

      {isAdmin && (
        <>
          <h2 className="section-title">Monthly cycles</h2>
          {error && <p className="error-text mb-sm" role="alert">{error}</p>}
          <Card className="list-card">
            {cycles.map(c => (
              <div key={c.id} className="list-row">
                <span className="row">
                  <span className="fw-medium">{c.label}</span>
                  {c.status === 'closed' && <span className="badge badge-locked"><Icon name="lock" size={12} strokeWidth={2.2} />Closed</span>}
                </span>
                <Button variant="secondary" className="btn-sm" onClick={() => toggleCycle(c)}>
                  {c.status === 'open' ? 'Close month' : 'Reopen month'}
                </Button>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}
