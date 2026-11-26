import clsx from 'clsx'
import type { Playlist, View } from '../types'
import { MusicIcon } from './MusicIcon'

interface Props {
  view: View
  playlists: Playlist[]
  likedCount: number
  onNavigate: (view: View) => void
  onOpenLiked: () => void
  onOpenPlaylist: (id: string) => void
  onCreatePlaylist: () => void
}

const NAV: Array<{ view: View; label: string; icon: string }> = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'search', label: 'Search', icon: 'search' },
  { view: 'library', label: 'Your library', icon: 'library' }
]

export function Sidebar({ view, playlists, likedCount, onNavigate, onOpenLiked, onOpenPlaylist, onCreatePlaylist }: Props) {
  return (
    <aside className="m-sidebar">
      <button className="m-brand" type="button" onClick={() => onNavigate('home')}>
        <span className="m-brand-mark"><MusicIcon name="wave" size={22} strokeWidth={2.2} /></span>
        <span>resonance</span>
      </button>

      <nav className="m-nav" aria-label="Main navigation">
        {NAV.map(item => (
          <button
            key={item.view}
            type="button"
            className={clsx('m-nav-item', view === item.view && 'is-active')}
            onClick={() => onNavigate(item.view)}
          >
            <MusicIcon name={item.icon} size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="m-sidebar-section">
        <div className="m-sidebar-heading">
          <span>Your playlists</span>
          <button type="button" onClick={onCreatePlaylist} aria-label="Create playlist">
            <MusicIcon name="plus" size={17} />
          </button>
        </div>
        <button className="m-sidebar-playlist is-liked" type="button" onClick={onOpenLiked}>
          <span className="m-liked-mark"><MusicIcon name="heart" size={15} filled /></span>
          <span>Liked songs</span>
          <small>{likedCount}</small>
        </button>
        {playlists.slice(0, 6).map(playlist => (
          <button
            key={playlist.id}
            type="button"
            className="m-sidebar-playlist"
            onClick={() => onOpenPlaylist(playlist.id)}
          >
            <span className="m-sidebar-dot" style={{ background: playlist.gradient[0] }} />
            <span>{playlist.name}</span>
          </button>
        ))}
      </div>

      <div className="m-sidebar-foot">
        <span className="m-user-avatar">EV</span>
        <span className="m-user-copy"><strong>Eswar</strong><small>Free plan</small></span>
        <MusicIcon name="more" size={18} />
      </div>
    </aside>
  )
}
