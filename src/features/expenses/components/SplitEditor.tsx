import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent } from 'react'
import clsx from 'clsx'
import type { GroupMember, SplitType } from '@/types'
import { allocateByPercent, computeEqualShares, ParticipantInput } from '@/services/expenses'
import { currencySymbol, formatMoney, sameMoney, sumMoney } from '@/lib/money'
import { guardReveal } from '@/lib/motionFallback'
import { Icon } from '@/components/ui/Icon'
import { gsap, useGSAP } from '../animation'

interface Props {
  members: GroupMember[] // selected participants, in order
  amount: number
  currency: string
  splitType: SplitType
  values: ParticipantInput[]
  onChange: (values: ParticipantInput[]) => void
}

const DECIMAL_RE = /^\d*\.?\d{0,2}$/

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Zero is a placeholder, never a literal value in the box. */
function toDisplay(value?: number | null): string {
  const safe = round2(value || 0)
  return safe === 0 ? '' : String(safe)
}

function parseNumber(raw: string): number {
  if (!raw || raw === '.') return 0
  const parsed = parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return round2(parsed)
}

/** Stops "05" while still allowing "0", "0." and "0.5". */
function sanitizeRaw(raw: string): string {
  return raw.replace(/^0+(?=\d)/, '')
}

function SplitStatus({
  ok,
  label,
  diff,
  mode,
  percent,
  summary
}: {
  ok: boolean
  label: string
  diff: number
  mode: SplitType
  percent: number
  summary: string
}) {
  const safePercent = Math.min(Math.max(percent, 0), 100)
  const tone = ok ? 'ok' : diff > 0 ? 'is-remaining' : 'is-over'
  return (
    <div
      className="split-status-wrap"
      data-split-status
      data-split-mode={mode}
      data-split-difference={diff}
      data-split-final-text={label}
    >
      <span className="split-summary-title">{summary}</span>
      <p className={clsx('split-status', tone)} role="status" aria-live="polite">
        <Icon name={ok ? 'checkCircle' : 'alert'} size={15} strokeWidth={2.2} />
        <span data-split-status-text data-split-final-text={label}>{label}</span>
      </p>
      <span className="split-progress-track" aria-hidden="true">
        <span className="split-progress-fill" data-split-progress style={{ width: `${safePercent}%` }} />
      </span>
    </div>
  )
}

function SplitIdentity({ name, secondary, muted }: { name?: string; secondary?: string; muted?: boolean }) {
  return (
    <span className="split-identity">
      <span className="split-name" title={name ?? ''}>{name}</span>
      {secondary !== undefined && (
        <span className={clsx('split-secondary', muted && 'is-zero')}>{secondary}</span>
      )}
    </span>
  )
}

