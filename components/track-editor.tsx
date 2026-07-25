"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { AlertTriangle, Save, Trash2, Undo2, X } from "lucide-react"
import {
  filletPolygon,
  makeEmptyTrack,
  polygonBounds,
  validateTrack,
  type TrackSpec,
  type TrackTheme,
  type Vec2,
} from "@/lib/track"

/**
 * Top-down polygon editor.
 *
 * The user clicks out the closed path they want to practise — typically the
 * shape of a route in their own home or ward. Vertices are the *centreline*;
 * the shaded band is the drivable width that will be generated around it, so
 * what is previewed here is exactly what gets driven.
 */

interface TrackEditorProps {
  /** Track being edited, or undefined to start a new one. */
  initial?: TrackSpec
  onSave: (spec: TrackSpec) => void
  onCancel: () => void
}

/** Editor viewport, in CSS pixels. */
const VIEW = 460
/** Grid spacing, in metres. */
const GRID_METRES = 1
/** Pixels per metre at zoom 1. */
const BASE_SCALE = 14

const THEME_OPTIONS: { id: TrackTheme; label: string }[] = [
  { id: "indoor", label: "Indoor" },
  { id: "city", label: "City" },
  { id: "park", label: "Park" },
]

export default function TrackEditor({ initial, onSave, onCancel }: TrackEditorProps) {
  const [spec, setSpec] = useState<TrackSpec>(() => initial ?? makeEmptyTrack())
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [snap, setSnap] = useState(true)
  const [zoom, setZoom] = useState(1)
  const svgRef = useRef<SVGSVGElement>(null)
  // A drag ends with a click event on the SVG. Without this, releasing a
  // dragged vertex would also drop a new point where it was released.
  const suppressClick = useRef(false)

  const scale = BASE_SCALE * zoom

  /** Convert world metres to SVG pixels. The SVG origin is the view centre. */
  const toScreen = useCallback(
    (p: Vec2) => ({ x: VIEW / 2 + p.x * scale, y: VIEW / 2 + p.z * scale }),
    [scale],
  )

  /** Convert a pointer event to world metres. */
  const toWorld = useCallback(
    (clientX: number, clientY: number): Vec2 => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, z: 0 }
      // Scale by the rendered size: the SVG is responsive, so its on-screen
      // size will not match the viewBox.
      const px = ((clientX - rect.left) / rect.width) * VIEW
      const py = ((clientY - rect.top) / rect.height) * VIEW
      const raw = { x: (px - VIEW / 2) / scale, z: (py - VIEW / 2) / scale }
      if (!snap) return raw
      return {
        x: Math.round(raw.x / GRID_METRES) * GRID_METRES,
        z: Math.round(raw.z / GRID_METRES) * GRID_METRES,
      }
    },
    [scale, snap],
  )

  const validation = useMemo(
    () => validateTrack({ points: spec.points, width: spec.width, cornerRadius: spec.cornerRadius }),
    [spec.points, spec.width, spec.cornerRadius],
  )

  // The preview shows the actual filleted centreline, not the raw polygon, so
  // corners that get rounded down are visible before saving.
  const filleted = useMemo(() => {
    if (spec.points.length < 3) return []
    return filletPolygon(spec.points, spec.cornerRadius)
  }, [spec.points, spec.cornerRadius])

  const pathLength = useMemo(() => {
    if (filleted.length < 2) return 0
    let total = 0
    for (let i = 0; i < filleted.length; i++) {
      const a = filleted[i]
      const b = filleted[(i + 1) % filleted.length]
      total += Math.hypot(b.x - a.x, b.z - a.z)
    }
    return total
  }, [filleted])

  const area = useMemo(() => polygonBounds(spec.points), [spec.points])

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragIndex !== null || suppressClick.current) {
      suppressClick.current = false
      return
    }
    const p = toWorld(e.clientX, e.clientY)
    setSpec((s) => ({ ...s, points: [...s.points, p] }))
  }

  const handleVertexPointerDown = (index: number) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    setDragIndex(index)
  }

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIndex === null) return
    suppressClick.current = true
    const p = toWorld(e.clientX, e.clientY)
    setSpec((s) => {
      const points = s.points.slice()
      points[dragIndex] = p
      return { ...s, points }
    })
  }

  const handlePointerUp = () => setDragIndex(null)

  const removeVertex = (index: number) => {
    setSpec((s) => ({ ...s, points: s.points.filter((_, i) => i !== index) }))
  }

  const undo = () => setSpec((s) => ({ ...s, points: s.points.slice(0, -1) }))
  const clear = () => setSpec((s) => ({ ...s, points: [] }))

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; major: boolean }[] = []
    const step = GRID_METRES * scale
    const count = Math.ceil(VIEW / step / 2)
    for (let i = -count; i <= count; i++) {
      const offset = i * step
      // Every 5 m gets a heavier line, so distances are readable at a glance.
      const major = i % 5 === 0
      lines.push({ x1: VIEW / 2 + offset, y1: 0, x2: VIEW / 2 + offset, y2: VIEW, major })
      lines.push({ x1: 0, y1: VIEW / 2 + offset, x2: VIEW, y2: VIEW / 2 + offset, major })
    }
    return lines
  }, [scale])

  const centrePath = useMemo(() => {
    if (filleted.length < 2) return ""
    return (
      filleted
        .map((p, i) => {
          const s = toScreen(p)
          return `${i === 0 ? "M" : "L"}${s.x.toFixed(2)},${s.y.toFixed(2)}`
        })
        .join(" ") + " Z"
    )
  }, [filleted, toScreen])

  const canSave = validation.valid && spec.points.length >= 3

  const handleSave = () => {
    if (!canSave) return
    onSave({ ...spec, name: spec.name.trim() || "My Environment" })
  }

  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xl">
          {initial ? "Edit environment" : "Draw your environment"}
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Close editor">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-xs text-slate-400">
          Click to drop points along the route you want to practise. Drag a point to move it,
          right-click to remove it. The shaded band is the path you will actually drive.
        </p>

        {/* Canvas */}
        <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-900">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            className="w-full touch-none cursor-crosshair"
            onClick={handleCanvasClick}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Grid */}
            {gridLines.map((l, i) => (
              <line
                key={i}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={l.major ? "#334155" : "#1e293b"}
                strokeWidth={l.major ? 1 : 0.5}
              />
            ))}

            {/* Origin crosshair */}
            <line x1={VIEW / 2} y1={0} x2={VIEW / 2} y2={VIEW} stroke="#475569" strokeWidth={1} />
            <line x1={0} y1={VIEW / 2} x2={VIEW} y2={VIEW / 2} stroke="#475569" strokeWidth={1} />

            {/* Drivable band: the filleted centreline stroked at path width */}
            {centrePath && (
              <>
                <path
                  d={centrePath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeOpacity={0.25}
                  strokeWidth={spec.width * scale}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <path
                  d={centrePath}
                  fill="none"
                  stroke="#60a5fa"
                  strokeWidth={1.5}
                  strokeDasharray="6 5"
                />
              </>
            )}

            {/* Raw polygon edges, to show what was drawn before rounding */}
            {spec.points.length >= 2 &&
              spec.points.map((p, i) => {
                const a = toScreen(p)
                const b = toScreen(spec.points[(i + 1) % spec.points.length])
                // Skip the closing edge until there is a real polygon.
                if (i === spec.points.length - 1 && spec.points.length < 3) return null
                return (
                  <line
                    key={`edge-${i}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="#64748b"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                  />
                )
              })}

            {/* Vertices */}
            {spec.points.map((p, i) => {
              const s = toScreen(p)
              return (
                <g key={`vertex-${i}`}>
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={7}
                    fill={i === 0 ? "#22c55e" : "#f8fafc"}
                    stroke="#0f172a"
                    strokeWidth={2}
                    className="cursor-grab"
                    onPointerDown={handleVertexPointerDown(i)}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      removeVertex(i)
                    }}
                  />
                  <text
                    x={s.x + 10}
                    y={s.y - 8}
                    fill="#94a3b8"
                    fontSize={10}
                    pointerEvents="none"
                  >
                    {i + 1}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Readouts */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-900/60 rounded p-2">
            <div className="text-lg font-semibold">{spec.points.length}</div>
            <div className="text-slate-400">points</div>
          </div>
          <div className="bg-slate-900/60 rounded p-2">
            <div className="text-lg font-semibold">{pathLength.toFixed(1)} m</div>
            <div className="text-slate-400">lap length</div>
          </div>
          <div className="bg-slate-900/60 rounded p-2">
            <div className="text-lg font-semibold">
              {area.width.toFixed(0)}&times;{area.depth.toFixed(0)} m
            </div>
            <div className="text-slate-400">footprint</div>
          </div>
        </div>

        {/* Drawing tools */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="border-slate-600" onClick={undo}
            disabled={spec.points.length === 0}>
            <Undo2 className="h-4 w-4 mr-1" />
            Undo point
          </Button>
          <Button variant="outline" size="sm" className="border-slate-600" onClick={clear}
            disabled={spec.points.length === 0}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button
            variant={snap ? "default" : "outline"}
            size="sm"
            className={snap ? "" : "border-slate-600"}
            onClick={() => setSnap((v) => !v)}
          >
            Snap {GRID_METRES} m
          </Button>
          <Button variant="outline" size="sm" className="border-slate-600"
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>
            &minus;
          </Button>
          <Button variant="outline" size="sm" className="border-slate-600"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>
            +
          </Button>
        </div>

        {/* Settings */}
        <div className="space-y-4 pt-2 border-t border-slate-700">
          <div className="space-y-2">
            <Label htmlFor="track-name">Name</Label>
            <Input
              id="track-name"
              value={spec.name}
              onChange={(e) => setSpec((s) => ({ ...s, name: e.target.value }))}
              className="bg-slate-900 border-slate-700"
              placeholder="e.g. Hallway to kitchen"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Path width</Label>
              <span className="text-sm text-slate-400">{spec.width.toFixed(1)} m</span>
            </div>
            <Slider
              value={[spec.width]}
              min={0.8}
              max={4}
              step={0.1}
              onValueChange={([v]) => setSpec((s) => ({ ...s, width: v }))}
            />
            <p className="text-xs text-slate-500">
              A domestic hallway is around 1.0&ndash;1.2 m; a hospital corridor 1.8&ndash;2.4 m.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Corner rounding</Label>
              <span className="text-sm text-slate-400">{spec.cornerRadius.toFixed(1)} m</span>
            </div>
            <Slider
              value={[spec.cornerRadius]}
              min={0}
              max={5}
              step={0.1}
              onValueChange={([v]) => setSpec((s) => ({ ...s, cornerRadius: v }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Surroundings</Label>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((t) => (
                <Button
                  key={t.id}
                  variant={spec.theme === t.id ? "default" : "outline"}
                  size="sm"
                  className={spec.theme === t.id ? "" : "border-slate-600"}
                  onClick={() => setSpec((s) => ({ ...s, theme: t.id }))}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Validation */}
        {(validation.errors.length > 0 || validation.warnings.length > 0) && (
          <div className="space-y-2">
            {validation.errors.map((err, i) => (
              <div
                key={`err-${i}`}
                className="flex gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded p-2"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            ))}
            {validation.warnings.map((warn, i) => (
              <div
                key={`warn-${i}`}
                className="flex gap-2 text-sm text-amber-300 bg-amber-950/30 border border-amber-900/60 rounded p-2"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button className="flex-1" onClick={handleSave} disabled={!canSave}>
            <Save className="h-4 w-4 mr-2" />
            Save &amp; drive
          </Button>
          <Button variant="outline" className="border-slate-600" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
