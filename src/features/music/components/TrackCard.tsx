import clsx from 'clsx'
import type { Track } from '../types'
import { Cover } from './Cover'
import { MusicIcon } from './MusicIcon'

interface Props {
  track: Track
  active: boolean
  playing: boolean
  onPlay: () => void
}

export function TrackCard({ track, active, playing, onPlay }: Props) {
  return (
    <button className={clsx('m-track-card', active && 'is-active')} type="button" onClick={onPlay}>
      <span className="m-track-card-art">
        <Cover gradient={track.gradient} glyph={track.glyph} size="md" playing={active && playing} />
        <span className="m-track-card-play"><MusicIcon name={active && playing ? 'pause' : 'play'} size={18} /></span>
      </span>
      <strong>{track.title}</strong>
      <span>{track.artist}</span>
    </button>
  )
}
