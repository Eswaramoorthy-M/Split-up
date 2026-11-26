import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { useGroup } from '@/contexts/GroupContext'
import { useTheme } from '@/contexts/ThemeContext'
import { listCycles } from '@/services/expenses'
import { getCategoryBreakdown, CategoryTotal } from '@/services/reports'
import { getGroupBalances, getSettlementSuggestions } from '@/services/balances'
import { buildReportText, shareText } from '@/services/sharing'
import type { CycleInfo, GroupBalance, SettlementSuggestion } from '@/types'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { formatMoney, sumMoney } from '@/lib/money'
import { gsap, ScrollTrigger, useGSAP } from '../animation'
import { BarChartCard } from '../components/BarChartCard'
import { DonutChartCard } from '../components/DonutChartCard'
import { MonthPicker } from '../components/MonthPicker'
import { PaymentBreakupCard } from '../components/PaymentBreakupCard'
import { ReportSkeleton } from '../components/ReportSkeleton'
import { ShareCard } from '../components/ShareCard'
import {
  DARK_CHART_COLORS, LIGHT_CHART_COLORS, percentOf, type CategoryView
} from '../reportUtils'

/** One count-up tween with a proxy object; money stays formatted every frame. */
function countTo(element: HTMLElement, duration: number) {
  const target = Number(element.dataset.countValue ?? 0)
  const currency = element.dataset.countCurrency ?? 'INR'
  const proxy = { value: 0 }
  element.textContent = formatMoney(0, currency)
  return gsap.to(proxy, {
    value: target,
    duration,
    ease: 'power2.out',
    snap: { value: 0.01 },
    onUpdate: () => { element.textContent = formatMoney(proxy.value, currency) },
    onComplete: () => { element.textContent = formatMoney(target, currency) }
  })
}

function settleCounts(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-count-value]').forEach(element => {
    element.textContent = formatMoney(
      Number(element.dataset.countValue ?? 0),
      element.dataset.countCurrency ?? 'INR'
    )
  })
}