export function SplitEditor({ members, amount, currency, splitType, values, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const ids = members.map(m => m.user_id)
  const idsKey = ids.join(',')
  const prevIds = useRef<string | null>(null)
  const prevType = useRef<SplitType | null>(null)

  // Raw strings are owned by the editor while typing. The parent only ever
  // receives numbers, so validation and the saved payload stay unchanged.
  const [raw, setRaw] = useState<Record<string, string>>({})
  const focusedIdRef = useRef<string | null>(null)

  // Keep the split in sync with who is included, the split method and the total.
  // When an existing expense is opened for editing, its saved split is kept as-is.
  useEffect(() => {
    const first = prevIds.current === null
    const membersChanged = prevIds.current !== idsKey
    const typeChanged = prevType.current !== splitType
    prevIds.current = idsKey
    prevType.current = splitType

    if (ids.length === 0) { onChange([]); return }

    const valuesMatchMembers =
      values.length === ids.length && ids.every(id => values.some(v => v.user_id === id))

    if (first && valuesMatchMembers) return // editing: keep the saved breakdown

    if (splitType === 'equal') {
      onChange(computeEqualShares(amount || 0, ids))
      return
    }

    if (splitType === 'percentage') {
      if (!membersChanged && !typeChanged && valuesMatchMembers) {
        onChange(allocateByPercent(amount || 0, values)) // only the total changed
        return
      }
      const pct = +(100 / ids.length).toFixed(2)
      const rows = ids.map((id, i) => ({
        user_id: id,
        percentage: i === ids.length - 1 ? +(100 - pct * (ids.length - 1)).toFixed(2) : pct,
        amount: 0
      }))
      onChange(allocateByPercent(amount || 0, rows))
      return
    }

    // unequal: keep what the person typed when only the total changes
    if (!membersChanged && !typeChanged) return
    onChange(computeEqualShares(amount || 0, ids))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, splitType, amount])

  // Rebuild displayed strings whenever the numeric values change from outside.
  // The field being typed in keeps its raw string until blur.
  useEffect(() => {
    setRaw(previous => {
      const next: Record<string, string> = {}
      let changed = false
      for (const id of ids) {
        const value = values.find(v => v.user_id === id)
        const numeric = splitType === 'percentage' ? value?.percentage : value?.amount
        const display = toDisplay(numeric)
        const typing = focusedIdRef.current === id && previous[id] !== undefined
        next[id] = typing ? previous[id] : display
        if (next[id] !== previous[id]) changed = true
      }
      if (!changed && Object.keys(previous).length === ids.length) return previous
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, splitType, idsKey])

  // type="text" cannot step on wheel; this also stops passive scroll handlers
  // from ever treating the field as a number spinner.
  const preventWheel = useCallback((node: HTMLInputElement | null) => {
    if (!node || node.dataset.wheelGuard === 'true') return
    node.dataset.wheelGuard = 'true'
    node.addEventListener('wheel', event => event.preventDefault(), { passive: false })
  }, [])

  const sumAmount = useMemo(() => sumMoney(values.map(v => v.amount || 0)), [values])
  const sumPct = useMemo(() => values.reduce((s, v) => s + (v.percentage || 0), 0), [values])

  const updateAmount = (userId: string, val: number) => {
    onChange(values.map(v => (v.user_id === userId ? { ...v, amount: val } : v)))
  }
  const updatePct = (userId: string, pct: number) => {
    onChange(allocateByPercent(amount || 0, values.map(v => (v.user_id === userId ? { ...v, percentage: pct } : v))))
  }

  const onFocus = (userId: string) => (event: FocusEvent<HTMLInputElement>) => {
    focusedIdRef.current = userId
    if (parseNumber(raw[userId] ?? '') > 0) event.currentTarget.select()
  }

  const onBlur = (userId: string) => () => {
    focusedIdRef.current = null
    setRaw(previous => {
      const normalized = toDisplay(parseNumber(previous[userId] ?? ''))
      if (previous[userId] === normalized) return previous
      return { ...previous, [userId]: normalized }
    })
  }

  const onChangeRaw = (
    userId: string,
    kind: 'amount' | 'percentage',
    commit: (value: number) => void
  ) => (event: ChangeEvent<HTMLInputElement>) => {
    const candidate = sanitizeRaw(event.target.value)
    if (!DECIMAL_RE.test(candidate)) return
    setRaw(previous => ({ ...previous, [userId]: candidate }))
    commit(parseNumber(candidate))
  }

  const renderInput = (
    userId: string,
    kind: 'amount' | 'percentage',
    label: string,
    variant: string,
    hasError: boolean
  ) => (
    <span className={clsx('split-input-wrap', variant, hasError && 'has-error')}>
      {kind === 'amount' && (
        <span className="split-adornment split-adornment--prefix" aria-hidden="true">{currencySymbol(currency)}</span>
      )}
      <input
        ref={preventWheel}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={clsx('split-input', kind === 'amount' && 'wide')}
        aria-label={label}
        placeholder="0"
        value={raw[userId] ?? ''}
        onFocus={onFocus(userId)}
        onBlur={onBlur(userId)}
        onChange={onChangeRaw(
          userId,
          kind,
          kind === 'amount' ? value => updateAmount(userId, value) : value => updatePct(userId, value)
        )}
      />
      {kind === 'percentage' && (
        <span className="split-adornment split-adornment--suffix" aria-hidden="true">%</span>
      )}
    </span>
  )

  // Rows stagger in when the method changes (or members join/leave).
  useGSAP(() => {
    const root = rootRef.current
    if (!root) return
    const rows = gsap.utils.toArray<HTMLElement>('[data-split-row]', root)
    if (!rows.length) return
    const mm = gsap.matchMedia()
    mm.add('(max-width: 639px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(rows,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.32, stagger: 0.035, ease: 'power2.out', overwrite: 'auto' }
      )
    })
    mm.add('(max-width: 639px) and (prefers-reduced-motion: reduce)', () => {
      gsap.set(rows, { opacity: 1, y: 0 })
    })
    return () => mm.revert()
  }, { scope: rootRef, dependencies: [splitType, idsKey], revertOnUpdate: true })

  // A delayed first frame must never leave the rows invisible.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const targets = () => gsap.utils.toArray<HTMLElement>('[data-split-row]', root)
    return guardReveal(targets, () => {
      const rows = targets()
      gsap.killTweensOf(rows)
      gsap.set(rows, { opacity: 1, y: 0 })
    }, 3000)
  }, [splitType, idsKey])

  const emptyIds = values.filter(v => (v.amount || 0) === 0).map(v => v.user_id)
  const remainingCents = Math.round((amount || 0) * 100) - Math.round(sumAmount * 100)
  const distributeRemaining = () => {
    if (remainingCents <= 0 || emptyIds.length === 0) return
    const shares = computeEqualShares(remainingCents / 100, emptyIds)
    const byId = new Map(shares.map(share => [share.user_id, share.amount]))
    onChange(values.map(v => (byId.has(v.user_id) ? { ...v, amount: byId.get(v.user_id)! } : v)))
  }
  const splitEvenly = () => {
    if (ids.length === 0) return
    const pct = +(100 / ids.length).toFixed(2)
    const rows = ids.map((id, i) => ({
      user_id: id,
      percentage: i === ids.length - 1 ? +(100 - pct * (ids.length - 1)).toFixed(2) : pct,
      amount: 0
    }))
    onChange(allocateByPercent(amount || 0, rows))
  }

  const hint = amount <= 0 && (
    <p className="split-hint" role="note">Enter the amount first to see each person's share</p>
  )

  if (splitType === 'equal') {
    return (
      <div className="split-editor split-editor--equal" data-split-card ref={rootRef}>
        {hint}
        <div className="split-list stack-xs">
          {members.map(m => {
            const v = values.find(x => x.user_id === m.user_id)
            const share = v?.amount ?? 0
            return (
              <div key={m.user_id} className="split-row" data-split-row>
                <span className="avatar avatar-xs split-avatar" aria-hidden="true">
                  {m.profile?.name?.[0]?.toUpperCase()}
                </span>
                <SplitIdentity name={m.profile?.name} secondary="" />
                <span className={clsx('tabular', 'fw-medium', 'split-amount', share === 0 && 'is-zero')}>
                  {formatMoney(share, currency)}
                </span>
              </div>
            )
          })}
        </div>
        <SplitStatus
          ok label="Evenly split" diff={0} mode="equal" percent={100}
          summary={`Evenly split · ${members.length} ${members.length === 1 ? 'person' : 'people'}`}
        />
      </div>
    )
  }

  if (splitType === 'percentage') {
    const diff = +(100 - sumPct).toFixed(2)
    const ok = Math.abs(diff) < 0.01
    const over = diff < -0.01
    const label = ok ? 'Adds up to 100%' : `${diff > 0 ? 'Remaining' : 'Over by'} ${Math.abs(diff)}%`
    return (
      <div className="split-editor split-editor--percentage" data-split-card ref={rootRef}>
        {hint}
        <div className="split-list stack-xs">
          {members.map(m => {
            const v = values.find(x => x.user_id === m.user_id)
            const pct = v?.percentage ?? 0
            const share = v?.amount ?? 0
            return (
              <div key={m.user_id} className={clsx('split-row', over && pct > 0 && 'has-error')} data-split-row>
                <span className="avatar avatar-xs split-avatar" aria-hidden="true">
                  {m.profile?.name?.[0]?.toUpperCase()}
                </span>
                <SplitIdentity name={m.profile?.name} secondary={formatMoney(share, currency)} muted={share === 0} />
                <span className="split-unit tabular split-unit--desktop">{formatMoney(share, currency)}</span>
                {renderInput(
                  m.user_id, 'percentage', `${m.profile?.name} percentage`,
                  'split-input-wrap--percent', over && pct > 0
                )}
                <span className="split-unit split-unit--desktop" aria-hidden="true">%</span>
              </div>
            )
          })}
        </div>
        <div className="split-quick-actions">
          <button type="button" onClick={splitEvenly} disabled={members.length === 0}>Split evenly</button>
        </div>
        <SplitStatus
          ok={ok} label={label} diff={diff} mode="percentage" percent={sumPct}
          summary={`Total ${round2(sumPct)}%`}
        />
      </div>
    )
  }

  // unequal
  const diffCents = Math.round((amount || 0) * 100) - Math.round(sumAmount * 100)
  const ok = diffCents === 0 && sameMoney(sumAmount, amount || 0)
  const over = diffCents < 0
  const label = ok
    ? 'Adds up to the total'
    : `${diffCents > 0 ? 'Remaining' : 'Over by'} ${formatMoney(Math.abs(diffCents) / 100, currency)}`
  const percent = amount > 0 ? (sumAmount / amount) * 100 : 0
  return (
    <div className="split-editor split-editor--unequal" data-split-card ref={rootRef}>
      {hint}
      <div className="split-list stack-xs">
        {members.map(m => {
          const v = values.find(x => x.user_id === m.user_id)
          const assigned = v?.amount ?? 0
          return (
            <div key={m.user_id} className={clsx('split-row', over && assigned > 0 && 'has-error')} data-split-row>
              <span className="avatar avatar-xs split-avatar" aria-hidden="true">
                {m.profile?.name?.[0]?.toUpperCase()}
              </span>
              <SplitIdentity name={m.profile?.name} secondary="share" />
              <span className="split-unit split-unit--desktop" aria-hidden="true">{currencySymbol(currency)}</span>
              {renderInput(
                m.user_id, 'amount', `${m.profile?.name} amount`,
                'split-input-wrap--money', over && assigned > 0
              )}
            </div>
          )
        })}
      </div>
      <div className="split-quick-actions">
        <button
          type="button"
          onClick={distributeRemaining}
          disabled={remainingCents <= 0 || emptyIds.length === 0}
        >Distribute remaining equally</button>
      </div>
      <SplitStatus
        ok={ok} label={label} diff={diffCents} mode="unequal" percent={percent}
        summary={`Assigned ${formatMoney(sumAmount, currency)} of ${formatMoney(amount || 0, currency)}`}
      />
    </div>
  )
}
