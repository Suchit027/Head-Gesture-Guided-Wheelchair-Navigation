"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Eye, Pause, Play, RotateCcw } from "lucide-react"
import type { CameraMode, Telemetry } from "@/components/wheelchair-simulation"

/**
 * Session controls.
 *
 * The speed slider sets a *cap*, not the current speed: the chair is driven by
 * gestures, and this is the ceiling those gestures can reach. Starting a
 * trainee at 0.5 m/s and raising it as they improve is the intended progression.
 */

interface SpeedControlsProps {
  maxSpeed: number
  onMaxSpeedChange: (value: number) => void
  cameraMode: CameraMode
  onCameraModeChange: (mode: CameraMode) => void
  paused: boolean
  onTogglePause: () => void
  onReset: () => void
  telemetry: Telemetry
}

const SPEED_PRESETS = [
  { label: "Gentle", value: 0.5 },
  { label: "Steady", value: 1.0 },
  { label: "Full", value: 1.5 },
]

const CAMERA_MODES: { id: CameraMode; label: string }[] = [
  { id: "chase", label: "Behind" },
  { id: "first", label: "Eye level" },
  { id: "overview", label: "Map" },
]

export default function SpeedControls({
  maxSpeed,
  onMaxSpeedChange,
  cameraMode,
  onCameraModeChange,
  paused,
  onTogglePause,
  onReset,
  telemetry,
}: SpeedControlsProps) {
  const minutes = Math.floor(telemetry.elapsed / 60)
  const seconds = Math.floor(telemetry.elapsed % 60)

  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Run controls */}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={onTogglePause}>
            {paused ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            )}
          </Button>
          <Button variant="outline" className="border-slate-600" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restart
          </Button>
        </div>

        {/* Speed cap */}
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="font-medium">Speed limit</span>
            <span className="text-2xl font-bold tabular-nums">
              {maxSpeed.toFixed(1)}
              <span className="text-sm text-slate-400 ml-1">m/s</span>
            </span>
          </div>

          <Slider
            value={[maxSpeed]}
            min={0.3}
            max={1.6}
            step={0.1}
            onValueChange={([v]) => onMaxSpeedChange(v)}
          />

          <div className="grid grid-cols-3 gap-2">
            {SPEED_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={Math.abs(maxSpeed - preset.value) < 0.05 ? "default" : "outline"}
                size="sm"
                className={Math.abs(maxSpeed - preset.value) < 0.05 ? "" : "border-slate-600"}
                onClick={() => onMaxSpeedChange(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            A powered wheelchair tops out around 1.5 m/s. Raise the limit only once turns feel
            comfortable at the current one.
          </p>
        </div>

        {/* View */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-slate-400" />
            <span className="font-medium">View</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CAMERA_MODES.map((mode) => (
              <Button
                key={mode.id}
                variant={cameraMode === mode.id ? "default" : "outline"}
                size="sm"
                className={cameraMode === mode.id ? "" : "border-slate-600"}
                onClick={() => onCameraModeChange(mode.id)}
              >
                {mode.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Session score */}
        <div className="space-y-2 pt-2 border-t border-slate-700">
          <span className="font-medium">This run</span>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Time" value={`${minutes}:${seconds.toString().padStart(2, "0")}`} />
            <Stat label="Distance" value={`${telemetry.distance.toFixed(0)} m`} />
            <Stat label="Laps" value={`${telemetry.laps}`} />
            <Stat
              label="On path"
              value={`${(telemetry.timeOnTrackRatio * 100).toFixed(0)}%`}
              good={telemetry.timeOnTrackRatio > 0.9}
            />
            <Stat
              label="Avg. off centre"
              value={`${telemetry.meanLateralError.toFixed(2)} m`}
              className="col-span-2"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  good,
  className = "",
}: {
  label: string
  value: string
  good?: boolean
  className?: string
}) {
  return (
    <div className={`bg-slate-900/60 rounded p-2 ${className}`}>
      <div
        className={`text-lg font-semibold tabular-nums ${
          good === undefined ? "" : good ? "text-green-400" : "text-amber-400"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  )
}
