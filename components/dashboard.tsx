"use client"

import { Card } from "@/components/ui/card"
import { AlertTriangle, Gauge, Repeat, Route, Target } from "lucide-react"
import type { Telemetry } from "@/components/wheelchair-simulation"

interface DashboardProps {
  telemetry: Telemetry
  trackName: string
  /** Drivable width, used to scale the lane-position indicator. */
  trackWidth: number
  direction: string
}

export default function Dashboard({
  telemetry,
  trackName,
  trackWidth,
  direction,
}: DashboardProps) {
  // Lateral offset as a fraction of the half-width: 0 is centred, ±1 is a
  // wheel on the edge. Clamped so the marker stays on screen when off track.
  const half = trackWidth / 2
  const laneOffset = Math.max(-1.4, Math.min(1.4, telemetry.lateral / half))

  const steering =
    direction === "left" ? "Left" : direction === "right" ? "Right" : "Centre"

  return (
    <Card className="bg-slate-800/85 backdrop-blur-md border-slate-700 text-white p-4">
      <div className="grid grid-cols-4 gap-4">
        {/* Speed */}
        <div className="flex flex-col items-center justify-center">
          <Gauge className="h-5 w-5 mb-1 text-slate-400" />
          <div className="text-3xl font-bold tabular-nums">
            {Math.abs(telemetry.speed).toFixed(1)}
          </div>
          <div className="text-xs text-slate-400">
            m/s {telemetry.speed < -0.01 && <span className="text-amber-400">rev</span>}
          </div>
        </div>

        {/* Lane position */}
        <div className="flex flex-col items-center justify-center w-full">
          <Target className="h-5 w-5 mb-1 text-slate-400" />
          <div className="relative w-full h-2 bg-slate-700 rounded-full mt-1">
            {/* Path edges */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-slate-500" />
            <div
              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full transition-[left] duration-100 ${
                telemetry.onTrack ? "bg-blue-400" : "bg-red-500"
              }`}
              style={{ left: `${50 + laneOffset * 50}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {telemetry.onTrack
              ? `${Math.abs(telemetry.lateral).toFixed(2)} m off centre`
              : "off path"}
          </div>
        </div>

        {/* Steering */}
        <div className="flex flex-col items-center justify-center">
          <Route className="h-5 w-5 mb-1 text-slate-400" />
          <div className="text-lg font-semibold">{steering}</div>
          <div className="text-xs text-slate-400">steering</div>
        </div>

        {/* Laps and progress */}
        <div className="flex flex-col items-center justify-center w-full">
          <Repeat className="h-5 w-5 mb-1 text-slate-400" />
          <div className="text-lg font-semibold tabular-nums">{telemetry.laps}</div>
          <div className="w-full h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-green-500 transition-[width] duration-100"
              style={{ width: `${telemetry.progress * 100}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-1 truncate max-w-full">{trackName}</div>
        </div>
      </div>

      {telemetry.wrongWay && (
        <div className="mt-3 flex items-center justify-center gap-2 text-amber-300 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Going the wrong way round
        </div>
      )}
    </Card>
  )
}
