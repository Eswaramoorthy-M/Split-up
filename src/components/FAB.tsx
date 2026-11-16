import { KeyboardEvent, PointerEvent, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Icon } from './ui/Icon'

const STORAGE_KEY = 'splitup:fab'
const SIZE = 64
const EDGE = 8
const NAV_HEIGHT = 84 // keep clear of the bottom navigation bar

interface Frac { fx: number; fy: number }
interface Pos { x: number; y: number }

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

function bounds() {
  return {
    minX: EDGE,
    maxX: Math.max(EDGE, window.innerWidth - SIZE - EDGE),
    minY: EDGE,
    maxY: Math.max(EDGE, window.innerHeight - SIZE - NAV_HEIGHT)
  }
}

// The position is saved as a fraction of the free area, so it still makes
// sense after rotating the phone or resizing the window.
function toFrac(p: Pos): Frac {
  const b = bounds()
  return {
    fx: b.maxX === b.minX ? 1 : (p.x - b.minX) / (b.maxX - b.minX),
    fy: b.maxY === b.minY ? 1 : (p.y - b.minY) / (b.maxY - b.minY)
  }
}

function fromFrac(f: Frac): Pos {
  const b = bounds()
  return {
    x: clamp(b.minX + f.fx * (b.maxX - b.minX), b.minX, b.maxX),
    y: clamp(b.minY + f.fy * (b.maxY - b.minY), b.minY, b.maxY)
  }
}

// Default spot: bottom-right corner of the content column. These widths
// mirror the layout CSS (phone column, tablet column, desktop sidebar + column).
function defaultPos(): Pos {
  const vw = window.innerWidth
  const b = bounds()
  let right: number
  if (vw >= 1024) {
    const sidebar = 248
    const column = Math.min(vw - sidebar, 880)
    right = sidebar + (vw - sidebar + column) / 2 - 40
  } else {
    const shell = vw >= 768 ? 720 : Math.min(vw, 480)
    right = (vw + shell) / 2 - 20
  }
  return { x: clamp(right - SIZE, b.minX, b.maxX), y: b.maxY }
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const f = JSON.parse(raw) as Frac
      if (typeof f.fx === 'number' && typeof f.fy === 'number') return fromFrac(f)
    }
  } catch { /* ignore a corrupt value */ }
  return defaultPos()
}

/** Floating "+" button. Tap to add an expense; press and drag to move it out of the way. */
export function FAB() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [pos, setPos] = useState<Pos>(loadPos)
  const [dragging, setDragging] = useState(false)
  const posRef = useRef(pos)
  const drag = useRef<{ id: number; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const move = (p: Pos) => { posRef.current = p; setPos(p) }
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(toFrac(posRef.current))) } catch { /* private mode */ }
  }

  // Keep it on screen when the window changes size or the phone rotates.
  useEffect(() => {
    const onResize = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        move(raw ? fromFrac(JSON.parse(raw) as Frac) : defaultPos())
      } catch { move(defaultPos()) }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Pointless on the add/edit forms, where the screen already is the expense form.
  if (pathname === '/expenses/new' || pathname.endsWith('/edit')) return null

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false }
  }

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 6) return // a tap, not a drag
    if (!d.moved) { d.moved = true; setDragging(true) }
    const b = bounds()
    move({ x: clamp(d.origX + dx, b.minX, b.maxX), y: clamp(d.origY + dy, b.minY, b.maxY) })
  }

  const endDrag = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    if (d.moved) {
      suppressClick.current = true // the click that follows a drag must not open the form
      window.setTimeout(() => { suppressClick.current = false }, 60)
      setDragging(false)
      save()
    }
  }

  // Keyboard users: Shift + arrow keys move it, Enter or Space opens the form.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = 16
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]
    }
    if (!e.shiftKey || !delta[e.key]) return
    e.preventDefault()
    const b = bounds()
    const [dx, dy] = delta[e.key]
    move({ x: clamp(posRef.current.x + dx, b.minX, b.maxX), y: clamp(posRef.current.y + dy, b.minY, b.maxY) })
    save()
  }

  return (
    <button
      aria-label="Add expense. Drag to move this button."
      title="Tap to add an expense. Drag to move."
      className={clsx('fab', dragging && 'dragging')}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onClick={() => { if (!suppressClick.current) navigate('/expenses/new') }}
    >
      <Icon name="plus" size={28} strokeWidth={2.2} />
    </button>
  )
}
