"use client"

import { BUILTIN_TRACKS, type TrackSpec, type TrackTheme } from "./track"

/**
 * Persistence for user-authored tracks.
 *
 * Tracks live in localStorage so a trainee's own environment survives a reload
 * without needing an account or a server. Swap this module for API calls when
 * multi-device sync is wanted; nothing else imports localStorage directly.
 */

const STORAGE_KEY = "hgwn.tracks.v1"

const THEMES: TrackTheme[] = ["indoor", "city", "park"]

/**
 * Validate the *shape* of a parsed track.
 *
 * localStorage is user-writable and files can be hand-edited, so anything
 * loaded from outside the app is treated as untrusted until it passes here.
 * Geometry validity is a separate concern — see `validateTrack`.
 */
function parseTrack(value: unknown): TrackSpec | null {
  if (typeof value !== "object" || value === null) return null
  const t = value as Record<string, unknown>

  if (typeof t.id !== "string" || t.id.length === 0) return null
  if (typeof t.name !== "string") return null
  if (!Array.isArray(t.points)) return null

  const points = t.points
    .map((p) => {
      if (typeof p !== "object" || p === null) return null
      const { x, z } = p as Record<string, unknown>
      if (typeof x !== "number" || typeof z !== "number") return null
      if (!Number.isFinite(x) || !Number.isFinite(z)) return null
      return { x, z }
    })
    .filter((p): p is { x: number; z: number } => p !== null)

  if (points.length !== t.points.length) return null

  const width = typeof t.width === "number" && t.width > 0 ? t.width : 1.4
  const cornerRadius =
    typeof t.cornerRadius === "number" && t.cornerRadius >= 0 ? t.cornerRadius : 1.2
  const theme = THEMES.includes(t.theme as TrackTheme) ? (t.theme as TrackTheme) : "indoor"

  return {
    id: t.id,
    name: t.name,
    description: typeof t.description === "string" ? t.description : "",
    points,
    width,
    cornerRadius,
    theme,
    // A saved track is never builtin, whatever the file claims — otherwise an
    // imported track could shadow and overwrite a builtin.
    builtin: false,
  }
}

/** All user-saved tracks, oldest first. Returns [] on the server. */
export function loadSavedTracks(): TrackSpec[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map(parseTrack).filter((t): t is TrackSpec => t !== null)
  } catch {
    // Corrupt storage should not take the whole app down.
    return []
  }
}

function writeAll(tracks: TrackSpec[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks))
  } catch (error) {
    console.error("Could not save tracks:", error)
  }
}

/** Insert or update a track by id. Returns the resulting list. */
export function saveTrack(track: TrackSpec): TrackSpec[] {
  const tracks = loadSavedTracks()
  const index = tracks.findIndex((t) => t.id === track.id)
  const record = { ...track, builtin: false }

  if (index >= 0) tracks[index] = record
  else tracks.push(record)

  writeAll(tracks)
  return tracks
}

export function deleteTrack(id: string): TrackSpec[] {
  const tracks = loadSavedTracks().filter((t) => t.id !== id)
  writeAll(tracks)
  return tracks
}

/** Builtins first, then the user's own. */
export function allTracks(): TrackSpec[] {
  return [...BUILTIN_TRACKS, ...loadSavedTracks()]
}

export function findTrack(id: string): TrackSpec | undefined {
  return allTracks().find((t) => t.id === id)
}

/** Serialise a track for download. */
export function exportTrack(track: TrackSpec): string {
  return JSON.stringify(track, null, 2)
}

/**
 * Parse a track from JSON text, giving it a fresh id so importing never
 * clobbers an existing track.
 */
export function importTrack(json: string): TrackSpec | null {
  try {
    const parsed = parseTrack(JSON.parse(json))
    if (!parsed) return null
    return { ...parsed, id: `track-${Date.now().toString(36)}` }
  } catch {
    return null
  }
}
