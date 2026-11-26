import { CSSProperties } from 'react'
import clsx from 'clsx'

interface Props {
  gradient: [string, string, string]
  glyph?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  playing?: boolean
}

export function Cover({ gradient, glyph = '✦', size = 'md', className, playing = false }: Props) {
  const style = {
    '--cover-a': gradient[0],
    '--cover-b': gradient[1],
    '--cover-c': gradient[2]
  } as CSSProperties

  return (
    <span className={clsx('m-cover', `m-cover-${size}`, playing && 'is-playing', className)} style={style}>
      <span className="m-cover-orb m-cover-orb-a" />
      <span className="m-cover-orb m-cover-orb-b" />
      <span className="m-cover-grid" />
      <span className="m-cover-glyph">{glyph}</span>
      {playing && (
        <span className="m-cover-bars" aria-label="Now playing">
          <i /><i /><i />
        </span>
      )}
    </span>
  )
}
