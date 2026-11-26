import { useEffect, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatMoney } from '@/lib/money'
import { gsap, ScrollTrigger, useGSAP } from '../animation'
import type { CategoryView } from '../reportUtils'
import { useMediaQuery } from '../reportUtils'

interface Props {
  categories: CategoryView[]
  total: number
  currency: string
  isDark: boolean
  monthLabel: string
}

export function DonutChartCard({ categories, total, currency, isDark, monthLabel }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const centerRef = useRef<HTMLElement>(null)
  const [sweep, setSweep] = useState(1)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const compact = useMediaQuery('(max-width: 639px)')
  const ringStroke = isDark ? '#171A2C' : '#FFFFFF'
  const active = activeIndex !== null ? categories[activeIndex] : null

  useEffect(() => setActiveIndex(null), [categories])

  useGSAP(() => {
    const card = cardRef.current
    if (!card || categories.length === 0) return

    const mm = gsap.matchMedia()
    mm.add({
      motion: '(prefers-reduced-motion: no-preference)',
      reduced: '(prefers-reduced-motion: reduce)'
    }, context => {
      const { motion } = context.conditions ?? {}
      const center = centerRef.current
      const legendItems = gsap.utils.toArray<HTMLElement>(card.querySelectorAll('.donut-legend-item'))

      if (!motion) {
        setSweep(1)
        if (center) center.textContent = formatMoney(total, currency)
        if (legendItems.length) gsap.set(legendItems, { clearProps: 'all' })
        return
      }

      const proxy = { sweep: 0, amount: 0 }
      setSweep(0)
      if (center) center.textContent = formatMoney(0, currency)
      if (legendItems.length) gsap.set(legendItems, { opacity: 0, y: 10 })

      const timeline = gsap.timeline({
        scrollTrigger: { trigger: card, start: 'top 85%', once: true }
      })
      timeline.to(proxy, {
        sweep: 1,
        amount: total,
        duration: compact ? 0.7 : 1.05,
        ease: 'power2.inOut',
        onUpdate: () => {
          setSweep(proxy.sweep)
          if (center) center.textContent = formatMoney(proxy.amount, currency)
        },
        onComplete: () => {
          setSweep(1)
          if (center) center.textContent = formatMoney(total, currency)
        }
      })
      if (legendItems.length) {
        timeline.to(legendItems, {
          opacity: 1,
          y: 0,
          duration: 0.3,
          stagger: compact ? 0.04 : 0.07,
          ease: 'power2.out'
        }, '-=0.3')
      }
    })

    ScrollTrigger.refresh()
  }, { scope: cardRef, dependencies: [categories, total, currency, isDark, compact], revertOnUpdate: true })

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
    <Card className="report-card report-donut-card" data-animate>
      <div ref={cardRef}>
        <div className="report-card-head">
          <div>
            <p className="report-card-label">Where it went</p>
            <h2 className="report-card-title">Expenses by category</h2>
          </div>
          <span className="report-card-count">{monthLabel}</span>
        </div>

        {categories.length === 0 ? (
          <div className="report-empty report-empty-compact">
            <span className="report-empty-art" aria-hidden="true">🍩</span>
            <p>No categories to chart for this month.</p>
          </div>
        ) : (
          <>
            <div ref={chartRef} className="report-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categories}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={96}
                    paddingAngle={2}
                    cornerRadius={7}
                    startAngle={90}
                    endAngle={90 - 360 * sweep}
                    stroke={ringStroke}
                    strokeWidth={2}
                    isAnimationActive={false}
                    onMouseEnter={(_: unknown, index: number) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={(_: unknown, index: number) => setActiveIndex(current => current === index ? null : index)}
                  >
                    {categories.map((category, index) => (
                      <Cell
                        key={category.category}
                        fill={category.color}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.42}
                        stroke={activeIndex === index ? (isDark ? '#EDF0FA' : '#161A2E') : ringStroke}
                        strokeWidth={activeIndex === index ? 4 : 2}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="donut-center" aria-hidden="true">
                <span>Total</span>
                <strong ref={centerRef}>{formatMoney(total, currency)}</strong>
                <small>{monthLabel}</small>
              </div>

              {active && (
                <div className="donut-tooltip" role="status">
                  <span className="donut-tooltip-dot" style={{ background: active.color }} />
                  <span>{active.category}</span>
                  <strong>{formatMoney(active.total, currency)}</strong>
                </div>
              )}
            </div>

            <div className="donut-legend">
              {categories.map((category, index) => (
                <button
                  key={category.category}
                  type="button"
                  className={`donut-legend-item${activeIndex === index ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                  onClick={() => setActiveIndex(current => current === index ? null : index)}
                  aria-pressed={activeIndex === index}
                >
                  <span className="donut-dot" style={{ background: category.color }} />
                  <span className="donut-legend-name" title={category.category}>{category.category}</span>
                  <span className="donut-legend-amount">{formatMoney(category.total, currency)}</span>
                  <span className="donut-legend-percent">{Math.round(category.percent)}%</span>
                </button>
              ))}
            </div>

            <p className="report-chart-hint">
              <Icon name="info" size={14} /> Hover or tap a slice to inspect it.
            </p>
          </>
        )}
      </div>
    </Card>
  )
}
