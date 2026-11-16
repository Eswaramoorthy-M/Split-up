import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createGroup } from '@/services/groups'
import { useGroup } from '@/contexts/GroupContext'
import { LogoMark } from '@/components/ui/Icon'

const CURRENCIES = [
  { code: 'INR', label: 'INR ₹' },
  { code: 'USD', label: 'USD $' },
  { code: 'EUR', label: 'EUR €' },
  { code: 'GBP', label: 'GBP £' }
]

export default function CreateGroup() {
  const navigate = useNavigate()
  const { refreshGroups, setActiveGroupId } = useGroup()
  const [groupName, setGroupName] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [splitMethod, setSplitMethod] = useState<'equal' | 'unequal' | 'percentage'>('equal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const group = await createGroup({ group_name: groupName, description, currency, default_split_method: splitMethod })
      await refreshGroups()
      setActiveGroupId(group.id)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message ?? 'Could not create the group. Try again.')
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
      <h1 className="page-title">Create a group</h1>
      <p className="page-sub">You'll get a code others can use to join.</p>

      <form onSubmit={onSubmit} className="stack-md mt-lg">
        <Input label="Group name" placeholder="Bangalore Friends" required value={groupName} onChange={e => setGroupName(e.target.value)} />
        <Input label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />

        <div className="field">
          <label className="field-label" htmlFor="currency">Currency</label>
          <select id="currency" className="select" value={currency} onChange={e => setCurrency(e.target.value)}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="split">Default split method</label>
          <select id="split" className="select" value={splitMethod} onChange={e => setSplitMethod(e.target.value as any)}>
            <option value="equal">Equal</option>
            <option value="unequal">Unequal amount</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>

        {error && <p className="error-text" role="alert">{error}</p>}
        <Button type="submit" fullWidth size="lg" disabled={loading}>{loading ? 'Creating…' : 'Create group'}</Button>
      </form>
    </div>
  )
}
