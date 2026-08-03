import fs from 'node:fs'
import path from 'node:path'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface WorkArea {
  x: number
  y: number
  width: number
  height: number
}

export interface CompanionPreferences {
  alwaysOnTop: boolean
  ignoreMouseEvents: boolean
}

const DEFAULT_PREFERENCES: CompanionPreferences = {
  alwaysOnTop: false,
  ignoreMouseEvents: false,
}

const DEFAULT_BOUNDS: WindowBounds = { x: 24, y: 80, width: 540, height: 760 }

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function loadWindowBounds(filePath: string, fallback: WindowBounds = DEFAULT_BOUNDS): WindowBounds {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!raw || typeof raw !== 'object') return fallback
    const value = raw as Record<string, unknown>
    if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)
      || !isFiniteNumber(value.width) || !isFiniteNumber(value.height)) return fallback
    return {
      x: Math.round(value.x),
      y: Math.round(value.y),
      width: Math.round(value.width),
      height: Math.round(value.height),
    }
  } catch {
    return fallback
  }
}

export function clampWindowBounds(bounds: WindowBounds, workArea: WorkArea): WindowBounds {
  const width = Math.max(360, Math.min(Math.round(bounds.width), workArea.width))
  const height = Math.max(480, Math.min(Math.round(bounds.height), workArea.height))
  const x = Math.max(workArea.x - width + 80, Math.min(Math.round(bounds.x), workArea.x + workArea.width - 80))
  const y = Math.max(workArea.y, Math.min(Math.round(bounds.y), workArea.y + workArea.height - 80))
  return { x, y, width, height }
}

export function saveWindowBounds(filePath: string, bounds: WindowBounds): void {
  const directory = path.dirname(filePath)
  const temporary = `${filePath}.${process.pid}.tmp`
  try {
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(temporary, JSON.stringify(bounds), 'utf8')
    fs.renameSync(temporary, filePath)
  } catch {
    try { fs.unlinkSync(temporary) } catch { /* best effort */ }
  }
}

export function loadCompanionPreferences(
  filePath: string,
  fallback: CompanionPreferences = DEFAULT_PREFERENCES,
): CompanionPreferences {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    if (!raw || typeof raw !== 'object') return fallback
    const value = raw as Record<string, unknown>
    return {
      alwaysOnTop: value.alwaysOnTop === true,
      ignoreMouseEvents: value.ignoreMouseEvents === true,
    }
  } catch {
    return fallback
  }
}

export function saveCompanionPreferences(filePath: string, preferences: CompanionPreferences): void {
  const directory = path.dirname(filePath)
  const temporary = `${filePath}.${process.pid}.tmp`
  try {
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(temporary, JSON.stringify(preferences), 'utf8')
    fs.renameSync(temporary, filePath)
  } catch {
    try { fs.unlinkSync(temporary) } catch { /* best effort */ }
  }
}
