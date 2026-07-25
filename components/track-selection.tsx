"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react"
import { filletPolygon, polygonBounds, type TrackSpec, type Vec2 } from "@/lib/track"

interface TrackSelectionProps {
  tracks: TrackSpec[]
  currentTrackId: string
  onSelect: (track: TrackSpec) => void
  onCreate: () => void
  onEdit: (track: TrackSpec) => void
  onDelete: (id: string) => void
  onImport: (json: string) => void
}

export default function TrackSelection({
  tracks,
  currentTrackId,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onImport,
}: TrackSelectionProps) {
  const builtins = tracks.filter((t) => t.builtin)
  const custom = tracks.filter((t) => !t.builtin)

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => onImport(String(reader.result))
    reader.readAsText(file)
    // Reset so re-importing the same file fires a change event again.
    e.target.value = ""
  }

  const handleExport = (track: TrackSpec) => {
    const blob = new Blob([JSON.stringify(track, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${track.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Select environment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            Practice tracks
          </h3>
          {builtins.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              active={track.id === currentTrackId}
              onSelect={() => onSelect(track)}
            />
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            My environments
          </h3>

          {custom.length === 0 && (
            <p className="text-sm text-slate-500">
              Nothing saved yet. Draw the route you want to practise &mdash; a loop of your
              hallway, or the way from your room to the day area.
            </p>
          )}

          {custom.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              active={track.id === currentTrackId}
              onSelect={() => onSelect(track)}
              onEdit={() => onEdit(track)}
              onDelete={() => onDelete(track.id)}
              onExport={() => handleExport(track)}
            />
          ))}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={onCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Draw new environment
            </Button>
            <Button variant="outline" className="border-slate-600 relative" asChild>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" />
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={handleImport}
                />
              </label>
            </Button>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

interface TrackRowProps {
  track: TrackSpec
  active: boolean
  onSelect: () => void
  onEdit?: () => void
  onDelete?: () => void
  onExport?: () => void
}

function TrackRow({ track, active, onSelect, onEdit, onDelete, onExport }: TrackRowProps) {
  const bounds = polygonBounds(track.points)

  return (
    <div
      className={`rounded-lg border transition-all ${
        active
          ? "border-blue-500 bg-slate-900/80"
          : "border-slate-700 bg-slate-900/40 hover:border-slate-500"
      }`}
    >
      <button className="w-full text-left p-3 flex gap-3" onClick={onSelect}>
        <TrackThumbnail track={track} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold truncate">{track.name}</h4>
            {active && (
              <span className="text-[10px] bg-blue-500 px-1.5 py-0.5 rounded-full shrink-0">
                Active
              </span>
            )}
          </div>
          {track.description && (
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{track.description}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">
            {track.points.length} points &middot; {track.width.toFixed(1)} m wide &middot;{" "}
            {bounds.width.toFixed(0)}&times;{bounds.depth.toFixed(0)} m
          </p>
        </div>
      </button>

      {(onEdit || onDelete || onExport) && (
        <div className="flex gap-1 px-3 pb-2">
          {onEdit && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onEdit}>
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
          {onExport && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onExport}>
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-red-400 hover:text-red-300"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Small top-down preview of the track shape, drawn from the spec itself. */
function TrackThumbnail({ track }: { track: TrackSpec }) {
  const SIZE = 64
  const PAD = 6

  const path = useMemo(() => {
    if (track.points.length < 3) return ""
    const filleted = filletPolygon(track.points, track.cornerRadius)
    const b = polygonBounds(track.points)
    const span = Math.max(b.width, b.depth, 1e-3)
    const scale = (SIZE - PAD * 2) / span

    // Centre the shape in the thumbnail regardless of its world position.
    const project = (p: Vec2) => ({
      x: PAD + (p.x - (b.minX + b.maxX) / 2) * scale + (SIZE - PAD * 2) / 2,
      y: PAD + (p.z - (b.minZ + b.maxZ) / 2) * scale + (SIZE - PAD * 2) / 2,
    })

    return (
      filleted
        .map((p, i) => {
          const s = project(p)
          return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)},${s.y.toFixed(1)}`
        })
        .join(" ") + " Z"
    )
  }, [track.points, track.cornerRadius])

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-16 h-16 shrink-0 rounded bg-slate-950/60 border border-slate-700"
      aria-hidden
    >
      {path ? (
        <path d={path} fill="none" stroke="#60a5fa" strokeWidth={3} strokeLinejoin="round" />
      ) : (
        <text x={SIZE / 2} y={SIZE / 2 + 3} textAnchor="middle" fill="#475569" fontSize={9}>
          empty
        </text>
      )}
    </svg>
  )
}
