import clsx from 'clsx'
import type { Playlist, Track } from '../types'
import { Cover } from '../components/Cover'
import { MusicIcon } from '../components/MusicIcon'
import { PlaylistCard } from '../components/PlaylistCard'
import { TrackRow } from '../components/TrackRow'

export type LibraryTab = 'all' | 'playlists' | 'liked' | 'recent'

interface Props {
  tab: LibraryTab
  onTab: (tab: LibraryTab) => void
  playlists: Playlist[]
  likedTracks: Track[]
  recentTracks: Track[]
  currentId: string
  playing: boolean
  likedIds: Set<string>
  onCreatePlaylist: () => void
  onOpenPlaylist: (id: string) => void
  onPlayPlaylist: (playlist: Playlist) => void
  onPlayTrack: (track: Track, context: Track[]) => void
  onLike: (id: string) => void
  onQueue: (track: Track) => void
  onAddToPlaylist: (track: Track) => void
}

const TABS: Array<{ id: LibraryTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'liked', label: 'Liked' },
  { id: 'recent', label: 'Recent' }
]

export function LibraryView({
  tab, onTab, playlists, likedTracks, recentTracks, currentId, playing, likedIds,
  onCreatePlaylist, onOpenPlaylist, onPlayPlaylist, onPlayTrack, onLike, onQueue, onAddToPlaylist
}: Props) {
  const showPlaylists = tab === 'all' || tab === 'playlists'
  const trackList = tab === 'liked' ? likedTracks : recentTracks
  const showTracks = tab === 'liked' || tab === 'recent' || tab === 'all'

  const renderTracks = (tracks: Track[], title: string) => (
    <section className="m-section">
      <div className="m-section-head">
        <div><p className="m-eyebrow">{tracks.length} songs</p><h2>{title}</h2></div>
        {tracks.length > 0 && (
          <button type="button" onClick={() => onPlayTrack(tracks[0], tracks)}>
            <MusicIcon name="play" size={14} /> Play all
          </button>
        )}
      </div>
      {tracks.length === 0 ? (
        <div className="m-library-empty">
          <MusicIcon name={tab === 'liked' ? 'heart' : 'clock'} size={28} />
          <strong>{tab === 'liked' ? 'No liked songs yet' : 'Nothing played recently'}</strong>
          <span>{tab === 'liked' ? 'Tap the heart on a track to save it here.' : 'Songs you play will show up here.'}</span>
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
    </section>
  )

  return (
    <div className="m-view m-library-view">
      <div className="m-library-head">
        <div>
          <p className="m-eyebrow">Collection</p>
          <h1>Your library</h1>
        </div>
        <button className="m-btn m-btn-primary" type="button" onClick={onCreatePlaylist}>
          <MusicIcon name="plus" size={17} /> New playlist
        </button>
      </div>

      <div className="m-tabs" role="tablist" aria-label="Library filters">
        {TABS.map(item => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={clsx(tab === item.id && 'is-active')}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {showPlaylists && (
        <section className="m-section">
          <div className="m-section-head">
            <div><p className="m-eyebrow">{playlists.length} playlists</p><h2>Made by you</h2></div>
          </div>
          <div className="m-playlist-grid">
            {playlists.map(playlist => (
              <PlaylistCard
                key={playlist.id}
                playlist={playlist}
                onOpen={() => onOpenPlaylist(playlist.id)}
                onPlay={() => onPlayPlaylist(playlist)}
              />
            ))}
            <button className="m-new-playlist-card" type="button" onClick={onCreatePlaylist}>
              <span><MusicIcon name="plus" size={22} /></span>
              <strong>Create a playlist</strong>
            </button>
          </div>
        </section>
      )}

      {showTracks && renderTracks(tab === 'recent' ? recentTracks : likedTracks, tab === 'recent' ? 'Recently played' : 'Liked songs')}

      {tab === 'all' && likedTracks.length === 0 && (
        <div className="m-library-hint">
          <Cover gradient={['#7C3AED', '#2563EB', '#22D3EE']} glyph="✦" size="xs" />
          <span>Heart a song and it will appear in your library.</span>
        </div>
      )}
    </div>
  )
}
