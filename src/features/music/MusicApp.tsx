import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { DEFAULT_PLAYLISTS, TRACKS } from './data'
import { MusicAudioEngine } from './audioEngine'
import type { Playlist, RepeatMode, Track, View } from './types'
import { shuffled, trackById } from './utils'
import { CreatePlaylistModal, AddToPlaylistModal } from './components/PlaylistModals'
import { MusicIcon } from './components/MusicIcon'
import { NowPlaying } from './components/NowPlaying'
import { PlayerBar } from './components/PlayerBar'
import { QueuePanel } from './components/QueuePanel'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { HomeView } from './views/HomeView'
import { LibraryView, type LibraryTab } from './views/LibraryView'
import { PlaylistView } from './views/PlaylistView'
import { SearchView } from './views/SearchView'

interface NavEntry {
  view: View
  playlistId?: string
}

const LIKES_KEY = 'resonance-likes'
const PLAYLISTS_KEY = 'resonance-playlists'
const RECENT_KEY = 'resonance-recent'

function loadIds(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    const value: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(PLAYLISTS_KEY)
    const value: unknown = raw ? JSON.parse(raw) : []
    const custom = Array.isArray(value) ? value.filter((item): item is Playlist => !!item && typeof item === 'object' && item.custom === true) : []
    return [...DEFAULT_PLAYLISTS, ...custom]
  } catch {
    return [...DEFAULT_PLAYLISTS]
  }
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const value: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 12) : []
  } catch {
    return []
  }
}

