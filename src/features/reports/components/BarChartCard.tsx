import { useEffect, useId, useRef } from 'react'
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatMoney } from '@/lib/money'
import type { GroupBalance } from '@/types'
import { gsap, ScrollTrigger, useGSAP } from '../animation'
import { compactMoney, DARK_CHART_COLORS, shortName, useMediaQuery } from '../reportUtils'

interface Props {
  balances: GroupBalance[]
  currency: string
  isDark: boolean
  monthLabel: string
}

interface LabelProps {
  x?: number
  y?: number
  width?: number
  height?: number
  value?: number | string
}

export function BarChartCard({ balances, currency, isDark, monthLabel }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const compact = useMediaQuery('(max-width: 479px)')
  const gradientId = `report-bar-${useId().replace(/:/g, '')}`
  const accent = isDark ? DARK_CHART_COLORS[0] : '#4A3AD0'
  const gridLine = isDark ? '#2C314A' : '#EBEDF4'
  const tickColor = isDark ? '#9AA2BF' : '#5C6280'
  const data = balances.map(balance => ({
    name: shortName(balance.name),
    paid: balance.total_paid
  }))

  const renderLabel = ({ x = 0, y = 0, width = 0, height = 0, value }: LabelProps) => (
    <text
      className="report-bar-label"
      x={compact ? x + width + 8 : x + width / 2}
      y={compact ? y + height / 2 : y - 8}
      fill={tickColor}
      fontSize={11}
      fontWeight={600}
      textAnchor={compact ? 'start' : 'middle'}
      dominantBaseline={compact ? 'middle' : 'auto'}
    >
      {compactMoney(Number(value ?? 0), currency)}
    </text>
  )

  useGSAP(() => {
    const card = cardRef.current
    if (!card || data.length === 0) return

    const mm = gsap.matchMedia()
    mm.add({
      motion: '(prefers-reduced-motion: no-preference)',
      reduced: '(prefers-reduced-motion: reduce)'
    }, context => {
      const { motion } = context.conditions ?? {}
      const bars = gsap.utils.toArray<SVGElement>(
        card.querySelectorAll('.recharts-bar-rectangle path, .recharts-bar-rectangle rect')
      )
      const labels = gsap.utils.toArray<SVGElement>(card.querySelectorAll('.report-bar-label'))

      if (!motion) {
        if (bars.length || labels.length) gsap.set([...bars, ...labels], { clearProps: 'all' })
        return
      }
      if (bars.length === 0) return

      gsap.set(bars, {
        opacity: 0,
        transformOrigin: compact ? 'left center' : 'center bottom',
        scaleX: compact ? 0 : 1,
        scaleY: compact ? 1 : 0
      })
      gsap.set(labels, { opacity: 0, x: compact ? -8 : 0, y: compact ? 0 : 8 })

      const timeline = gsap.timeline({
        scrollTrigger: { trigger: card, start: 'top 85%', once: true }
      })
      timeline.to(bars, {
        opacity: 1,
        scaleX: 1,
        scaleY: 1,
        duration: compact ? 0.55 : 0.75,
        stagger: compact ? 0.05 : 0.09,
        ease: 'back.out(1.4)'
      })
      if (labels.length) {
        timeline.to(labels, {
          opacity: 1,
          x: 0,
          y: 0,
          duration: 0.28,
          stagger: 0.05,
          ease: 'power2.out'
        }, '-=0.2')
      }
    })

    ScrollTrigger.refresh()
  }, { scope: cardRef, dependencies: [balances, currency, isDark, compact], revertOnUpdate: true })

  useEffect(() => {
    const node = chartRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => ScrollTrigger.refresh())
    })
    observer.observe(node)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <Card className="report-card report-bar-card" data-animate>
      <div ref={cardRef}>
        <div className="report-card-head">
          <div>
            <p className="report-card-label">Who spent what</p>
            <h2 className="report-card-title">Expenses by member</h2>
          </div>
          <span className="report-card-count">{monthLabel}</span>
        </div>

        {data.length === 0 ? (
          <div className="report-empty report-empty-compact">
            <span className="report-empty-art" aria-hidden="true">📊</span>
            <p>No member activity for this month yet.</p>
          </div>
        ) : (
          <>
            <div ref={chartRef} className={`report-chart${compact ? ' is-horizontal' : ''}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  layout={compact ? 'vertical' : 'horizontal'}
                  margin={compact ? { top: 4, right: 44, bottom: 0, left: 0 } : { top: 18, right: 4, left: -12, bottom: 0 }}
                  barCategoryGap={compact ? '28%' : '32%'}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2={compact ? '1' : '0'} y2={compact ? '0' : '1'}>
                      <stop offset="0%" stopColor={accent} stopOpacity={1} />
                      <stop offset="100%" stopColor={accent} stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={compact}
                    horizontal={!compact}
                    stroke={gridLine}
                    strokeDasharray="3 6"
                  />
                  {compact ? (
                    <>
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: tickColor }}
                        tickFormatter={value => compactMoney(Number(value), currency)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={72}
                        tick={{ fontSize: 11, fill: tickColor }}
                        axisLine={false}
                        tickLine={false}
                      />
                    </>
                  ) : (
                    <>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: tickColor }}
                        axisLine={false}
                        tickLine={false}
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: tickColor }}
                        tickFormatter={value => compactMoney(Number(value), currency)}
                        width={58}
                        axisLine={false}
                        tickLine={false}
                      />
                    </>
                  )}
                  <Tooltip
                    formatter={(value: number) => formatMoney(value, currency)}
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${isDark ? '#353B58' : '#E5E7EF'}`,
                      background: isDark ? '#1C2034' : '#FFFFFF',
                      boxShadow: isDark ? '0 12px 28px -8px rgba(0,0,0,0.62)' : '0 10px 24px -8px rgba(22,26,46,0.18)',
                      fontSize: 12,
                      padding: '8px 10px'
                    }}
                    labelStyle={{ color: isDark ? '#EDF0FA' : '#161A2E', fontWeight: 600 }}
                    itemStyle={{ color: isDark ? '#CFD4E8' : '#33384F' }}
                    cursor={{ fill: isDark ? 'rgba(143,128,255,0.10)' : 'rgba(74,58,208,0.06)' }}
                  />
                  <Bar dataKey="paid" fill={`url(#${gradientId})`} radius={compact ? [0, 8, 8, 0] : [8, 8, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                    <LabelList dataKey="paid" content={renderLabel as never} position={compact ? 'right' : 'top'} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="report-mini-summary" aria-label="Member balance summary">
              {balances.map(balance => (
                <div key={balance.user_id} className="report-mini-row">
                  <span className="report-mini-name" title={balance.name}>{balance.name}</span>
                  <span className="report-mini-detail">
                    paid {formatMoney(balance.total_paid, currency)} · share {formatMoney(balance.total_share, currency)}
                  </span>
                  <span className={`report-mini-balance ${balance.net_balance >= 0 ? 'positive' : 'negative'}`}>
                    {formatMoney(balance.net_balance, currency)}
                  </span>
                </div>
              ))}
            </div>

            <p className="report-chart-hint">
              <Icon name="info" size={14} /> Tap a bar for the exact amount.
            </p>
          </>
        )}
      </div>
    </Card>
  )
}
