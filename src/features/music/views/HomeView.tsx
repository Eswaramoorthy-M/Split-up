import type { Playlist, Track } from '../types'
import { greeting } from '../utils'
import { Cover } from '../components/Cover'
import { MusicIcon } from '../components/MusicIcon'
import { PlaylistCard } from '../components/PlaylistCard'
import { TrackCard } from '../components/TrackCard'

interface Props {
  tracks: Track[]
  playlists: Playlist[]
  currentId: string
  playing: boolean
  onPlayTrack: (track: Track, context: Track[]) => void
  onPlayPlaylist: (playlist: Playlist) => void
  onOpenPlaylist: (id: string) => void
  onNavigateSearch: () => void
}

export function HomeView({
  tracks, playlists, currentId, playing, onPlayTrack, onPlayPlaylist, onOpenPlaylist, onNavigateSearch
}: Props) {
  const featured = playlists.find(p => p.id === 'night-drive') ?? playlists[0]
  const quickPicks = [tracks[0], tracks[4], tracks[7], tracks[8], tracks[2], tracks[3]].filter(Boolean) as Track[]
  const madeForYou = [tracks[1], tracks[5], tracks[10], tracks[12], tracks[6]]
  const chill = [tracks[3], tracks[9], tracks[11], tracks[13], tracks[2]]

  return (
    <div className="m-view m-home-view">
      <section className="m-home-hero">
        <div>
          <p className="m-eyebrow">{greeting()}</p>
          <h1>Your sound, your space.</h1>
          <p className="m-home-sub">Pick up where you left off or find something new to lose yourself in.</p>
          <div className="m-home-hero-actions">
            <button className="m-btn m-btn-primary" type="button" onClick={() => onPlayPlaylist(featured)}>
              <MusicIcon name="play" size={17} /> Play featured mix
            </button>
            <button className="m-btn m-btn-ghost" type="button" onClick={onNavigateSearch}>
              <MusicIcon name="search" size={17} /> Explore
            </button>
          </div>
        </div>
        <div className="m-home-hero-art" aria-hidden="true">
          <span className="m-hero-ring m-hero-ring-a" />
          <span className="m-hero-ring m-hero-ring-b" />
          <Cover gradient={featured.gradient} glyph={featured.glyph} size="lg" />
        </div>
      </section>

      <section className="m-section">
        <div className="m-section-head">
          <div><p className="m-eyebrow">Start here</p><h2>Quick picks</h2></div>
        </div>
        <div className="m-quick-grid">
          {quickPicks.map(track => (
            <button
              key={track.id}
              className="m-quick-card"
              type="button"
              onClick={() => onPlayTrack(track, quickPicks)}
              style={{ background: `linear-gradient(135deg, ${track.gradient[0]}, ${track.gradient[1]} 60%, ${track.gradient[2]})` }}
            >
              <span>{track.title}</span>
              <span className="m-quick-play"><MusicIcon name="play" size={16} /></span>
              <span className="m-quick-shape" />
            </button>
          ))}
        </div>
      </section>

      <section className="m-section">
        <div className="m-section-head">
          <div><p className="m-eyebrow">Curated for you</p><h2>Made for your mood</h2></div>
          <button type="button" onClick={() => onOpenPlaylist(featured.id)}>See all <MusicIcon name="chevronRight" size={14} /></button>
        </div>
        <div className="m-card-grid">
          {madeForYou.map(track => (
            <TrackCard
              key={track.id}
              track={track}
              active={currentId === track.id}
              playing={playing}
              onPlay={() => onPlayTrack(track, madeForYou)}
            />
          ))}
        </div>
      </section>

      <section className="m-section">
        <div className="m-section-head">
          <div><p className="m-eyebrow">Collections</p><h2>Playlists that fit</h2></div>
        </div>
        <div className="m-playlist-grid">
          {playlists.slice(0, 4).map(playlist => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onOpen={() => onOpenPlaylist(playlist.id)}
              onPlay={() => onPlayPlaylist(playlist)}
            />
          ))}
        </div>
      </section>

      <section className="m-section">
        <div className="m-section-head">
          <div><p className="m-eyebrow">Take it easy</p><h2>Slow it down</h2></div>
        </div>
        <div className="m-card-grid">
          {chill.map(track => (
            <TrackCard
              key={track.id}
              track={track}
              active={currentId === track.id}
              playing={playing}
              onPlay={() => onPlayTrack(track, chill)}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
