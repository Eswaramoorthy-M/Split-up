import { useState } from 'react'
import clsx from 'clsx'
import type { Playlist, Track } from '../types'
import { Cover } from './Cover'
import { MusicIcon } from './MusicIcon'

interface CreateProps {
  onClose: () => void
  onCreate: (name: string, description: string) => void
}

export function CreatePlaylistModal({ onClose, onCreate }: CreateProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  return (
    <div className="m-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="m-modal" role="dialog" aria-modal="true" aria-label="Create playlist">
        <div className="m-modal-head">
          <h2>Create playlist</h2>
          <button className="m-icon-btn" type="button" onClick={onClose} aria-label="Close"><MusicIcon name="x" size={18} /></button>
        </div>
        <form onSubmit={event => {
          event.preventDefault()
          if (name.trim()) onCreate(name.trim(), description.trim())
        }}>
          <label className="m-field">
            <span>Playlist name</span>
            <input value={name} onChange={event => setName(event.target.value)} placeholder="Late night loops" autoFocus maxLength={40} />
          </label>
          <label className="m-field">
            <span>Description <small>optional</small></span>
            <input value={description} onChange={event => setDescription(event.target.value)} placeholder="A short note about this mix" maxLength={80} />
          </label>
          <div className="m-modal-actions">
            <button className="m-btn m-btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="m-btn m-btn-primary" type="submit" disabled={!name.trim()}>Create</button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface AddProps {
  track: Track
  playlists: Playlist[]
  onClose: () => void
  onToggle: (playlistId: string) => void
  onCreate: () => void
}

export function AddToPlaylistModal({ track, playlists, onClose, onToggle, onCreate }: AddProps) {
  return (
    <div className="m-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="m-modal" role="dialog" aria-modal="true" aria-label="Add to playlist">
        <div className="m-modal-head">
          <div>
            <p className="m-eyebrow">Add to playlist</p>
            <h2>{track.title}</h2>
          </div>
          <button className="m-icon-btn" type="button" onClick={onClose} aria-label="Close"><MusicIcon name="x" size={18} /></button>
        </div>
        <div className="m-modal-list">
          {playlists.map(playlist => {
            const added = playlist.trackIds.includes(track.id)
            return (
              <button
                key={playlist.id}
                type="button"
                className={clsx('m-modal-list-row', added && 'is-added')}
                onClick={() => onToggle(playlist.id)}
              >
                <Cover gradient={playlist.gradient} glyph={playlist.glyph} size="xs" />
                <span><strong>{playlist.name}</strong><small>{playlist.trackIds.length} songs</small></span>
                <MusicIcon name={added ? 'check' : 'plus'} size={18} />
              </button>
            )
          })}
        </div>
        <button className="m-btn m-btn-primary m-modal-create" type="button" onClick={onCreate}>
          <MusicIcon name="plus" size={17} /> New playlist
        </button>
      </div>
    </div>
  )
}
