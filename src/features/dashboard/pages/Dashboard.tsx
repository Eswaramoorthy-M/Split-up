import { RefObject, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { useGroup } from '@/contexts/GroupContext'
import { useAuth } from '@/contexts/AuthContext'
import { getGroupBalances, getSettlementSuggestions } from '@/services/balances'
import { listExpenses } from '@/services/expenses'
import { listMembers } from '@/services/groups'
import type { GroupBalance, SettlementSuggestion } from '@/types'
import { Card } from '@/components/ui/Card'
import { formatMoney, balanceLabel } from '@/lib/money'
import { Icon } from '@/components/ui/Icon'
import { guardReveal } from '@/lib/motionFallback'
import { gsap, useGSAP } from '../animation'

const PROGRESS_RADIUS = 38
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS

function countTo(element: HTMLElement, value: number, currency: string, duration = 1) {
  const proxy = { value: 0 }
  element.textContent = formatMoney(0, currency)
  return gsap.to(proxy, {
    value,
    duration,
    ease: 'power3.out',
    onUpdate: () => { element.textContent = formatMoney(proxy.value, currency) },
    onComplete: () => { element.textContent = formatMoney(value, currency) }
  })
}

function settleCounts(root: HTMLElement, currency: string) {
  root.querySelectorAll<HTMLElement>('[data-dash-count]').forEach(element => {
    element.textContent = formatMoney(Number(element.dataset.dashCountValue ?? 0), currency)
  })
}

function settleProgress(root: HTMLElement) {
  root.querySelectorAll<SVGCircleElement>('[data-dash-progress]').forEach(circle => {
    circle.style.strokeDashoffset = String(circle.dataset.dashProgressOffset ?? PROGRESS_CIRCUMFERENCE)
  })
  root.querySelectorAll<HTMLElement>('[data-dash-progress-label]').forEach(label => {
    label.textContent = `${label.dataset.dashProgressValue ?? 0}%`
  })
}

function settleBars(root: HTMLElement) {
  gsap.set(gsap.utils.toArray<HTMLElement>('[data-dash-bar]', root), { scaleX: 1, transformOrigin: 'left center' })
}

function settleCheck(root: HTMLElement) {
  const path = root.querySelector<SVGPathElement>('[data-dash-settled-check]')
  if (path) gsap.set(path, { strokeDashoffset: 0 })
}

function CountText({ value, currency, className }: { value: number; currency: string; className?: string }) {
  return (
    <span className={clsx('tabular', className)} data-dash-count data-dash-count-value={value}>
      {formatMoney(value, currency)}
    </span>
  )
}

function ProgressRing({ percent }: { percent: number }) {
  const offset = PROGRESS_CIRCUMFERENCE * (1 - Math.min(Math.max(percent, 0), 100) / 100)
  return (
    <div className="dash-progress" role="img" aria-label={`${percent}% settled`}>
      <svg viewBox="0 0 88 88" aria-hidden="true">
        <circle className="dash-progress-track" cx="44" cy="44" r={PROGRESS_RADIUS} />
        <circle
          className="dash-progress-value"
          data-dash-progress
          data-dash-progress-offset={offset}
          cx="44"
          cy="44"
          r={PROGRESS_RADIUS}
          strokeDasharray={PROGRESS_CIRCUMFERENCE}
          strokeDashoffset={PROGRESS_CIRCUMFERENCE}
        />
      </svg>
      <span className="dash-progress-label" data-dash-progress-label data-dash-progress-value={percent}>
        {percent}%
      </span>
    </div>
  )
}

function SettledState() {
  return (
    <div className="dash-settled" data-dash-settled>
      <svg className="dash-settled-icon" viewBox="0 0 56 56" aria-hidden="true">
        <circle className="dash-settled-circle" cx="28" cy="28" r="23" />
        <path
          className="dash-settled-check"
          data-dash-settled-check
          d="m17 28.5 7.5 7.5L39 21"
        />
      </svg>
      <div>
        <strong>Everyone is settled up.</strong>
        <span>No payments are pending right now.</span>
      </div>
    </div>
  )
}

function DashSkeleton({ rootRef }: { rootRef: RefObject<HTMLDivElement> }) {
  return (
    <div ref={rootRef} className="dashboard-page dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <div className="dash-skeleton-header">
        <div className="dash-skeleton-copy">
          <span className="dash-skeleton-line dash-skeleton-line--sm"><i data-shimmer /></span>
          <span className="dash-skeleton-line dash-skeleton-line--lg"><i data-shimmer /></span>
        </div>
        <span className="dash-skeleton-chip"><i data-shimmer /></span>
      </div>
      <div className="dash-skeleton-card dash-skeleton-hero hero-card--dark">
        <span className="dash-skeleton-line dash-skeleton-line--sm"><i data-shimmer /></span>
        <span className="dash-skeleton-line dash-skeleton-line--amount"><i data-shimmer /></span>
        <div className="dash-skeleton-stats">
          {[0, 1, 2, 3].map(i => (
            <span key={i} className="dash-skeleton-tile"><i data-shimmer /></span>
          ))}
        </div>
      </div>
      <div className="dash-skeleton-card dash-skeleton-balance">
        <span className="dash-skeleton-line dash-skeleton-line--md"><i data-shimmer /></span>
        <span className="dash-skeleton-line dash-skeleton-line--lg"><i data-shimmer /></span>
      </div>
      <div className="dash-skeleton-card dash-skeleton-list">
        {[0, 1, 2].map(i => (
          <div key={i} className="dash-skeleton-row">
            <span className="dash-skeleton-avatar"><i data-shimmer /></span>
            <span className="dash-skeleton-line dash-skeleton-line--md"><i data-shimmer /></span>
            <span className="dash-skeleton-pill"><i data-shimmer /></span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { activeGroup } = useGroup()
  const { user, profile } = useAuth()
  const [balances, setBalances] = useState<GroupBalance[]>([])
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[]>([])
  const [expenseCount, setExpenseCount] = useState(0)
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [switching, setSwitching] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const previousGroupIdRef = useRef(activeGroup?.id)

  // Group changes keep the old screen mounted for one beat so the GSAP
  // exit/enter transition can play. Data fetching below is untouched.
  if (activeGroup?.id !== previousGroupIdRef.current) {
    previousGroupIdRef.current = activeGroup?.id
    if (!loading) setSwitching(true)
  }

  useEffect(() => {
    if (!activeGroup) return
    Promise.all([
      getGroupBalances(activeGroup.id),
      getSettlementSuggestions(activeGroup.id),
      listExpenses(activeGroup.id, { pageSize: 1 }),
      listMembers(activeGroup.id)
    ]).then(([b, s, ex, m]) => {
      setBalances(b); setSuggestions(s); setExpenseCount(ex.count); setMemberCount(m.length)
      setLoading(false)
    })
  }, [activeGroup])

  useEffect(() => {
    if (!switching || loading) return
    const timer = window.setTimeout(() => setSwitching(false), 180)
    return () => window.clearTimeout(timer)
  }, [switching, loading, balances])

  // Skeleton shimmer runs in its own scoped context and is skipped entirely
  // for people who prefer reduced motion.
  useGSAP(() => {
    const root = rootRef.current
    if (!root || !loading) return
    const mm = gsap.matchMedia()
    mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, context => {
      const { motion } = context.conditions ?? {}
      const shimmers = gsap.utils.toArray<HTMLElement>('[data-shimmer]', root)
      if (!motion) {
        gsap.set(shimmers, { opacity: 0.45, xPercent: 0 })
        return
      }
      shimmers.forEach((shimmer, index) => {
        gsap.fromTo(shimmer,
          { xPercent: -35, opacity: 0.35 },
          {
            xPercent: 35,
            opacity: 0.8,
            duration: 1.25,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
            delay: index * 0.04
          }
        )
      })
    })
  }, { scope: rootRef, dependencies: [loading], revertOnUpdate: true })

  const currency = activeGroup?.currency ?? 'INR'

  useGSAP(() => {
    const root = rootRef.current
    if (!root || loading) return

    const mm = gsap.matchMedia()
    mm.add({
      motion: '(prefers-reduced-motion: no-preference)',
      hover: '(hover: hover) and (min-width: 1024px)'
    }, context => {
      const { motion, hover } = context.conditions ?? {}
      const content = root.querySelector<HTMLElement>('[data-dash-content]')
      const header = root.querySelector<HTMLElement>('[data-dash-header]')
      const hero = root.querySelector<HTMLElement>('[data-dash-hero]')
      const stats = gsap.utils.toArray<HTMLElement>('[data-dash-stat]', root)
      const balance = root.querySelector<HTMLElement>('[data-dash-balance]')
      const sectionTitle = root.querySelector<HTMLElement>('[data-dash-section-title]')
      const rows = gsap.utils.toArray<HTMLElement>('[data-dash-row]', root)
      const glows = gsap.utils.toArray<HTMLElement>('[data-dash-glow]', root)
      const bars = gsap.utils.toArray<HTMLElement>('[data-dash-bar]', root)
      const progressCircle = root.querySelector<SVGCircleElement>('[data-dash-progress]')
      const progressLabel = root.querySelector<HTMLElement>('[data-dash-progress-label]')
      const settledCheck = root.querySelector<SVGPathElement>('[data-dash-settled-check]')
      const settledState = root.querySelector<HTMLElement>('[data-dash-settled]')
      const cta = root.querySelector<HTMLElement>('[data-dash-cta]')
      const counters = gsap.utils.toArray<HTMLElement>('[data-dash-count]', root)
      const cleanups: Array<() => void> = []

      if (!motion) {
        settleCounts(root, currency)
        settleProgress(root)
        settleBars(root)
        settleCheck(root)
        gsap.set([header, hero, balance, sectionTitle, ...stats, ...rows, settledState].filter(Boolean), {
          clearProps: 'all'
        })
        gsap.set([header, hero, balance, sectionTitle, ...stats, ...rows, settledState].filter(Boolean), {
          opacity: 1, x: 0, y: 0, scale: 1
        })
        return
      }

      if (switching) {
        gsap.to(content ?? root, { opacity: 0.3, scale: 0.99, duration: 0.18, ease: 'power2.in' })
        return
      }

      const introTargets = [header, hero, ...stats, balance, sectionTitle, ...rows].filter(Boolean) as HTMLElement[]
      gsap.set(introTargets, { opacity: 0, y: 20 })
      if (hero) gsap.set(hero, { scale: 0.97, y: 14 })
      if (balance) gsap.set(balance, { scale: 0.98 })
      gsap.set(bars, { scaleX: 0, transformOrigin: 'left center' })

      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      if (header) intro.to(header, { opacity: 1, y: 0, duration: 0.5 })
      if (hero) intro.to(hero, { opacity: 1, y: 0, scale: 1, duration: 0.62 }, '-=0.28')
      if (stats.length) intro.to(stats, { opacity: 1, y: 0, duration: 0.5, stagger: 0.07 }, '-=0.32')
      if (balance) intro.to(balance, { opacity: 1, y: 0, scale: 1, duration: 0.6 }, '-=0.26')
      if (sectionTitle) intro.to(sectionTitle, { opacity: 1, y: 0, duration: 0.45 }, '-=0.3')
      if (rows.length) intro.to(rows, { opacity: 1, y: 0, duration: 0.5, stagger: 0.06 }, '-=0.24')

      counters.forEach(element => {
        intro.add(countTo(element, Number(element.dataset.dashCountValue ?? 0), currency, 1), 0.25)
      })

      if (progressCircle) {
        const targetOffset = Number(progressCircle.dataset.dashProgressOffset ?? PROGRESS_CIRCUMFERENCE)
        gsap.set(progressCircle, { strokeDashoffset: PROGRESS_CIRCUMFERENCE })
        intro.to(progressCircle, { strokeDashoffset: targetOffset, duration: 0.85, ease: 'power3.out' }, 0.62)
      }
      if (progressLabel) {
        const target = Number(progressLabel.dataset.dashProgressValue ?? 0)
        const proxy = { value: 0 }
        progressLabel.textContent = '0%'
        intro.to(proxy, {
          value: target,
          duration: 0.85,
          ease: 'power3.out',
          onUpdate: () => { progressLabel.textContent = `${Math.round(proxy.value)}%` },
          onComplete: () => { progressLabel.textContent = `${target}%` }
        }, 0.62)
      }
      if (bars.length) {
        intro.to(bars, { scaleX: 1, duration: 0.65, stagger: 0.07, ease: 'power2.out' }, 0.72)
      }

      if (settledCheck && settledState) {
        const length = settledCheck.getTotalLength()
        gsap.set(settledCheck, { strokeDasharray: length, strokeDashoffset: length })
        intro.to(settledCheck, { strokeDashoffset: 0, duration: 0.45, ease: 'power2.out' }, '-=0.35')
          .fromTo(settledState, { scale: 0.96 }, { scale: 1, duration: 0.42, ease: 'back.out(2)' }, '-=0.12')
      }

      glows.forEach((glow, index) => {
        gsap.to(glow, {
          x: index === 0 ? 26 : -22,
          y: index === 0 ? -16 : 20,
          scale: 1.12,
          duration: 8 + index * 2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut'
        })
      })

      if (cta) {
        gsap.to(cta, {
          scale: 1.035,
          duration: 0.65,
          repeat: 5,
          yoyo: true,
          delay: 1.15,
          ease: 'sine.inOut',
          transformOrigin: '50% 50%'
        })
      }

      const cards = gsap.utils.toArray<HTMLElement>('[data-dash-card]', root)
      if (hover) {
        cards.forEach(card => {
          const enter = () => gsap.to(card, { y: -4, duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
          const leave = () => gsap.to(card, { y: 0, duration: 0.28, ease: 'power2.out', overwrite: 'auto' })
          card.addEventListener('mouseenter', enter)
          card.addEventListener('mouseleave', leave)
          cleanups.push(() => {
            card.removeEventListener('mouseenter', enter)
            card.removeEventListener('mouseleave', leave)
          })
        })
      }

      gsap.utils.toArray<HTMLElement>('[data-dash-interactive]', root).forEach(element => {
        const down = () => gsap.to(element, { scale: 0.98, duration: 0.1, ease: 'power2.out', overwrite: 'auto' })
        const up = () => gsap.to(element, { scale: 1, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
        element.addEventListener('pointerdown', down)
        element.addEventListener('pointerup', up)
        element.addEventListener('pointercancel', up)
        element.addEventListener('pointerleave', up)
        cleanups.push(() => {
          element.removeEventListener('pointerdown', down)
          element.removeEventListener('pointerup', up)
          element.removeEventListener('pointercancel', up)
          element.removeEventListener('pointerleave', up)
        })
      })

      return () => {
        cleanups.forEach(off => off())
        settleCounts(root, currency)
        settleProgress(root)
        settleBars(root)
        settleCheck(root)
      }
    })
  }, {
    scope: rootRef,
    dependencies: [activeGroup?.id, loading, switching],
    revertOnUpdate: true
  })

  // Cold PWA starts can delay the first frame; never leave the dashboard
  // stuck at the intro's opacity: 0 state.
  useEffect(() => {
    const root = rootRef.current
    if (!root || loading) return
    const revealTargets = () => [
      root.querySelector<HTMLElement>('[data-dash-header]'),
      root.querySelector<HTMLElement>('[data-dash-hero]'),
      ...gsap.utils.toArray<HTMLElement>('[data-dash-stat]', root),
      root.querySelector<HTMLElement>('[data-dash-balance]'),
      root.querySelector<HTMLElement>('[data-dash-section-title]'),
      ...gsap.utils.toArray<HTMLElement>('[data-dash-row]', root)
    ].filter(Boolean) as HTMLElement[]

    return guardReveal(revealTargets, () => {
      const targets = revealTargets()
      gsap.killTweensOf(targets)
      gsap.set(targets, { opacity: 1, x: 0, y: 0, scale: 1 })
      const content = root.querySelector<HTMLElement>('[data-dash-content]')
      if (content) gsap.set(content, { opacity: 1, y: 0, scale: 1 })
      settleCounts(root, currency)
      settleProgress(root)
      settleBars(root)
      settleCheck(root)
    }, 3000)
  }, [activeGroup?.id, loading, switching, currency])

  if (loading) return <DashSkeleton rootRef={rootRef} />

  const me = balances.find(b => b.user_id === user?.id)
  const totalExpenses = balances.reduce((s, b) => s + b.total_paid, 0)
  const pendingAmount = suggestions.reduce((s, x) => s + x.amount, 0)
  const settledAmount = Math.max(totalExpenses - pendingAmount, 0)
  const settledPercent = totalExpenses > 0 ? Math.min(Math.round((settledAmount / totalExpenses) * 100), 100) : 100

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.name?.trim().split(/\s+/)[0] ?? 'there'

  const balanceInfo = me ? balanceLabel(me.net_balance, currency) : null
  const balanceState = balanceInfo?.state ?? 'settled'
  const balanceCaption = balanceState === 'receive' ? 'You get back' : balanceState === 'owe' ? 'You owe' : 'Settled up'
  const balanceMax = me ? Math.max(me.total_paid, me.total_share, 0.01) : 1
  const paidRatio = me ? (me.total_paid / balanceMax) * 100 : 0
  const shareRatio = me ? (me.total_share / balanceMax) * 100 : 0
  const largestBalance = Math.max(...balances.map(b => Math.abs(b.net_balance)), 0.01)
  const visibleBalances = balances.filter(b => Math.abs(b.net_balance) > 0.01)

  return (
    <div className="dashboard-page" ref={rootRef}>
      <div className="dashboard-content" data-dash-content>
        <header className="dash-header" data-dash-header>
          <div className="dash-header-copy">
            <p className="dash-greeting">{greeting}, {firstName}</p>
            <h1 className="page-title dash-title">This month</h1>
          </div>
          <div className="dash-header-actions">
            <span className="dash-group-pill"><Icon name="grid" size={14} />{activeGroup?.group_name ?? 'Your group'}</span>
            <Link to="/groups" className="dash-switch-chip" data-dash-interactive>
              <Icon name="repeat" size={16} />Switch
            </Link>
          </div>
        </header>

        <Card className="dash-hero hero-card--dark" data-dash-hero data-dash-card>
          <div className="dash-hero-mesh" aria-hidden="true">
            <span className="dash-glow dash-glow--a" data-dash-glow />
            <span className="dash-glow dash-glow--b" data-dash-glow />
            <span className="dash-glow dash-glow--c" data-dash-glow />
          </div>
          <div className="dash-hero-inner">
            <div className="dash-hero-top">
              <div className="dash-hero-summary">
                <div className="dash-hero-label-row">
                  <p className="dash-hero-label">Total expenses</p>
                  <span className="dash-month-badge"><Icon name="calendar" size={13} />This month</span>
                </div>
                <p className="dash-hero-amount"><CountText value={totalExpenses} currency={currency} /></p>
              </div>
              <ProgressRing percent={settledPercent} />
            </div>

            <div className="dash-stats">
              <div className="dash-stat" data-dash-stat>
                <span className="dash-stat-icon"><Icon name="users" size={17} /></span>
                <span className="dash-stat-copy"><span>Members</span><strong className="tabular">{memberCount}</strong></span>
              </div>
              <div className="dash-stat" data-dash-stat>
                <span className="dash-stat-icon"><Icon name="receipt" size={17} /></span>
                <span className="dash-stat-copy"><span>Expenses</span><strong className="tabular">{expenseCount}</strong></span>
              </div>
              <div className="dash-stat dash-stat--owe" data-dash-stat>
                <span className="dash-stat-icon"><Icon name="clock" size={17} /></span>
                <span className="dash-stat-copy">
                  <span>Pending</span>
                  <strong><CountText value={pendingAmount} currency={currency} /></strong>
                </span>
              </div>
              <div className="dash-stat dash-stat--receive" data-dash-stat>
                <span className="dash-stat-icon"><Icon name="checkCircle" size={17} /></span>
                <span className="dash-stat-copy">
                  <span>Settled</span>
                  <strong><CountText value={settledAmount} currency={currency} /></strong>
                </span>
              </div>
            </div>
          </div>
        </Card>

        {me && (
          <Card className={clsx('dash-balance-card', balanceState)} data-dash-balance data-dash-card>
            <div className="dash-balance-head">
              <span className="dash-balance-icon">
                <Icon name={balanceState === 'receive' ? 'arrowUp' : balanceState === 'owe' ? 'arrowDown' : 'check'} size={19} />
              </span>
              <div>
                <p className="dash-balance-label">Your balance</p>
                <p className="dash-balance-caption">{balanceCaption}</p>
              </div>
            </div>
            <p className="dash-balance-amount"><CountText value={Math.abs(me.net_balance)} currency={currency} /></p>
            <div className="dash-compare">
              <div className="dash-compare-row">
                <span className="dash-compare-label">Paid</span>
                <strong className="tabular">{formatMoney(me.total_paid, currency)}</strong>
              </div>
              <span className="dash-compare-track">
                <span className="dash-compare-fill" data-dash-bar style={{ width: `${paidRatio}%` }} />
              </span>
              <div className="dash-compare-row">
                <span className="dash-compare-label">Your share</span>
                <strong className="tabular">{formatMoney(me.total_share, currency)}</strong>
              </div>
              <span className="dash-compare-track">
                <span className="dash-compare-fill dash-compare-fill--muted" data-dash-bar style={{ width: `${shareRatio}%` }} />
              </span>
            </div>
          </Card>
        )}

        <div className="dash-section-head" data-dash-section-title>
          <div>
            <h2 className="section-title">Who owes what</h2>
            <p className="dash-section-sub">Balances after this month's expenses</p>
          </div>
          {pendingAmount > 0 && (
            <Link to="/settle" className="dash-cta" data-dash-cta data-dash-interactive>
              <Icon name="wallet" size={17} />Settle up<Icon name="arrowRight" size={16} />
            </Link>
          )}
        </div>

        <Card className="dash-list-card" data-dash-card>
          {visibleBalances.length > 0 ? (
            <div className="dash-rows">
              {visibleBalances.map(balance => (
                <div key={balance.user_id} className="dash-row" data-dash-row>
                  <span
                    className={clsx('avatar', 'avatar-xs', 'dash-avatar', balance.net_balance > 0 ? 'dash-avatar--receive' : 'dash-avatar--owe')}
                    aria-hidden="true"
                  >
                    {balance.name?.[0]?.toUpperCase()}
                  </span>
                  <div className="dash-row-main">
                    <span className="dash-row-name">{balance.name}</span>
                    <span className="dash-row-track">
                      <span
                        className={clsx('dash-row-fill', balance.net_balance > 0 ? 'dash-row-fill--receive' : 'dash-row-fill--owe')}
                        data-dash-bar
                        style={{ width: `${(Math.abs(balance.net_balance) / largestBalance) * 100}%` }}
                      />
                    </span>
                  </div>
                  <span className={clsx('amount-pill', 'dash-amount-pill', balance.net_balance > 0 ? 'receive' : 'owe')}>
                    {balance.net_balance > 0
                      ? `gets back ${formatMoney(balance.net_balance, currency)}`
                      : `owes ${formatMoney(Math.abs(balance.net_balance), currency)}`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <SettledState />
          )}
        </Card>
      </div>
    </div>
  )
}
