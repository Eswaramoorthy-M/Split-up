import { CSSProperties } from 'react'
import clsx from 'clsx'
import type { RepeatMode, Track } from '../types'
import { formatTime } from '../utils'
import { Cover } from './Cover'
import { MusicIcon } from './MusicIcon'

interface Props {
  track: Track
  playing: boolean
  progress: number
  volume: number
  liked: boolean
  shuffle: boolean
  repeat: RepeatMode
  queueCount: number
  onToggle: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (value: number) => void
  onVolume: (value: number) => void
  onLike: () => void
  onShuffle: () => void
  onRepeat: () => void
  onOpenNowPlaying: () => void
  onOpenQueue: () => void
}

export function PlayerBar({
  track, playing, progress, volume, liked, shuffle, repeat, queueCount,
  onToggle, onNext, onPrev, onSeek, onVolume, onLike, onShuffle, onRepeat,
  onOpenNowPlaying, onOpenQueue
}: Props) {
  return (
    <footer className="m-player">
      <div className="m-player-track">
        <button className="m-player-cover" type="button" onClick={onOpenNowPlaying} aria-label="Open now playing">
          <Cover gradient={track.gradient} glyph={track.glyph} size="sm" playing={playing} />
        </button>
        <div className="m-player-copy">
          <strong>{track.title}</strong>
          <span>{track.artist}</span>
        </div>
        <button
          className={clsx('m-icon-btn m-player-like', liked && 'is-liked')}
          type="button"
          onClick={onLike}
          aria-label={liked ? 'Remove from liked songs' : 'Like this song'}
          aria-pressed={liked}
        >
          <MusicIcon name="heart" size={17} filled={liked} />
        </button>
      </div>

      <div className="m-player-center">
        <div className="m-player-buttons">
          <button className={clsx('m-icon-btn', shuffle && 'is-on')} type="button" onClick={onShuffle} aria-label="Shuffle" aria-pressed={shuffle}>
            <MusicIcon name="shuffle" size={17} />
          </button>
          <button className="m-icon-btn" type="button" onClick={onPrev} aria-label="Previous track">
            <MusicIcon name="skipBack" size={19} />
          </button>
          <button className="m-play-btn" type="button" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>
            <MusicIcon name={playing ? 'pause' : 'play'} size={19} />
          </button>
          <button className="m-icon-btn" type="button" onClick={onNext} aria-label="Next track">
            <MusicIcon name="skipForward" size={19} />
          </button>
          <button className={clsx('m-icon-btn', repeat !== 'off' && 'is-on')} type="button" onClick={onRepeat} aria-label={`Repeat: ${repeat}`}>
            <MusicIcon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={17} />
          </button>
        </div>
        <div className="m-player-progress">
          <span>{formatTime(progress)}</span>
          <input
            className="m-range"
            type="range"
            min={0}
            max={track.duration}
            value={Math.min(progress, track.duration)}
            onChange={event => onSeek(Number(event.target.value))}
            aria-label="Seek"
            style={{ '--range-fill': `${(progress / track.duration) * 100}%` } as CSSProperties}
          />
          <span>{formatTime(track.duration)}</span>
        </div>
      </div>

      <div className="m-player-right">
        <button className="m-icon-btn m-queue-btn" type="button" onClick={onOpenQueue} aria-label={`Open queue, ${queueCount} upcoming`}>
          <MusicIcon name="queue" size={18} />
          {queueCount > 0 && <small>{queueCount}</small>}
        </button>
        <button className="m-icon-btn" type="button" onClick={() => onVolume(volume > 0 ? 0 : 0.7)} aria-label={volume > 0 ? 'Mute' : 'Unmute'}>
          <MusicIcon name={volume > 0 ? 'volume' : 'volumeX'} size={18} />
        </button>
        <input
          className="m-range m-volume-range"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={event => onVolume(Number(event.target.value))}
          aria-label="Volume"
          style={{ '--range-fill': `${volume * 100}%` } as CSSProperties}
        />
      </div>
    </footer>
  )
}