export default function MusicApp() {
  const [view, setView] = useState<View>('home')
  const [navHistory, setNavHistory] = useState<NavEntry[]>([{ view: 'home' }])
  const [navIndex, setNavIndex] = useState(0)
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(DEFAULT_PLAYLISTS[0].id)
  const [query, setQuery] = useState('')
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('all')

  const [likedIds, setLikedIds] = useState<Set<string>>(() => loadIds(LIKES_KEY))
  const [playlists, setPlaylists] = useState<Playlist[]>(loadPlaylists)
  const [recentIds, setRecentIds] = useState<string[]>(loadRecent)

  const [currentId, setCurrentId] = useState(TRACKS[0].id)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState(0.7)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [queue, setQueue] = useState<Track[]>([])
  const [trackHistory, setTrackHistory] = useState<string[]>([])
  const [contextIds, setContextIds] = useState<string[]>(TRACKS.map(track => track.id))

  const [queueOpen, setQueueOpen] = useState(false)
  const [nowOpen, setNowOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [addTarget, setAddTarget] = useState<Track | null>(null)

  const engineRef = useRef<MusicAudioEngine | null>(null)
  if (!engineRef.current) engineRef.current = new MusicAudioEngine()

  const current = trackById(currentId, TRACKS) ?? TRACKS[0]
  const selectedPlaylist = playlists.find(playlist => playlist.id === selectedPlaylistId) ?? playlists[0]
  const playlistTracks = useMemo(
    () => selectedPlaylist.trackIds.map(id => trackById(id, TRACKS)).filter((track): track is Track => !!track),
    [selectedPlaylist]
  )
  const likedTracks = useMemo(() => TRACKS.filter(track => likedIds.has(track.id)), [likedIds])
  const recentTracks = useMemo(
    () => recentIds.map(id => trackById(id, TRACKS)).filter((track): track is Track => !!track),
    [recentIds]
  )

  useEffect(() => {
    try { localStorage.setItem(LIKES_KEY, JSON.stringify([...likedIds])) } catch { /* storage unavailable */ }
  }, [likedIds])
  useEffect(() => {
    try { localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists.filter(playlist => playlist.custom))) } catch { /* storage unavailable */ }
  }, [playlists])
  useEffect(() => {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentIds)) } catch { /* storage unavailable */ }
  }, [recentIds])

  useEffect(() => () => engineRef.current?.dispose(), [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    if (!playing) { engine.stop(); return }
    void engine.start(current.seed, current.tempo, volume)
    // Volume is handled separately so dragging the slider does not restart the synth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, current.id, current.seed, current.tempo])

  useEffect(() => { engineRef.current?.setVolume(volume) }, [volume])

  const rememberTrack = useCallback((track: Track) => {
    setRecentIds(ids => [track.id, ...ids.filter(id => id !== track.id)].slice(0, 12))
  }, [])

  const startTracks = useCallback((tracks: Track[], useShuffle = shuffle) => {
    if (tracks.length === 0) return
    const ordered = useShuffle ? shuffled(tracks) : tracks
    setTrackHistory(history => currentId && currentId !== ordered[0].id ? [...history, currentId].slice(-30) : history)
    setContextIds(tracks.map(track => track.id))
    setCurrentId(ordered[0].id)
    setQueue(ordered.slice(1))
    setProgress(0)
    setPlaying(true)
    rememberTrack(ordered[0])
  }, [currentId, rememberTrack, shuffle])

  const playTrack = useCallback((track: Track, context: Track[] = TRACKS) => {
    const pool = context.length > 0 ? context : TRACKS
    const index = pool.findIndex(item => item.id === track.id)
    const rest = index >= 0 ? [...pool.slice(0, index), ...pool.slice(index + 1)] : pool.filter(item => item.id !== track.id)
    setTrackHistory(history => currentId && currentId !== track.id ? [...history, currentId].slice(-30) : history)
    setContextIds(pool.map(item => item.id))
    setCurrentId(track.id)
    setQueue(shuffle ? shuffled(rest) : rest)
    setProgress(0)
    setPlaying(true)
    rememberTrack(track)
  }, [currentId, rememberTrack, shuffle])

  const playPlaylist = useCallback((playlist: Playlist) => {
    const tracks = playlist.trackIds.map(id => trackById(id, TRACKS)).filter((track): track is Track => !!track)
    startTracks(tracks)
  }, [startTracks])

  const advance = useCallback((direction: 'next' | 'prev', ended = false) => {
    if (direction === 'prev') {
      if (progress > 3) { setProgress(0); return }
      const previous = trackHistory[trackHistory.length - 1]
      if (!previous) { setProgress(0); return }
      const track = trackById(previous, TRACKS)
      if (!track) { setProgress(0); return }
      setTrackHistory(history => history.slice(0, -1))
      setQueue(items => [current, ...items])
      setCurrentId(track.id)
      setProgress(0)
      rememberTrack(track)
      return
    }

    if (ended && repeat === 'one') { setProgress(0); return }

    if (queue.length > 0) {
      const [next, ...rest] = queue
      setTrackHistory(history => [...history, current.id].slice(-30))
      setCurrentId(next.id)
      setQueue(rest)
      setProgress(0)
      rememberTrack(next)
      return
    }

    const ids = contextIds.length > 0 ? contextIds : TRACKS.map(track => track.id)
    const index = ids.indexOf(current.id)
    const nextId = ids[(index + 1) % ids.length]
    const nextTrack = trackById(nextId, TRACKS)
    if (nextTrack && (repeat === 'all' || !ended)) {
      setTrackHistory(history => [...history, current.id].slice(-30))
      setCurrentId(nextTrack.id)
      setProgress(0)
      rememberTrack(nextTrack)
      return
    }

    if (ended) { setPlaying(false); setProgress(current.duration) }
  }, [contextIds, current, progress, queue, rememberTrack, repeat, trackHistory])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => {
      setProgress(value => Math.min(current.duration, value + 0.25))
    }, 250)
    return () => window.clearInterval(timer)
  }, [playing, current.duration])

  useEffect(() => {
    if (!playing) return
    if (progress >= current.duration) advance('next', true)
  }, [advance, current.duration, playing, progress])

  const togglePlay = useCallback(() => {
    if (!playing && progress >= current.duration) setProgress(0)
    setPlaying(value => !value)
  }, [current.duration, playing, progress])

  const toggleLike = useCallback((id: string) => {
    setLikedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const addToQueue = useCallback((track: Track) => {
    setQueue(items => [...items, track])
    setQueueOpen(true)
  }, [])

  const toggleShuffle = useCallback(() => {
    setShuffle(value => {
      if (!value) setQueue(items => shuffled(items))
      return !value
    })
  }, [])

  const cycleRepeat = useCallback(() => {
    setRepeat(value => value === 'off' ? 'all' : value === 'all' ? 'one' : 'off')
  }, [])

  const navigate = useCallback((next: View, playlistId?: string) => {
    if (playlistId) setSelectedPlaylistId(playlistId)
    setView(next)
    setNavHistory(previous => [...previous.slice(0, navIndex + 1), { view: next, playlistId }])
    setNavIndex(index => index + 1)
    setQueueOpen(false)
  }, [navIndex])

  const openPlaylist = useCallback((id: string) => navigate('playlist', id), [navigate])

  const goBack = useCallback(() => {
    if (navIndex === 0) return
    const index = navIndex - 1
    const entry = navHistory[index]
    setNavIndex(index)
    setView(entry.view)
    if (entry.playlistId) setSelectedPlaylistId(entry.playlistId)
  }, [navHistory, navIndex])

  const goForward = useCallback(() => {
    if (navIndex >= navHistory.length - 1) return
    const index = navIndex + 1
    const entry = navHistory[index]
    setNavIndex(index)
    setView(entry.view)
    if (entry.playlistId) setSelectedPlaylistId(entry.playlistId)
  }, [navHistory, navIndex])

  const openCreate = useCallback(() => {
    setAddTarget(null)
    setCreateOpen(true)
  }, [])

  const createPlaylist = useCallback((name: string, description: string) => {
    const id = `custom-${Date.now()}`
    const playlist: Playlist = {
      id,
      name,
      description: description || 'A fresh mix, ready for your favourite tracks.',
      trackIds: addTarget ? [addTarget.id] : [],
      gradient: ['#7C3AED', '#2563EB', '#22D3EE'],
      glyph: '♫',
      custom: true
    }
    setPlaylists(items => [...items, playlist])
    setCreateOpen(false)
    setAddTarget(null)
    setSelectedPlaylistId(id)
    setView('playlist')
    setNavHistory(previous => [...previous.slice(0, navIndex + 1), { view: 'playlist', playlistId: id }])
    setNavIndex(index => index + 1)
  }, [addTarget, navIndex])

  const toggleInPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists(items => items.map(playlist => {
      if (playlist.id !== playlistId) return playlist
      const added = playlist.trackIds.includes(trackId)
      return {
        ...playlist,
        trackIds: added ? playlist.trackIds.filter(id => id !== trackId) : [...playlist.trackIds, trackId]
      }
    }))
  }, [])

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(items => items.filter(playlist => playlist.id !== id))
    navigate('library')
  }, [navigate])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        navigate('search')
        return
      }
      if (typing || createOpen || addTarget || nowOpen) return
      if (event.code === 'Space') {
        event.preventDefault()
        togglePlay()
      } else if (event.key === 'ArrowRight') {
        setProgress(value => Math.min(current.duration, value + 5))
      } else if (event.key === 'ArrowLeft') {
        setProgress(value => Math.max(0, value - 5))
      } else if (event.key === 'Escape') {
        setQueueOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addTarget, createOpen, current.duration, navigate, nowOpen, togglePlay])

  const playerProps = {
    track: current,
    playing,
    progress,
    volume,
    liked: likedIds.has(current.id),
    shuffle,
    repeat,
    queueCount: queue.length,
    onToggle: togglePlay,
    onNext: () => advance('next'),
    onPrev: () => advance('prev'),
    onSeek: setProgress,
    onVolume: setVolume,
    onLike: () => toggleLike(current.id),
    onShuffle: toggleShuffle,
    onRepeat: cycleRepeat,
    onOpenNowPlaying: () => setNowOpen(true),
    onOpenQueue: () => setQueueOpen(true)
  }

  return (
    <div className="m-app">
      <div className={clsx('m-queue-backdrop', queueOpen && 'is-open')} onClick={() => setQueueOpen(false)} />
      <Sidebar
        view={view}
        playlists={playlists}
        likedCount={likedIds.size}
        onNavigate={navigate}
        onOpenLiked={() => { setLibraryTab('liked'); navigate('library') }}
        onOpenPlaylist={openPlaylist}
        onCreatePlaylist={openCreate}
      />

      <main className="m-main">
        <TopBar
          canGoBack={navIndex > 0}
          canGoForward={navIndex < navHistory.length - 1}
          onBack={goBack}
          onForward={goForward}
          onOpenSearch={() => navigate('search')}
          onOpenQueue={() => setQueueOpen(true)}
          onOpenNowPlaying={() => setNowOpen(true)}
        />
        <div className="m-scroll">
          {view === 'home' && (
            <HomeView
              key="home"
              tracks={TRACKS}
              playlists={playlists}
              currentId={current.id}
              playing={playing}
              onPlayTrack={playTrack}
              onPlayPlaylist={playPlaylist}
              onOpenPlaylist={openPlaylist}
              onNavigateSearch={() => navigate('search')}
            />
          )}
          {view === 'search' && (
            <SearchView
              key="search"
              query={query}
              onQuery={setQuery}
              tracks={TRACKS}
              playlists={playlists}
              currentId={current.id}
              playing={playing}
              likedIds={likedIds}
              onPlayTrack={playTrack}
              onLike={toggleLike}
              onQueue={addToQueue}
              onAddToPlaylist={setAddTarget}
              onOpenPlaylist={openPlaylist}
              onPlayPlaylist={playPlaylist}
            />
          )}
          {view === 'library' && (
            <LibraryView
              key="library"
              tab={libraryTab}
              onTab={setLibraryTab}
              playlists={playlists}
              likedTracks={likedTracks}
              recentTracks={recentTracks}
              currentId={current.id}
              playing={playing}
              likedIds={likedIds}
              onCreatePlaylist={openCreate}
              onOpenPlaylist={openPlaylist}
              onPlayPlaylist={playPlaylist}
              onPlayTrack={playTrack}
              onLike={toggleLike}
              onQueue={addToQueue}
              onAddToPlaylist={setAddTarget}
            />
          )}
          {view === 'playlist' && (
            <PlaylistView
              key={selectedPlaylist.id}
              playlist={selectedPlaylist}
              tracks={playlistTracks}
              currentId={current.id}
              playing={playing}
              likedIds={likedIds}
              onPlayPlaylist={() => playPlaylist(selectedPlaylist)}
              onShufflePlaylist={() => startTracks(playlistTracks, true)}
              onPlayTrack={playTrack}
              onLike={toggleLike}
              onQueue={addToQueue}
              onAddToPlaylist={setAddTarget}
              onRemove={deletePlaylist}
            />
          )}
        </div>
      </main>

      <div className={clsx('m-queue-shell', queueOpen && 'is-open')}>
        <QueuePanel
          current={current}
          playing={playing}
          queue={queue}
          onPlay={track => playTrack(track, [track, ...queue])}
          onRemove={id => setQueue(items => items.filter(item => item.id !== id))}
          onClear={() => setQueue([])}
          onClose={() => setQueueOpen(false)}
        />
      </div>

      <nav className="m-mobile-nav" aria-label="Mobile navigation">
        <button type="button" className={clsx(view === 'home' && 'is-active')} onClick={() => navigate('home')}>
          <MusicIcon name="home" size={21} /><span>Home</span>
        </button>
        <button type="button" className={clsx(view === 'search' && 'is-active')} onClick={() => navigate('search')}>
          <MusicIcon name="search" size={21} /><span>Search</span>
        </button>
        <button type="button" className={clsx(view === 'library' && 'is-active')} onClick={() => navigate('library')}>
          <MusicIcon name="library" size={21} /><span>Library</span>
        </button>
        <button type="button" className={clsx(queueOpen && 'is-active')} onClick={() => setQueueOpen(open => !open)}>
          <MusicIcon name="queue" size={21} /><span>Queue</span>
        </button>
      </nav>

      <PlayerBar {...playerProps} />

      {nowOpen && <NowPlaying {...playerProps} onClose={() => setNowOpen(false)} onOpenQueue={() => setQueueOpen(true)} />}
      {createOpen && <CreatePlaylistModal onClose={() => setCreateOpen(false)} onCreate={createPlaylist} />}
      {addTarget && !createOpen && (
        <AddToPlaylistModal
          track={addTarget}
          playlists={playlists}
          onClose={() => setAddTarget(null)}
          onToggle={playlistId => toggleInPlaylist(playlistId, addTarget.id)}
          onCreate={() => setCreateOpen(true)}
        />
      )}
    </div>
  )
}
