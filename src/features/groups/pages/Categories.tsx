import { FormEvent, useEffect, useState } from 'react'
import { useGroup } from '@/contexts/GroupContext'
import { listCategories, createCategory } from '@/services/groups'
import type { Category } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CategoryTile, Icon } from '@/components/ui/Icon'

export default function Categories() {
  const { activeGroup, activeMembership } = useGroup()
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🧾')
  const isAdmin = activeMembership?.role === 'admin'

  useEffect(() => { if (activeGroup) listCategories(activeGroup.id).then(setCategories) }, [activeGroup])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!activeGroup || !name.trim()) return
    await createCategory(activeGroup.id, name.trim(), icon)
    setName(''); setIcon('🧾')
    setCategories(await listCategories(activeGroup.id))
  }

  return (
    <div>
      <h1 className="page-title">Categories</h1>
      <Card className="list-card mt-lg">
        {categories.map(c => (
          <div key={c.id} className="list-row">
            <span className="category-row"><CategoryTile icon={c.icon} size="sm" />{c.name}</span>
            {c.is_default && <span className="badge">Default</span>}
          </div>
        ))}
      </Card>

      {isAdmin && (
        <form onSubmit={onSubmit} className="inline-form">
          <div className="icon-field"><Input label="Icon" value={icon} onChange={e => setIcon(e.target.value)} /></div>
          <div className="flex-1"><Input label="Custom category" value={name} onChange={e => setName(e.target.value)} /></div>
          <Button type="submit"><Icon name="plus" size={18} />Add</Button>
        </form>
      )}
    </div>
  )
}
