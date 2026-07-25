"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Video,
  VideoOff,
  Play,
  Pause,
} from "lucide-react"
import { CALIBRATE_URL, HEAD_DIRECTION_URL, type HeadDirectionResponse } from "@/lib/backend"

interface HeadMovementIndicatorProps {
  isActive: boolean
  onToggle: () => void
  direction: string
  onDirectionChange: (direction: string) => void
}

/** What the tracker is currently able to do, for display. */
type TrackerState =
  | "disconnected"
  | "unreachable"
  | "no-camera"
  | "no-marker"
  | "calibrating"
  | "tracking"

const STATE_LABELS: Record<TrackerState, { text: string; tone: string }> = {
  disconnected: { text: "Disconnected", tone: "text-slate-400" },
  unreachable: { text: "Cannot reach the tracking backend", tone: "text-red-400" },
  "no-camera": { text: "Backend running, but no camera", tone: "text-red-400" },
  "no-marker": { text: "Green marker not visible", tone: "text-amber-400" },
  calibrating: { text: "Hold still — calibrating…", tone: "text-amber-400" },
  tracking: { text: "Tracking", tone: "text-green-500" },
}

export default function HeadMovementIndicator({
  isActive,
  onToggle,
  direction,
  onDirectionChange,
}: HeadMovementIndicatorProps) {
  const [simulationActive, setSimulationActive] = useState(false)
  const [headDirection, setHeadDirection] = useState("none")
  const [trackerState, setTrackerState] = useState<TrackerState>("disconnected")
  const [calibrateMessage, setCalibrateMessage] = useState<string | null>(null)

  // Poll the tracking backend while head control is enabled.
  useEffect(() => {
    if (!isActive) {
      setTrackerState("disconnected")
      return
    }

    let cancelled = false

    const poll = async () => {
      try {
        const response = await fetch(HEAD_DIRECTION_URL)
        const data: HeadDirectionResponse = await response.json()
        if (cancelled) return

        setTrackerState(
          !data.cameraOk
            ? "no-camera"
            : !data.detected
              ? "no-marker"
              : !data.calibrated
                ? "calibrating"
                : "tracking",
        )

        const next = data.direction ?? "none"
        setHeadDirection(next)
        if (simulationActive) onDirectionChange(next)
      } catch (error) {
        if (cancelled) return
        console.error("Error fetching marker tracking data:", error)
        setTrackerState("unreachable")

        // Stop the chair rather than inventing input. Feeding random
        // directions here would let a whole training session run on noise
        // while looking exactly like a working one.
        setHeadDirection("none")
        if (simulationActive) onDirectionChange("none")
      }
    }

    const interval = setInterval(poll, 200)
    poll()

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isActive, simulationActive, onDirectionChange])

  const handleCalibrate = async () => {
    setCalibrateMessage(null)
    try {
      const response = await fetch(CALIBRATE_URL, { method: "POST" })
      const data = await response.json()
      setCalibrateMessage(
        data.ok ? "Neutral position set." : (data.error ?? "Calibration failed."),
      )
    } catch {
      setCalibrateMessage("Could not reach the tracking backend.")
    }
  }

  const handleToggleSimulation = () => {
    setSimulationActive(!simulationActive)
    if (!simulationActive) {
      onDirectionChange("none")
    }
  }

  const handleManualDirection = (dir: string) => {
    setHeadDirection(dir)

    // Only update the actual direction if simulation is active
    if (simulationActive) {
      if (dir === direction) {
        onDirectionChange("none")
      } else {
        onDirectionChange(dir)
      }
    }
  }

  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Head gesture control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tracker status. "Holding still" and "marker not visible" both send
            no direction, so they must be distinguishable here. */}
        <div className="text-sm text-center">
          <p>
            Status:{" "}
            <span className={STATE_LABELS[trackerState].tone}>
              {STATE_LABELS[trackerState].text}
            </span>
          </p>
          {trackerState === "unreachable" && (
            <p className="text-xs text-slate-500 mt-1">
              Start it with{" "}
              <code className="text-slate-400">
                python3 backend/head_movement_detection.py
              </code>
            </p>
          )}
        </div>

        {/* Head visualization */}
        <div className="relative w-40 h-40 mx-auto bg-slate-700 rounded-full overflow-hidden">
          {/* Simple face representation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-slate-600 flex items-center justify-center">
              {/* Eyes */}
              <div className="flex space-x-6">
                <div className="w-3 h-3 rounded-full bg-white"></div>
                <div className="w-3 h-3 rounded-full bg-white"></div>
              </div>
            </div>
          </div>

          {/* Direction indicator */}
          <div
            className="absolute w-full h-full transition-transform duration-300"
            style={{
              transform:
                headDirection === "left"
                  ? "translateX(-10px) rotate(-10deg)"
                  : headDirection === "right"
                    ? "translateX(10px) rotate(10deg)"
                    : headDirection === "up"
                      ? "translateY(-10px)"
                      : headDirection === "down"
                        ? "translateY(10px)"
                        : "translate(0, 0)",
            }}
          >
            {/* Arrow indicator */}
            {headDirection !== "none" && (
              <div className="absolute top-2 left-1/2 transform -translate-x-1/2">
                {headDirection === "up" && <ArrowUp className="h-6 w-6 text-blue-500" />}
                {headDirection === "down" && <ArrowDown className="h-6 w-6 text-blue-500" />}
                {headDirection === "left" && <ArrowLeft className="h-6 w-6 text-blue-500" />}
                {headDirection === "right" && <ArrowRight className="h-6 w-6 text-blue-500" />}
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <div className="flex space-x-2">
            <Button variant={isActive ? "default" : "outline"} className="flex-1" onClick={onToggle}>
              {isActive ? (
                <>
                  <VideoOff className="h-4 w-4 mr-2" />
                  Disable Head Control
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  Enable Head Control
                </>
              )}
            </Button>
          </div>

          {isActive && (
            <>
              <Button
                variant="outline"
                className="w-full border-slate-600"
                onClick={handleCalibrate}
              >
                <Crosshair className="h-4 w-4 mr-2" />
                Set neutral position
              </Button>
              <p className="text-xs text-slate-500 text-center">
                Face straight ahead, then press this. All gestures are measured
                from that position.
              </p>
              {calibrateMessage && (
                <p className="text-xs text-center text-slate-300">{calibrateMessage}</p>
              )}
            </>
          )}

          {isActive && (
            <Button
              variant={simulationActive ? "default" : "outline"}
              className="w-full"
              onClick={handleToggleSimulation}
            >
              {simulationActive ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Stop Simulation
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Simulation
                </>
              )}
            </Button>
          )}

          <div className="text-sm text-center mt-2">
            <p>
              Detected direction:{" "}
              <span className="font-bold capitalize">{headDirection === "none" ? "center" : headDirection}</span>
            </p>
            <p>
              Active direction:{" "}
              <span className="font-bold capitalize">{direction === "none" ? "center" : direction}</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {isActive
                ? simulationActive
                  ? "Head movement controls are active"
                  : "Head movement detected but not controlling car (click Start Simulation)"
                : "Head movement detection is disabled"}
            </p>
          </div>

          {/* Manual controls */}
          <div className="pt-4 border-t border-slate-700">
            <h3 className="text-sm font-medium mb-2">Manual Control</h3>
            <div className="grid grid-cols-3 gap-2 w-full">
              <div></div>
              <Button
                variant={headDirection === "up" ? "default" : "outline"}
                size="icon"
                onClick={() => handleManualDirection("up")}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <div></div>

              <Button
                variant={headDirection === "left" ? "default" : "outline"}
                size="icon"
                onClick={() => handleManualDirection("left")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={headDirection === "none" ? "default" : "outline"}
                size="icon"
                onClick={() => handleManualDirection("none")}
              >
                <span className="h-1 w-1 bg-current rounded-full"></span>
              </Button>
              <Button
                variant={headDirection === "right" ? "default" : "outline"}
                size="icon"
                onClick={() => handleManualDirection("right")}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div></div>
              <Button
                variant={headDirection === "down" ? "default" : "outline"}
                size="icon"
                onClick={() => handleManualDirection("down")}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <div></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
