import type { Playlist, Track } from './types'

export const TRACKS: Track[] = [
  {
    id: 'neon-tide', title: 'Neon Tide', artist: 'Aster Vale', album: 'Afterglow', duration: 224,
    genre: 'Electronic', year: 2026, plays: '4.2M', gradient: ['#7C3AED', '#2563EB', '#22D3EE'], glyph: '≈', seed: 3, tempo: 104
  },
  {
    id: 'paper-moons', title: 'Paper Moons', artist: 'Lila North', album: 'Soft Geometry', duration: 198,
    genre: 'Indie', year: 2025, plays: '2.8M', gradient: ['#F472B6', '#A855F7', '#4F46E5'], glyph: '☾', seed: 7, tempo: 92
  },
  {
    id: 'slow-orbit', title: 'Slow Orbit', artist: 'Kairo Field', album: 'Gravity Rooms', duration: 251,
    genre: 'Ambient', year: 2026, plays: '1.6M', gradient: ['#0EA5E9', '#4338CA', '#111827'], glyph: '◌', seed: 11, tempo: 78
  },
  {
    id: 'coffee-rain', title: 'Coffee & Rain', artist: 'Milo Loop', album: 'Window Seat', duration: 176,
    genre: 'Lo-fi', year: 2024, plays: '8.9M', gradient: ['#F59E0B', '#EA580C', '#7C2D12'], glyph: '☂', seed: 5, tempo: 84
  },
  {
    id: 'velvet-hour', title: 'Velvet Hour', artist: 'Sora Bloom', album: 'Night Bloom', duration: 232,
    genre: 'R&B', year: 2025, plays: '3.4M', gradient: ['#EC4899', '#8B5CF6', '#312E81'], glyph: '✦', seed: 13, tempo: 96
  },
  {
    id: 'glass-highways', title: 'Glass Highways', artist: 'Northbound', album: 'Midnight Maps', duration: 209,
    genre: 'Electronic', year: 2026, plays: '5.1M', gradient: ['#06B6D4', '#3B82F6', '#1E1B4B'], glyph: '⌁', seed: 2, tempo: 118
  },
  {
    id: 'sunday-static', title: 'Sunday Static', artist: 'The Paper Kites Club', album: 'Soft Geometry', duration: 187,
    genre: 'Indie', year: 2025, plays: '1.2M', gradient: ['#84CC16', '#14B8A6', '#0F766E'], glyph: '✳', seed: 9, tempo: 100
  },
  {
    id: 'blue-hour', title: 'Blue Hour', artist: 'Aster Vale', album: 'Afterglow', duration: 243,
    genre: 'Chill', year: 2026, plays: '6.7M', gradient: ['#6366F1', '#0F172A', '#38BDF8'], glyph: '◒', seed: 4, tempo: 88
  },
  {
    id: 'ember', title: 'Ember', artist: 'Rubi Saint', album: 'Heat Signatures', duration: 215,
    genre: 'Pop', year: 2026, plays: '9.3M', gradient: ['#EF4444', '#F97316', '#FACC15'], glyph: '◆', seed: 15, tempo: 122
  },
  {
    id: 'quartz-sky', title: 'Quartz Sky', artist: 'Kairo Field', album: 'Gravity Rooms', duration: 276,
    genre: 'Ambient', year: 2024, plays: '980K', gradient: ['#A78BFA', '#60A5FA', '#1E293B'], glyph: '◇', seed: 6, tempo: 72
  },
  {
    id: 'afterimage', title: 'Afterimage', artist: 'Lila North', album: 'Night Bloom', duration: 201,
    genre: 'Indie', year: 2026, plays: '2.1M', gradient: ['#FB7185', '#C026D3', '#4C1D95'], glyph: '◐', seed: 12, tempo: 106
  },
  {
    id: 'low-tide-lullaby', title: 'Low Tide Lullaby', artist: 'Milo Loop', album: 'Window Seat', duration: 168,
    genre: 'Lo-fi', year: 2025, plays: '11.4M', gradient: ['#FDBA74', '#F43F5E', '#581C87'], glyph: '≈', seed: 8, tempo: 80
  },
  {
    id: 'velvet-static', title: 'Velvet Static', artist: 'Sora Bloom', album: 'Night Bloom', duration: 228,
    genre: 'R&B', year: 2026, plays: '3.9M', gradient: ['#D946EF', '#7C3AED', '#1E1B4B'], glyph: '✧', seed: 14, tempo: 94
  },
  {
    id: 'first-light', title: 'First Light', artist: 'Northbound', album: 'Midnight Maps', duration: 236,
    genre: 'Chill', year: 2025, plays: '5.6M', gradient: ['#22D3EE', '#A3E635', '#064E3B'], glyph: '☀', seed: 10, tempo: 90
  }
]

export const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'focus-flow', name: 'Focus Flow', description: 'Soundtracks for deep work and long stretches.',
    trackIds: ['slow-orbit', 'coffee-rain', 'quartz-sky', 'blue-hour', 'first-light'],
    gradient: ['#4F46E5', '#0F766E', '#111827'], glyph: '◎'
  },
  {
    id: 'night-drive', name: 'Night Drive', description: 'Neon roads, low lights, high momentum.',
    trackIds: ['neon-tide', 'glass-highways', 'velvet-hour', 'ember', 'afterimage'],
    gradient: ['#7C3AED', '#DB2777', '#0F172A'], glyph: '⌁'
  },
  {
    id: 'indie-dawn', name: 'Indie Dawn', description: 'Soft guitars for the first light.',
    trackIds: ['paper-moons', 'sunday-static', 'afterimage', 'first-light'],
    gradient: ['#65A30D', '#0D9488', '#1E293B'], glyph: '✳'
  },
  {
    id: 'slow-sunday', name: 'Slow Sunday', description: 'Easy mornings and unhurried afternoons.',
    trackIds: ['coffee-rain', 'low-tide-lullaby', 'blue-hour', 'quartz-sky'],
    gradient: ['#F59E0B', '#EA580C', '#7C2D12'], glyph: '☕'
  }
]

export const GENRES = ['Electronic', 'Indie', 'Ambient', 'Lo-fi', 'R&B', 'Chill', 'Pop']

export const GENRE_GRADIENTS: Record<string, [string, string, string]> = {
  Electronic: ['#7C3AED', '#2563EB', '#22D3EE'],
  Indie: ['#F472B6', '#A855F7', '#4F46E5'],
  Ambient: ['#0EA5E9', '#4338CA', '#111827'],
  'Lo-fi': ['#F59E0B', '#EA580C', '#7C2D12'],
  'R&B': ['#EC4899', '#8B5CF6', '#312E81'],
  Chill: ['#6366F1', '#0F172A', '#38BDF8'],
  Pop: ['#EF4444', '#F97316', '#FACC15']
}
