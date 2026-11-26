import { useEffect, useState } from 'react'
import { currencySymbol } from '@/lib/money'

export interface CategoryView {
  category: string
  icon: string
  total: number
  percent: number
  color: string
}

export const LIGHT_CHART_COLORS = [
  '#4A3AD0', '#0F8A5F', '#E0913A', '#C8462E', '#3A9BD9', '#9B5DE5', '#7A809B', '#B9AEF5'
]

export const DARK_CHART_COLORS = [
  '#8F80FF', '#3FC99B', '#F0B45E', '#F08A72', '#5FB6E8', '#B98CF0', '#9AA2BF', '#C9C2FF'
]

/** Short money label for chart axes and value labels (₹5.2k, ₹1.3m). */
export function compactMoney(value: number, currency: string): string {
  const formatted = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  })
    .format(Math.abs(value))
    .replace('K', 'k')
    .replace('M', 'm')
  return `${currencySymbol(currency)}${formatted}`
}

export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, (part / total) * 100)) : 0
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** Stable colour per name, so a member keeps the same avatar everywhere. */
export function avatarColor(name: string, isDark: boolean): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  const palette = isDark ? DARK_CHART_COLORS : LIGHT_CHART_COLORS
  return palette[Math.abs(hash) % palette.length]
}

export function shortName(name: string, max = 12): string {
  const first = name.trim().split(/\s+/)[0] || name
  return first.length > max ? `${first.slice(0, max - 1)}…` : first
}

export function truncate(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name
}

/** React wrapper around matchMedia, used only to pick a chart orientation. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [query])

  return matches
}
