// TEMPORARY visual preview used for responsive screenshots. Remove before final.
import { useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'
import { buildReportText } from '@/services/sharing'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatMoney } from '@/lib/money'
import type { CycleInfo } from '@/types'
import { BarChartCard } from '../components/BarChartCard'
import { DonutChartCard } from '../components/DonutChartCard'
import { MonthPicker } from '../components/MonthPicker'
import { PaymentBreakupCard } from '../components/PaymentBreakupCard'
import { ShareCard } from '../components/ShareCard'
import { DARK_CHART_COLORS, LIGHT_CHART_COLORS, percentOf, type CategoryView } from '../reportUtils'

const categories: CategoryView[] = [
  { category: 'Groceries', icon: '🛒', total: 12480.5, percent: 38, color: '' },
  { category: 'Rent', icon: '🏠', total: 9200, percent: 28, color: '' },
  { category: 'Dining', icon: '🍜', total: 5210, percent: 16, color: '' },
  { category: 'Travel', icon: '🚕', total: 3980.75, percent: 12, color: '' },
  { category: 'Utilities', icon: '💡', total: 1980, percent: 6, color: '' }
]

const balances = [
  { user_id: '1', name: 'Ajeeth Kumar', profile_image: null, total_paid: 12480.5, total_share: 8420, net_balance: 4060.5 },
  { user_id: '2', name: 'Saran', profile_image: null, total_paid: 9200, total_share: 9860.25, net_balance: -660.25 },
  { user_id: '3', name: 'Divya', profile_image: null, total_paid: 5210, total_share: 7100, net_balance: -1890 },
  { user_id: '4', name: 'Prakash', profile_image: null, total_paid: 3980.75, total_share: 5491, net_balance: -1510.25 }
]

const suggestions = [
  { from_user: '2', from_name: 'Saran', to_user: '1', to_name: 'Ajeeth Kumar', amount: 660.25 },
  { from_user: '3', from_name: 'Divya', to_user: '1', to_name: 'Ajeeth Kumar', amount: 1890 },
  { from_user: '4', from_name: 'Prakash', to_user: '1', to_name: 'Ajeeth Kumar', amount: 1510.25 }
]

const cycles: CycleInfo[] = [
  { id: 'nov', year: 2026, month: 11, status: 'open', label: 'November 2026' },
  { id: 'oct', year: 2026, month: 10, status: 'closed', label: 'October 2026' },
  { id: 'sep', year: 2026, month: 9, status: 'closed', label: 'September 2026' },
  { id: 'aug', year: 2026, month: 8, status: 'closed', label: 'August 2026' }
]

export default function ReportPreview() {
  const { theme } = useTheme()
  const [selected, setSelected] = useState('nov')
  const isDark = theme === 'dark'
  const palette = isDark ? DARK_CHART_COLORS : LIGHT_CHART_COLORS
  const total = 32851.25
  const toSettle = 4060.5
  const monthLabel = cycles.find(cycle => cycle.id === selected)?.label ?? 'November 2026'
  const views = categories.map((category, index) => ({
    ...category,
    percent: percentOf(category.total, total),
    color: palette[index % palette.length]
  }))
  const reportText = buildReportText({
    groupName: 'Weekend Crew', monthLabel, currency: 'INR', categories, balances, suggestions
  })

  return (
    <div className="report-page">
      <header className="report-header">
        <div className="report-header-inner">
          <div className="report-heading">
            <p className="report-eyebrow">Insights</p>
            <h1 className="report-title">Monthly report</h1>
          </div>
          <MonthPicker cycles={cycles} value={selected} onChange={setSelected} />
        </div>
      </header>

      <div className="report-layout">
        <Card className="report-card report-hero" data-animate data-hero>
          <span className="hero-glow hero-glow-a" />
          <span className="hero-glow hero-glow-b" />
          <div className="hero-content">
            <div className="hero-topline">
              <span className="hero-label">Total expenses</span>
              <span className="hero-chip"><Icon name="chart" size={14} />{monthLabel}</span>
            </div>
            <p className="hero-amount">{formatMoney(total, 'INR')}</p>
            <p className="hero-meta">Across <strong>5</strong> categories · Weekend Crew</p>
          </div>
        </Card>

        <DonutChartCard categories={views} total={total} currency="INR" isDark={isDark} monthLabel={monthLabel} />
        <PaymentBreakupCard suggestions={suggestions} total={toSettle} currency="INR" isDark={isDark} />
        <BarChartCard balances={balances} currency="INR" isDark={isDark} monthLabel={monthLabel} />
        <ShareCard reportText={reportText} monthLabel={monthLabel} onShare={async () => 'copied'} />
      </div>
    </div>
  )
}
