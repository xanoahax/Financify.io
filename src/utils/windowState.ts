const WINDOW_SIZE_STORAGE_KEY = 'financify.desktop.window-size.v1'
const MIN_WINDOW_WIDTH = 760
const MIN_WINDOW_HEIGHT = 560

interface StoredWindowSize {
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function parseStoredWindowSize(raw: string | null): StoredWindowSize | null {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as { width?: unknown; height?: unknown }
    const width = Number(parsed.width)
    const height = Number(parsed.height)
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      return null
    }
    return { width, height }
  } catch {
    return null
  }
}

export function readStoredWindowSize(): StoredWindowSize | null {
  return parseStoredWindowSize(window.localStorage.getItem(WINDOW_SIZE_STORAGE_KEY))
}

export function normalizeWindowSize(size: StoredWindowSize): StoredWindowSize {
  const maxWidth = Math.max(window.screen.availWidth, MIN_WINDOW_WIDTH)
  const maxHeight = Math.max(window.screen.availHeight, MIN_WINDOW_HEIGHT)
  return {
    width: clamp(Math.round(size.width), MIN_WINDOW_WIDTH, maxWidth),
    height: clamp(Math.round(size.height), MIN_WINDOW_HEIGHT, maxHeight),
  }
}

export function persistWindowSize(size: StoredWindowSize): void {
  const normalized = normalizeWindowSize(size)
  window.localStorage.setItem(WINDOW_SIZE_STORAGE_KEY, JSON.stringify(normalized))
}
