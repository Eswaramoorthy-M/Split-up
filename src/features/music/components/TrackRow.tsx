import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { Track } from '../types'
import { formatTime } from '../utils'
import { Cover } from './Cover'
import { MusicIcon } from './MusicIcon'

interface Props {
  track: Track
  index: number
  active: boolean
  playing: boolean
  liked: boolean
  onPlay: () => void
  onLike: () => void
  onQueue: () => void
  onAddToPlaylist: () => void
}

export function TrackRow({ track, index, active, playing, liked, onPlay, onLike, onQueue, onAddToPlaylist }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return (
    <div className={clsx('m-track-row', active && 'is-active')}>
      <button className="m-track-index" type="button" onClick={onPlay} aria-label={`Play ${track.title}`}>
        <span className="m-track-number">{index + 1}</span>
        <MusicIcon name={active && playing ? 'wave' : 'play'} size={15} className="m-track-play-icon" />
      </button>
      <button className="m-track-main" type="button" onClick={onPlay}>
        <Cover gradient={track.gradient} glyph={track.glyph} size="xs" playing={active && playing} />
        <span className="m-track-copy">
          <strong>{track.title}</strong>
          <span>{track.artist}</span>
        </span>
      </button>
      <span className="m-track-album">{track.album}</span>
      <button
        className={clsx('m-icon-btn m-track-like', liked && 'is-liked')}
        type="button"
        onClick={onLike}
        aria-label={liked ? `Remove ${track.title} from liked songs` : `Like ${track.title}`}
        aria-pressed={liked}
      >
        <MusicIcon name="heart" size={17} filled={liked} />
      </button>
      <span className="m-track-time">{formatTime(track.duration)}</span>
      <div className="m-track-menu-wrap" ref={menuRef}>
        <button
          className="m-icon-btn"
          type="button"
          onClick={() => setMenuOpen(open => !open)}
          aria-label={`More options for ${track.title}`}
          aria-expanded={menuOpen}
        >
          <MusicIcon name="more" size={18} />
        </button>
        {menuOpen && (
          <div className="m-track-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { onQueue(); setMenuOpen(false) }}>
              <MusicIcon name="queue" size={15} /> Add to queue
            </button>
            <button type="button" role="menuitem" onClick={() => { onAddToPlaylist(); setMenuOpen(false) }}>
              <MusicIcon name="plus" size={15} /> Add to playlist
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
