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
  onClose: () => void
  onToggle: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (value: number) => void
  onVolume: (value: number) => void
  onLike: () => void
  onShuffle: () => void
  onRepeat: () => void
  onOpenQueue: () => void
}

export function NowPlaying({
  track, playing, progress, volume, liked, shuffle, repeat, queueCount,
  onClose, onToggle, onNext, onPrev, onSeek, onVolume, onLike, onShuffle, onRepeat, onOpenQueue
}: Props) {
  return (
    <div className="m-now-overlay" role="dialog" aria-modal="true" aria-label="Now playing">
      <div className="m-now-blur" style={{ backgroundImage: `linear-gradient(140deg, ${track.gradient[0]}, ${track.gradient[2]})` }} />
      <div className="m-now-top">
        <button className="m-icon-btn" type="button" onClick={onClose} aria-label="Close now playing">
          <MusicIcon name="chevronDown" size={22} />
        </button>
        <div>
          <p className="m-eyebrow">Playing from {track.album}</p>
          <strong>Now playing</strong>
        </div>
        <button className="m-icon-btn" type="button" onClick={onOpenQueue} aria-label="Open queue">
          <MusicIcon name="queue" size={20} />
          {queueCount > 0 && <small className="m-now-queue-count">{queueCount}</small>}
        </button>
      </div>

      <div className="m-now-body">
        <div className="m-now-art-wrap">
          <Cover gradient={track.gradient} glyph={track.glyph} size="xl" playing={playing} />
          <div className="m-now-glow" />
        </div>

        <div className="m-now-info">
          <div className="m-now-title-row">
            <div>
              <h1>{track.title}</h1>
              <p>{track.artist} · {track.album} · {track.year}</p>
            </div>
            <button
              className={clsx('m-icon-btn m-now-heart', liked && 'is-liked')}
              type="button"
              onClick={onLike}
              aria-label={liked ? 'Unlike' : 'Like'}
              aria-pressed={liked}
            >
              <MusicIcon name="heart" size={23} filled={liked} />
            </button>
          </div>

          <div className="m-now-progress">
            <input
              className="m-range m-now-range"
              type="range"
              min={0}
              max={track.duration}
              value={Math.min(progress, track.duration)}
              onChange={event => onSeek(Number(event.target.value))}
              aria-label="Seek"
              style={{ '--range-fill': `${(progress / track.duration) * 100}%` } as CSSProperties}
            />
            <div><span>{formatTime(progress)}</span><span>-{formatTime(track.duration - progress)}</span></div>
          </div>

          <div className="m-now-controls">
            <button className={clsx('m-icon-btn', shuffle && 'is-on')} type="button" onClick={onShuffle} aria-label="Shuffle">
              <MusicIcon name="shuffle" size={20} />
            </button>
            <button className="m-now-skip" type="button" onClick={onPrev} aria-label="Previous track">
              <MusicIcon name="skipBack" size={27} />
            </button>
            <button className="m-now-play" type="button" onClick={onToggle} aria-label={playing ? 'Pause' : 'Play'}>
              <MusicIcon name={playing ? 'pause' : 'play'} size={28} />
            </button>
            <button className="m-now-skip" type="button" onClick={onNext} aria-label="Next track">
              <MusicIcon name="skipForward" size={27} />
            </button>
            <button className={clsx('m-icon-btn', repeat !== 'off' && 'is-on')} type="button" onClick={onRepeat} aria-label={`Repeat: ${repeat}`}>
              <MusicIcon name={repeat === 'one' ? 'repeatOne' : 'repeat'} size={20} />
            </button>
          </div>

          <div className="m-now-volume">
            <MusicIcon name={volume > 0 ? 'volume' : 'volumeX'} size={18} />
            <input
              className="m-range"
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
        </div>
      </div>
    </div>
  )
}
