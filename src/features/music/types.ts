export type View = 'home' | 'search' | 'library' | 'playlist'

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  genre: string
  year: number
  plays: string
  gradient: [string, string, string]
  glyph: string
  seed: number
  tempo: number
}

export interface Playlist {
  id: string
  name: string
  description: string
  trackIds: string[]
  gradient: [string, string, string]
  glyph: string
  custom?: boolean
}

export type RepeatMode = 'off' | 'all' | 'one'
