import type { Playlist } from '../types'
import { Cover } from './Cover'
import { MusicIcon } from './MusicIcon'

interface Props {
  playlist: Playlist
  onOpen: () => void
  onPlay: () => void
}

export function PlaylistCard({ playlist, onOpen, onPlay }: Props) {
  return (
    <div className="m-playlist-card">
      <div className="m-playlist-art">
        <Cover gradient={playlist.gradient} glyph={playlist.glyph} size="md" />
        <button
          className="m-playlist-open"
          type="button"
          onClick={onOpen}
          aria-label={`Open ${playlist.name}`}
        />
        <button
          className="m-playlist-play"
          type="button"
          onClick={onPlay}
          aria-label={`Play ${playlist.name}`}
        >
          <MusicIcon name="play" size={18} />
        </button>
      </div>
      <button className="m-playlist-copy" type="button" onClick={onOpen}>
        <strong>{playlist.name}</strong>
        <span>{playlist.description}</span>
      </button>
    </div>
  )
}
