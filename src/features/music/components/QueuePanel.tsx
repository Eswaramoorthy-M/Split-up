import type { Track } from '../types'
import { Cover } from './Cover'
import { MusicIcon } from './MusicIcon'

interface Props {
  current: Track
  playing: boolean
  queue: Track[]
  onPlay: (track: Track) => void
  onRemove: (id: string) => void
  onClear: () => void
  onClose: () => void
}

export function QueuePanel({ current, playing, queue, onPlay, onRemove, onClear, onClose }: Props) {
  return (
    <aside className="m-queue">
      <div className="m-queue-head">
        <div>
          <p className="m-eyebrow">Up next</p>
          <h2>Queue</h2>
        </div>
        <button className="m-icon-btn" type="button" onClick={onClose} aria-label="Close queue">
          <MusicIcon name="x" size={18} />
        </button>
      </div>

      <div className="m-queue-current">
        <Cover gradient={current.gradient} glyph={current.glyph} size="sm" playing={playing} />
        <div>
          <span>Now playing</span>
          <strong>{current.title}</strong>
          <small>{current.artist}</small>
        </div>
      </div>

      <div className="m-queue-subhead">
        <span>Next in queue</span>
        {queue.length > 0 && <button type="button" onClick={onClear}>Clear</button>}
      </div>

      {queue.length === 0 ? (
        <div className="m-queue-empty">
          <MusicIcon name="queue" size={26} />
          <strong>Your queue is clear</strong>
          <span>Add songs from any track menu and they’ll appear here.</span>
        </div>
      ) : (
        <div className="m-queue-list">
          {queue.map((track, index) => (
            <div className="m-queue-row" key={`${track.id}-${index}`}>
              <button type="button" onClick={() => onPlay(track)}>
                <Cover gradient={track.gradient} glyph={track.glyph} size="xs" />
                <span>
                  <strong>{track.title}</strong>
                  <small>{track.artist}</small>
                </span>
              </button>
              <button type="button" className="m-icon-btn" onClick={() => onRemove(track.id)} aria-label={`Remove ${track.title}`}>
                <MusicIcon name="x" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}
