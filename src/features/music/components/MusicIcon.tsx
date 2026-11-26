import { ReactNode } from 'react'
import clsx from 'clsx'

const PATHS: Record<string, ReactNode> = {
  home: <><path d="M3.5 10.5 12 3.5l8.5 7" /><path d="M5.5 9.2V20h4v-5.5h5V20h4V9.2" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.6" /><path d="m20 20-4.3-4.3" /></>,
  library: <><rect x="3.5" y="4" width="4" height="16" rx="1.4" /><rect x="10" y="4" width="4" height="16" rx="1.4" /><path d="m16.6 6.4 3.4 13.2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 7.7a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  play: <path d="M8 5.5 19 12 8 18.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />,
  pause: <><rect x="7" y="5.5" width="3.5" height="13" rx="1.1" fill="currentColor" stroke="none" /><rect x="13.5" y="5.5" width="3.5" height="13" rx="1.1" fill="currentColor" stroke="none" /></>,
  skipBack: <><path d="M6 5.5v13" /><path d="M18.5 6.5v11l-10-5.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" /></>,
  skipForward: <><path d="M18 5.5v13" /><path d="M5.5 6.5v11l10-5.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" /></>,
  shuffle: <><path d="M3.5 6.5h3.2c1.4 0 2.1.7 2.9 1.9l5.2 7.2c.8 1.2 1.5 1.9 2.9 1.9h3" /><path d="m17.5 4.5 3 2-3 2" /><path d="M3.5 17.5h3.2c1.4 0 2.1-.7 2.9-1.9l1-1.4" /><path d="M14.5 8.9c.7-1 1.4-1.9 2.4-1.9h3.1" /><path d="m17.5 15.5 3 2-3 2" /></>,
  repeat: <><path d="m17 3 3 3-3 3" /><path d="M4.5 11V9.5A3.5 3.5 0 0 1 8 6h12" /><path d="m7 21-3-3 3-3" /><path d="M19.5 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4" /></>,
  repeatOne: <><path d="m17 3 3 3-3 3" /><path d="M4.5 11V9.5A3.5 3.5 0 0 1 8 6h12" /><path d="m7 21-3-3 3-3" /><path d="M19.5 13v1.5a3.5 3.5 0 0 1-3.5 3.5H4" /><path d="M11.5 10.5 13 9.8v5" /></>,
  volume: <><path d="M4.5 9.5h3L12 6v12l-4.5-3.5h-3z" /><path d="M15.5 9a4.5 4.5 0 0 1 0 6" /><path d="M18 6.5a8 8 0 0 1 0 11" /></>,
  volumeX: <><path d="M4.5 9.5h3L12 6v12l-4.5-3.5h-3z" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></>,
  queue: <><path d="M4 6.5h13M4 11h13M4 15.5h8" /><circle cx="18" cy="17" r="2.5" /><path d="M20.5 17V9.5" /></>,
  more: <><circle cx="5.5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  x: <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />,
  chevronLeft: <path d="m14.5 6-6 6 6 6" />,
  chevronRight: <path d="m9.5 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  music: <><path d="M9 18V6.5l11-2V16" /><ellipse cx="6.5" cy="18" rx="2.7" ry="2.2" /><ellipse cx="17.5" cy="16" rx="2.7" ry="2.2" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.5l3.5 2" /></>,
  disc: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.4" /><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  headphones: <><path d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" /><rect x="3.5" y="13.5" width="4" height="6" rx="1.8" /><rect x="16.5" y="13.5" width="4" height="6" rx="1.8" /></>,
  sparkles: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" /><path d="m18.5 16 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  arrowRight: <path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" />,
  trash: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9L17.5 7" /><path d="M10.5 10.5v6M13.5 10.5v6" /></>,
  maximize: <><path d="M8.5 4.5h-4v4M15.5 4.5h4v4M19.5 15.5v4h-4M4.5 15.5v4h4" /></>,
  minimize: <><path d="M4.5 8.5h4v-4M19.5 8.5h-4v-4M19.5 15.5h-4v4M4.5 15.5h4v4" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
  wave: <><path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2" /></>
}

interface Props {
  name: string
  size?: number
  className?: string
  filled?: boolean
  strokeWidth?: number
}

export function MusicIcon({ name, size = 20, className, filled = false, strokeWidth = 1.7 }: Props) {
  return (
    <svg
      className={clsx('music-icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled && (name === 'heart' || name === 'play') ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name] ?? PATHS.music}
    </svg>
  )
}