export default function MonthlyReport() {
  const { activeGroup } = useGroup()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const chartColors = isDark ? DARK_CHART_COLORS : LIGHT_CHART_COLORS

  const [cycles, setCycles] = useState<CycleInfo[]>([])
  const [selected, setSelected] = useState('')
  const [categories, setCategories] = useState<CategoryTotal[]>([])
  const [balances, setBalances] = useState<GroupBalance[]>([])
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([])
  const [loadingCycles, setLoadingCycles] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const currency = activeGroup?.currency ?? 'INR'
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

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

  const categoryViews = useMemo<CategoryView[]>(
    () => categories.map((category, index) => ({
      ...category,
      percent: percentOf(category.total, total),
      color: chartColors[index % chartColors.length]
    })),
    [categories, total, chartColors]
  )

  const { contextSafe } = useGSAP(() => {
    const root = rootRef.current
    if (!root) return

    const mm = gsap.matchMedia()
    mm.add({
      motion: '(prefers-reduced-motion: no-preference)',
      hover: '(hover: hover) and (min-width: 1024px)'
    }, context => {
      const { motion, hover } = context.conditions ?? {}
      const content = contentRef.current
      const title = root.querySelector<HTMLElement>('[data-report-title]')
      const monthPicker = root.querySelector<HTMLElement>('[data-report-month]')
      const hero = root.querySelector<HTMLElement>('[data-hero]')
      const glows = gsap.utils.toArray<HTMLElement>('.hero-glow', root)
      const cards = gsap.utils.toArray<HTMLElement>('[data-animate]', root)
      const bodyCards = cards.filter(card => card !== hero)
      const paymentRows = gsap.utils.toArray<HTMLElement>('[data-report-row="payment"]', root)
      const revealTargets = [...cards, title, monthPicker].filter(Boolean) as HTMLElement[]

      if (!motion) {
        if (content) gsap.set(content, { clearProps: 'all' })
        if (revealTargets.length) gsap.set(revealTargets, { clearProps: 'all' })
        settleCounts(root)
        return
      }

      if (content) gsap.set(content, { opacity: 1, y: 0 })
      if (title) gsap.set(title, { opacity: 0, y: -14 })
      if (monthPicker) gsap.set(monthPicker, { opacity: 0, scale: 0.94 })
      if (hero) gsap.set(hero, { opacity: 0, scale: 0.96 })
      if (bodyCards.length) gsap.set(bodyCards, { opacity: 0, y: 24 })

      const heroCount = hero?.querySelector<HTMLElement>('[data-count-value]')
      if (heroCount) countTo(heroCount, 0.9)

      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      if (title) intro.to(title, { opacity: 1, y: 0, duration: 0.5 })
      if (monthPicker) intro.to(monthPicker, { opacity: 1, scale: 1, duration: 0.42 }, '-=0.32')
      if (hero) intro.to(hero, { opacity: 1, scale: 1, duration: 0.6 }, '-=0.16')
      if (bodyCards.length) intro.to(bodyCards, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08 }, '-=0.34')

      glows.forEach((glow, index) => {
        gsap.to(glow, {
          x: index === 0 ? 26 : -20,
          y: index === 0 ? -14 : 18,
          scale: 1.12,
          duration: 6 + index * 1.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        })
      })

      const fabIcon = document.querySelector<SVGElement>('.fab .icon')
      if (fabIcon) {
        gsap.to(fabIcon, {
          scale: 1.1,
          rotation: 4,
          duration: 1.8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          transformOrigin: 'center center'
        })
      }

      paymentRows.forEach(row => {
        const counter = row.querySelector<HTMLElement>('[data-count-value]')
        const rowTimeline = gsap.timeline({
          scrollTrigger: { trigger: row, start: 'top 85%', once: true }
        })
        rowTimeline.fromTo(row, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45 })
        if (counter) rowTimeline.add(countTo(counter, 0.65), 0)
      })

      const settleTotal = root.querySelector<HTMLElement>('[data-settle-total] [data-count-value]')
      const settleTarget = root.querySelector('[data-settle-total]')
      if (settleTotal && settleTarget) {
        gsap.timeline({ scrollTrigger: { trigger: settleTarget, start: 'top 88%', once: true } })
          .add(countTo(settleTotal, 0.75))
      }

      if (!hover) return

      const cleanupHover: Array<() => void> = []
      bodyCards.forEach(card => {
        const enter = () => gsap.to(card, { y: -4, scale: 1.004, duration: 0.25, ease: 'power2.out' })
        const leave = () => gsap.to(card, { y: 0, scale: 1, duration: 0.3, ease: 'power2.out' })
        card.addEventListener('mouseenter', enter)
        card.addEventListener('mouseleave', leave)
        cleanupHover.push(() => {
          card.removeEventListener('mouseenter', enter)
          card.removeEventListener('mouseleave', leave)
        })
      })
      return () => cleanupHover.forEach(remove => remove())
    })

    ScrollTrigger.refresh()
  }, {
    scope: rootRef,
    dependencies: [selected, loading, categories, balances, suggestions, month?.label, isDark],
    revertOnUpdate: true
  })

  const changeMonth = contextSafe((value: string) => {
    if (value === selected) return
    const content = contentRef.current
    gsap.killTweensOf(content)
    if (!content || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSelected(value)
      return
    }
    gsap.to(content, {
      opacity: 0,
      y: -8,
      duration: 0.2,
      ease: 'power2.in',
      onComplete: () => setSelected(value)
    })
  })

  const onShare = async () => {
    const result = await shareText(reportText, `${month?.label ?? ''} expense report`)
    if (result === 'copied') setMessage({ ok: true, text: 'Report copied. Paste it into WhatsApp.' })
    return result
  }

  if (loadingCycles) {
    return <div className="report-page" ref={rootRef}><ReportSkeleton /></div>
  }

  if (cycles.length === 0) {
    return (
      <div className="report-page" ref={rootRef}>
        <EmptyState title="No reports yet" body="Reports appear once your group has some expenses." />
      </div>
    )
  }

  return (
    <div className="report-page" ref={rootRef}>
      <header className="report-header">
        <div className="report-header-inner">
          <div className="report-heading">
            <p className="report-eyebrow">Insights</p>
            <h1 className="report-title" data-report-title>Monthly report</h1>
          </div>
          <MonthPicker cycles={cycles} value={selected} onChange={changeMonth} />
        </div>
      </header>

      {message && (
        <p className={clsx('banner mt-sm', message.ok ? 'banner-ok' : 'banner-error')} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      {loading ? (
        <ReportSkeleton />
      ) : (
        <div className="report-layout" ref={contentRef}>
          <Card className="report-card report-hero" data-animate data-hero>
            <span className="hero-glow hero-glow-a" aria-hidden="true" />
            <span className="hero-glow hero-glow-b" aria-hidden="true" />
            <div className="hero-content">
              <div className="hero-topline">
                <span className="hero-label">Total expenses</span>
                <span className="hero-chip">
                  <Icon name="chart" size={14} />
                  {month?.label ?? 'This month'}{month?.status === 'closed' ? ' · Closed' : ''}
                </span>
              </div>
              <p className="hero-amount count-value" data-count-value={total} data-count-currency={currency}>
                {formatMoney(total, currency)}
              </p>
              <p className="hero-meta">
                Across <strong>{categories.length}</strong> {categories.length === 1 ? 'category' : 'categories'}
                <span aria-hidden="true"> · </span>{activeGroup?.group_name ?? 'Your group'}
              </p>
            </div>
          </Card>

          <DonutChartCard
            categories={categoryViews}
            total={total}
            currency={currency}
            isDark={isDark}
            monthLabel={month?.label ?? ''}
          />

          <PaymentBreakupCard
            suggestions={suggestions}
            total={toSettle}
            currency={currency}
            isDark={isDark}
          />

          <BarChartCard
            balances={balances}
            currency={currency}
            isDark={isDark}
            monthLabel={month?.label ?? ''}
          />

          <ShareCard reportText={reportText} monthLabel={month?.label ?? 'this month'} onShare={onShare} />
        </div>
      )}
    </div>
  )
}
