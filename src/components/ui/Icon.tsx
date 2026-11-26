import { ReactNode } from 'react'
import clsx from 'clsx'

// One consistent line-icon set (24px grid, round caps) used across the app.
// Inline SVG keeps it dependency-free and lets icons inherit currentColor.
const PATHS: Record<string, ReactNode> = {
  home: <><path d="M3.5 10.2 12 3.5l8.5 6.7" /><path d="M5.5 8.8V19a1.5 1.5 0 0 0 1.5 1.5h3V15h4v5.5h3a1.5 1.5 0 0 0 1.5-1.5V8.8" /></>,
  receipt: <><path d="M5.5 3.5h13v17l-2.6-1.6-2.2 1.6-1.7-1.6-1.7 1.6-2.2-1.6-2.6 1.6z" /><path d="M9 8.5h6M9 12h6M9 15.5h3.5" /></>,
  exchange: <><path d="M4 8h15.5l-4-4" /><path d="M20 16H4.5l4 4" /></>,
  chart: <><path d="M3.5 20.5h17" /><rect x="5" y="11" width="3.2" height="6.5" rx="1" /><rect x="10.4" y="5" width="3.2" height="12.5" rx="1" /><rect x="15.8" y="13.5" width="3.2" height="4" rx="1" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="15" rx="2.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  arrowLeft: <path d="M19 12H5M10.5 17.5 5 12l5.5-5.5" />,
  arrowRight: <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />,
  arrowUp: <><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" /></>,
  arrowDown: <><path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
  sliders: <><path d="M4 6.5h9.5M18.5 6.5H20M4 12h3.5M12.5 12H20M4 17.5h11.5" /><circle cx="16" cy="6.5" r="2.2" /><circle cx="10" cy="12" r="2.2" /><circle cx="18" cy="17.5" r="2.2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18.2 14.2A6.5 6.5 0 0 1 21.5 20" /></>,
  tag: <><path d="M3.5 12.2V5A1.5 1.5 0 0 1 5 3.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0z" /><circle cx="8.2" cy="8.2" r="1.4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.2-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h0a1.6 1.6 0 0 0 1-1.5v-.2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
  bell: <><path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15 6 8.5" /><path d="M10.2 20.5a2 2 0 0 0 3.6 0" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  userPlus: <><circle cx="9.5" cy="8" r="4" /><path d="M2.5 20.5a7 7 0 0 1 14 0" /><path d="M19 8v6M16 11h6" /></>,
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2.5 2.5 0 0 1-2.7 2.5A16.5 16.5 0 0 1 4 6.2 2.5 2.5 0 0 1 6.5 3.5z" />,
  shield: <><path d="M12 3 5 6v5.5c0 4.2 2.9 7.8 7 9.5 4.1-1.7 7-5.3 7-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  repeat: <><path d="m17 2.5 3.5 3.5L17 9.5" /><path d="M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13.5" /><path d="m7 21.5-3.5-3.5L7 14.5" /><path d="M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5" /></>,
  share: <><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /><path d="m8.7 10.7 6.6-3.9M8.7 13.3l6.6 3.9" /></>,
  edit: <><path d="M4 20h4L19.2 8.8a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="m6 7 1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" /><path d="M9 7V4.5A1 1 0 0 1 10 3.5h4a1 1 0 0 1 1 1V7" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="m8.5 12.3 2.5 2.5 4.6-5" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M17.9 17.9A10 10 0 0 1 12 19.5C6 19.5 2.5 12 2.5 12a18.4 18.4 0 0 1 5.1-5.9" /><path d="M9.9 4.6A9.6 9.6 0 0 1 12 4.5c6 0 9.5 7.5 9.5 7.5a18.6 18.6 0 0 1-2.2 3.2" /><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" /><path d="m2.5 2.5 19 19" /></>,
  logout: <><path d="M9.5 4H6.5A2 2 0 0 0 4.5 6v12a2 2 0 0 0 2 2h3" /><path d="m15.5 16.5 4.5-4.5-4.5-4.5M20 12H9.5" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></>,
  message: <path d="M20.5 12a8.5 8.5 0 0 1-12.4 7.6L3.5 20.5l1-4.4A8.5 8.5 0 1 1 20.5 12z" />,
  banknote: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 12h.01M18 12h.01" /></>,
  refresh: <><path d="M19.5 10.5A7.5 7.5 0 0 0 6 6.8L3.5 9.2" /><path d="M3.5 4.5v4.7h4.7" /><path d="M4.5 13.5A7.5 7.5 0 0 0 18 17.2l2.5-2.4" /><path d="M20.5 19.5v-4.7h-4.7" /></>,
  inbox: <><path d="M3.5 13h5l1.5 2.5h4L15.5 13h5" /><path d="M6 5h12l2.5 8v5.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5V13z" /></>,
  image: <><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="m4 17 5-5 3.5 3.5 3-3L20 17.5" /></>,
  download: <><path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4.5 16.5v2.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" /></>,
  wallet: <><path d="M18.5 7.5V5.5A1.5 1.5 0 0 0 17 4H5.5a2 2 0 0 0 0 4H19a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5.5a2 2 0 0 1-2-2V6" /><path d="M16.5 13.8h.01" /></>,
  alert: <><path d="M12 3.5 2.8 19.5h18.4z" /><path d="M12 10v4M12 17h.01" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  sun: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></>,
  moon: <path d="M20.4 14.3A8.6 8.6 0 0 1 9.7 3.6 8.6 8.6 0 1 0 20.4 14.3z" />
}

export type IconName = keyof typeof PATHS

interface Props {
  name: IconName | string
  size?: number
  strokeWidth?: number
  className?: string
}

export function Icon({ name, size = 20, strokeWidth = 1.75, className }: Props) {
  return (
    <svg
      className={clsx('icon', className)}
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      {PATHS[name] ?? PATHS.receipt}
    </svg>
  )
}

/** Category icons are user data (usually an emoji); this shows one in a uniform tile. */
export function CategoryTile({ icon, size = 'md' }: { icon?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={clsx('cat-tile', `cat-tile-${size}`)} aria-hidden="true">
      {icon ? <span className="cat-tile-emoji">{icon}</span> : <Icon name="receipt" size={size === 'lg' ? 26 : size === 'sm' ? 16 : 20} />}
    </span>
  )
}

/** Brand mark: two overlapping shares of one whole. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <circle cx="12.5" cy="16" r="6.5" fill="none" stroke="#fff" strokeWidth="2.2" />
      <circle cx="19.5" cy="16" r="6.5" fill="#fff" fillOpacity="0.28" stroke="#fff" strokeWidth="2.2" />
    </svg>
  )
}
