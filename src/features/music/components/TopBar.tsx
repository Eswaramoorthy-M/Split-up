import { MusicIcon } from './MusicIcon'

interface Props {
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  onOpenSearch: () => void
  onOpenQueue: () => void
  onOpenNowPlaying: () => void
}

export function TopBar({ canGoBack, canGoForward, onBack, onForward, onOpenSearch, onOpenQueue, onOpenNowPlaying }: Props) {
  return (
    <header className="m-topbar">
      <div className="m-topbar-nav">
        <button type="button" onClick={onBack} disabled={!canGoBack} aria-label="Go back">
          <MusicIcon name="chevronLeft" size={20} />
        </button>
        <button type="button" onClick={onForward} disabled={!canGoForward} aria-label="Go forward">
          <MusicIcon name="chevronRight" size={20} />
        </button>
      </div>
      <div className="m-topbar-search" onClick={onOpenSearch} role="search" tabIndex={0} onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenSearch() }
      }}>
        <MusicIcon name="search" size={18} />
        <span>What do you want to listen to?</span>
        <kbd>⌘ K</kbd>
      </div>
      <div className="m-topbar-actions">
        <button type="button" onClick={onOpenQueue} aria-label="Open queue">
          <MusicIcon name="queue" size={19} />
        </button>
        <button type="button" onClick={onOpenNowPlaying} aria-label="Open now playing">
          <MusicIcon name="maximize" size={18} />
        </button>
        <button className="m-topbar-avatar" type="button" aria-label="Your profile">EV</button>
      </div>
    </header>
  )
}
