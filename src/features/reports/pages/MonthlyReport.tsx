import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import clsx from 'clsx'
import { useGroup } from '@/contexts/GroupContext'
import { useTheme } from '@/contexts/ThemeContext'
import { listCycles } from '@/services/expenses'
import { getCategoryBreakdown, CategoryTotal } from '@/services/reports'
import { getGroupBalances, getSettlementSuggestions } from '@/services/balances'
import { buildReportText, shareText, whatsappUrl } from '@/services/sharing'
import type { CycleInfo, GroupBalance, SettlementSuggestion } from '@/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatMoney, sumMoney } from '@/lib/money'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { CategoryTile, Icon } from '@/components/ui/Icon'

// Chart palette: brand ultramarine first, then distinct but harmonious hues.
// Dark mode uses a lifted set so every slice stays legible on the night surface.
const COLORS = ['#4A3AD0', '#0F8A5F', '#E0913A', '#C8462E', '#3A9BD9', '#9B5DE5', '#7A809B', '#B9AEF5']
const DARK_COLORS = ['#8F80FF', '#3FC79A', '#F0B45E', '#F08A72', '#5FB6E8', '#B98CF0', '#9AA2BF', '#C9C2FF']

export default function MonthlyReport() {
  const { activeGroup } = useGroup()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const chartColors = isDark ? DARK_COLORS : COLORS
  const axisTick = { fontSize: 12, fill: isDark ? '#9AA2BF' : '#5C6280' }
  const tooltipStyle = {
    contentStyle: {
      borderRadius: 12,
      border: `1px solid ${isDark ? '#353B58' : '#E5E7EF'}`,
      background: isDark ? '#1C2034' : '#FFFFFF',
      boxShadow: isDark
        ? '0 12px 28px -8px rgba(0,0,0,0.62)'
        : '0 10px 24px -8px rgba(22,26,46,0.18)',
      fontSize: 13,
      padding: '8px 12px'
    },
    labelStyle: { color: isDark ? '#EDF0FA' : '#161A2E', fontWeight: 600, marginBottom: 2 },
    itemStyle: { color: isDark ? '#CFD4E8' : '#33384F' },
    cursor: { fill: isDark ? 'rgba(143,128,255,0.10)' : 'rgba(74, 58, 208, 0.06)' }
  }
  const [cycles, setCycles] = useState<CycleInfo[]>([])
  const [selected, setSelected] = useState('')
  const [categories, setCategories] = useState<CategoryTotal[]>([])
  const [balances, setBalances] = useState<GroupBalance[]>([])
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([])
  const [loadingCycles, setLoadingCycles] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const currency = activeGroup?.currency ?? 'INR'

  useEffect(() => {
    if (!activeGroup) return
    listCycles(activeGroup.id)
      .then(c => { setCycles(c); setSelected(c[0]?.id ?? '') })
      .catch(err => setMessage({ ok: false, text: err.message ?? 'Could not load months.' }))
      .finally(() => setLoadingCycles(false))
  }, [activeGroup])

  useEffect(() => {
    if (!activeGroup || !selected) return
    setLoading(true)
    setMessage(null)
    Promise.all([
      getCategoryBreakdown(activeGroup.id, selected),
      getGroupBalances(activeGroup.id, selected),
      getSettlementSuggestions(activeGroup.id, selected)
    ])
      .then(([c, b, s]) => { setCategories(c); setBalances(b); setSuggestions(s) })
      .catch(err => setMessage({ ok: false, text: err.message ?? 'Unable to load the report. Check your connection and try again.' }))
      .finally(() => setLoading(false))
  }, [activeGroup, selected])

  const month = cycles.find(c => c.id === selected)
  const total = sumMoney(categories.map(c => c.total))
  const toSettle = sumMoney(suggestions.map(s => s.amount))

  const reportText = useMemo(
    () => buildReportText({
      groupName: activeGroup?.group_name ?? '',
      monthLabel: month?.label ?? '',
      currency, categories, balances, suggestions
    }),
    [activeGroup, month, currency, categories, balances, suggestions]
  )

  const onShare = async () => {
    const result = await shareText(reportText, `${month?.label ?? ''} expense report`)
    if (result === 'copied') setMessage({ ok: true, text: 'Report copied. Paste it into WhatsApp.' })
  }

  if (loadingCycles) return <div className="center-spinner"><Spinner /></div>
  if (cycles.length === 0) {
    return <EmptyState title="No reports yet" body="Reports appear once your group has some expenses." />
  }

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Monthly report</h1>
      </div>

      <select className="select mt-md report-month" aria-label="Select month" value={selected} onChange={e => setSelected(e.target.value)}>
        {cycles.map(c => <option key={c.id} value={c.id}>{c.label}{c.status === 'closed' ? ' (closed)' : ''}</option>)}
      </select>

      {message && (
        <p className={clsx('banner mt-sm', message.ok ? 'banner-ok' : 'banner-error')} role={message.ok ? 'status' : 'alert'}>{message.text}</p>
      )}

      {loading ? (
        <div className="center-spinner"><Spinner /></div>
      ) : (
        <>
          <Card className="hero-card mt-md">
            <p className="card-label">Total expenses</p>
            <p className="big-number">{formatMoney(total, currency)}</p>
          </Card>


          <h2 className="section-title">Category-wise breakdown</h2>
          <Card>
            {categories.length === 0 ? (
              <p className="muted text-sm">No expenses in this month.</p>
            ) : (
              <div className="stack-xs">
                {categories.map(c => (
                  <div key={c.category} className="category-line"><span className="cat-name"><CategoryTile icon={c.icon} size="sm" />{c.category}</span><span className="tabular fw-semibold">{formatMoney(c.total, currency)}</span></div>
                ))}
                <div className="category-line category-total"><span>Total expenses</span><span className="tabular">{formatMoney(total, currency)}</span></div>
              </div>
            )}
          </Card>

          <h2 className="section-title">Payment breakup</h2>
          <Card>
            {suggestions.length === 0 ? (
              <p className="settled-note settled-note-flush"><Icon name="checkCircle" size={20} />Everyone is settled up.</p>
            ) : (
              <div className="stack-xs">
                {suggestions.map(s => (
                  <div key={`${s.from_user}-${s.to_user}`} className="category-line">
                    <span><strong>{s.from_name}</strong> to pay <strong>{s.to_name}</strong></span>
                    <span className="tabular fw-medium text-owe">{formatMoney(s.amount, currency)}</span>
                  </div>
                ))}
                <div className="category-line category-total"><span>Total to settle</span><span className="tabular">{formatMoney(toSettle, currency)}</span></div>
              </div>
            )}
          </Card>

          <h2 className="section-title">Member summary</h2>
          <Card>
            <div className="table-scroll"><div className="report-table">
              <div className="report-row report-head">
                <span>Member</span><span>Paid</span><span>Share</span><span>Balance</span>
              </div>
              {balances.map(b => (
                <div key={b.user_id} className="report-row">
                  <span>{b.name}</span>
                  <span>{formatMoney(b.total_paid, currency)}</span>
                  <span>{formatMoney(b.total_share, currency)}</span>
                  <span className={`fw-semibold ${b.net_balance >= 0 ? 'text-receive' : 'text-owe'}`}>{formatMoney(b.net_balance, currency)}</span>
                </div>
              ))}
            </div></div>
          </Card>

          <h2 className="section-title">Share this report</h2>
          <Card>
            <p className="muted text-sm">Category totals, member summary and who pays whom, ready for WhatsApp.</p>
            <pre className="report-preview" aria-label="Report preview">{reportText}</pre>
            <div className="action-row mt-md">
              <a className="btn btn-primary" href={whatsappUrl(reportText)} target="_blank" rel="noopener noreferrer"><Icon name="message" size={18} />Share on WhatsApp</a>
              <Button variant="secondary" onClick={onShare}><Icon name="copy" size={18} />Share / copy</Button>
            </div>
          </Card>

          <div className="report-grid">
          <div>
          <h2 className="section-title">Expenses by member</h2>
          <Card>
            <div className="chart-box">
              <ResponsiveContainer>
                <BarChart data={balances.map(b => ({ name: b.name.split(' ')[0], paid: b.total_paid }))} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={isDark ? '#272C43' : '#EEF0F5'} />
                  <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(v: number) => formatMoney(v, currency)} {...tooltipStyle} />
                  <Bar dataKey="paid" fill={isDark ? '#8F80FF' : '#4A3AD0'} radius={[8, 8, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          </div>

          {categories.length > 0 && (
            <div>
              <h2 className="section-title">Expenses by category</h2>
              <Card>
                <div className="chart-box tall">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={categories} dataKey="total" nameKey="category"
                        innerRadius={52} outerRadius={88} paddingAngle={2} cornerRadius={6} stroke={isDark ? '#171A2C' : '#fff'} strokeWidth={2}
                        label={(d: any) => d.category} labelLine={false}
                      >
                        {categories.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatMoney(v, currency)} {...tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  )
}
