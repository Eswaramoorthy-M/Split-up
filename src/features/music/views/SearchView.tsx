import clsx from 'clsx'
import { GENRES, GENRE_GRADIENTS } from '../data'
import type { Playlist, Track } from '../types'
import { Cover } from '../components/Cover'
import { MusicIcon } from '../components/MusicIcon'
import { PlaylistCard } from '../components/PlaylistCard'
import { TrackRow } from '../components/TrackRow'

interface Props {
  query: string
  onQuery: (value: string) => void
  tracks: Track[]
  playlists: Playlist[]
  currentId: string
  playing: boolean
  likedIds: Set<string>
  onPlayTrack: (track: Track, context: Track[]) => void
  onLike: (id: string) => void
  onQueue: (track: Track) => void
  onAddToPlaylist: (track: Track) => void
  onOpenPlaylist: (id: string) => void
  onPlayPlaylist: (playlist: Playlist) => void
}

export function SearchView({
  query, onQuery, tracks, playlists, currentId, playing, likedIds,
  onPlayTrack, onLike, onQueue, onAddToPlaylist, onOpenPlaylist, onPlayPlaylist
}: Props) {
  const normalized = query.trim().toLowerCase()
  const trackResults = normalized
    ? tracks.filter(track => [track.title, track.artist, track.album, track.genre].some(value => value.toLowerCase().includes(normalized)))
    : []
  const playlistResults = normalized
    ? playlists.filter(playlist => [playlist.name, playlist.description].some(value => value.toLowerCase().includes(normalized)))
    : []
  const top = trackResults[0]
  const hasResults = trackResults.length > 0 || playlistResults.length > 0

  return (
    <div className="m-view m-search-view">
      <div className="m-search-bar">
        <MusicIcon name="search" size={21} />
        <input
          value={query}
          onChange={event => onQuery(event.target.value)}
          placeholder="Songs, artists, playlists or moods"
          autoFocus
          aria-label="Search music"
        />
        {query && <button type="button" onClick={() => onQuery('')} aria-label="Clear search"><MusicIcon name="x" size={17} /></button>}
      </div>

      {!normalized ? (
        <>
          <section className="m-section">
            <div className="m-section-head"><div><p className="m-eyebrow">Browse all</p><h2>Find your frequency</h2></div></div>
            <div className="m-genre-grid">
              {GENRES.map((genre, index) => (
                <button
                  key={genre}
                  type="button"
                  className="m-genre-card"
                  style={{ background: `linear-gradient(135deg, ${GENRE_GRADIENTS[genre][0]}, ${GENRE_GRADIENTS[genre][2]})` }}
                  onClick={() => onQuery(genre)}
                >
                  <strong>{genre}</strong>
                  <span className="m-genre-blob" style={{ background: GENRE_GRADIENTS[genre][1] }} />
                  <small>{tracks.filter(track => track.genre === genre).length} tracks</small>
                </button>
              ))}
            </div>
          </section>
          <section className="m-section">
            <div className="m-section-head"><div><p className="m-eyebrow">Popular collections</p><h2>Start with a playlist</h2></div></div>
            <div className="m-playlist-grid">
              {playlists.slice(0, 4).map(playlist => (
                <PlaylistCard key={playlist.id} playlist={playlist} onOpen={() => onOpenPlaylist(playlist.id)} onPlay={() => onPlayPlaylist(playlist)} />
              ))}
            </div>
          </section>
        </>
      ) : !hasResults ? (
        <div className="m-no-results">
          <MusicIcon name="search" size={30} />
          <h2>No matches for “{query}”</h2>
          <p>Try an artist, album, mood, or a different spelling.</p>
          <button className="m-btn m-btn-primary" type="button" onClick={() => onQuery('')}>Clear search</button>
        </div>
      ) : (
        <>
          {top && (
            <section className="m-section">
              <div className="m-section-head"><div><p className="m-eyebrow">Best match</p><h2>Top result</h2></div></div>
              <button className="m-top-result" type="button" onClick={() => onPlayTrack(top, trackResults)}>
                <Cover gradient={top.gradient} glyph={top.glyph} size="lg" playing={currentId === top.id && playing} />
                <span className="m-top-result-label">Song</span>
                <strong>{top.title}</strong>
                <span>{top.artist}</span>
                <span className="m-top-result-play"><MusicIcon name="play" size={19} /></span>
              </button>
            </section>
          )}

          {trackResults.length > 0 && (
            <section className="m-section">
              <div className="m-section-head"><div><p className="m-eyebrow">{trackResults.length} found</p><h2>Songs</h2></div></div>
              <div className="m-track-list">
                <div className="m-track-list-head">
                  <span>#</span><span>Title</span><span>Album</span><span /><span>Time</span><span />
                </div>
                {trackResults.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index}
                    active={currentId === track.id}
                    playing={playing}
                    liked={likedIds.has(track.id)}
                    onPlay={() => onPlayTrack(track, trackResults)}
                    onLike={() => onLike(track.id)}
                    onQueue={() => onQueue(track)}
                    onAddToPlaylist={() => onAddToPlaylist(track)}
                  />
                ))}
              </div>
            </section>
          )}

          {playlistResults.length > 0 && (
            <section className="m-section">
              <div className="m-section-head"><div><p className="m-eyebrow">{playlistResults.length} found</p><h2>Playlists</h2></div></div>
              <div className="m-playlist-grid">
                {playlistResults.map(playlist => (
                  <PlaylistCard key={playlist.id} playlist={playlist} onOpen={() => onOpenPlaylist(playlist.id)} onPlay={() => onPlayPlaylist(playlist)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div className={clsx('m-search-tip', normalized && 'is-hidden')}>Tip: press <kbd>⌘ K</kbd> anywhere to jump here.</div>
    </div>
  )
}
