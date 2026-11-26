import type { Playlist, Track } from '../types'
import { Cover } from '../components/Cover'
import { MusicIcon } from '../components/MusicIcon'
import { TrackRow } from '../components/TrackRow'

interface Props {
  playlist: Playlist
  tracks: Track[]
  currentId: string
  playing: boolean
  likedIds: Set<string>
  onPlayPlaylist: () => void
  onShufflePlaylist: () => void
  onPlayTrack: (track: Track, context: Track[]) => void
  onLike: (id: string) => void
  onQueue: (track: Track) => void
  onAddToPlaylist: (track: Track) => void
  onRemove: (id: string) => void
}

export function PlaylistView({
  playlist, tracks, currentId, playing, likedIds,
  onPlayPlaylist, onShufflePlaylist, onPlayTrack, onLike, onQueue, onAddToPlaylist, onRemove
}: Props) {
  const duration = tracks.reduce((sum, track) => sum + track.duration, 0)
  const hours = Math.floor(duration / 3600)
  const minutes = Math.round((duration % 3600) / 60)

  return (
    <div className="m-view m-playlist-view">
      <header className="m-playlist-hero" style={{ background: `linear-gradient(160deg, ${playlist.gradient[0]}, ${playlist.gradient[2]})` }}>
        <Cover gradient={playlist.gradient} glyph={playlist.glyph} size="lg" />
        <div className="m-playlist-hero-copy">
          <p className="m-eyebrow">{playlist.custom ? 'Your playlist' : 'Curated playlist'}</p>
          <h1>{playlist.name}</h1>
          <p>{playlist.description}</p>
          <span>resonance · {tracks.length} songs · {hours > 0 ? `${hours} hr ` : ''}{minutes} min</span>
        </div>
      </header>

      <div className="m-playlist-actions">
        <button className="m-btn m-btn-primary" type="button" onClick={onPlayPlaylist}>
          <MusicIcon name="play" size={18} /> Play
        </button>
        <button className="m-btn m-btn-ghost" type="button" onClick={onShufflePlaylist}>
          <MusicIcon name="shuffle" size={17} /> Shuffle
        </button>
      </div>

      {tracks.length === 0 ? (
        <div className="m-library-empty">
          <MusicIcon name="music" size={30} />
          <strong>This playlist is empty</strong>
          <span>Use the track menu to add songs here.</span>
        </div>
      ) : (
        <div className="m-track-list">
          <div className="m-track-list-head">
            <span>#</span><span>Title</span><span>Album</span><span /><span>Time</span><span />
          </div>
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              active={currentId === track.id}
              playing={playing}
              liked={likedIds.has(track.id)}
              onPlay={() => onPlayTrack(track, tracks)}
              onLike={() => onLike(track.id)}
              onQueue={() => onQueue(track)}
              onAddToPlaylist={() => onAddToPlaylist(track)}
            />
          ))}
        </div>
      )}

      {playlist.custom && (
        <button className="m-remove-playlist" type="button" onClick={() => onRemove(playlist.id)}>
          <MusicIcon name="trash" size={16} /> Delete playlist
        </button>
      )}
    </div>
  )
}
