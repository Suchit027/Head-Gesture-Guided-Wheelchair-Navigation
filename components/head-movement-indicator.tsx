"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Video, VideoOff, Play, Pause } from "lucide-react"

interface HeadMovementIndicatorProps {
  isActive: boolean
  onToggle: () => void
  direction: string
  onDirectionChange: (direction: string) => void
}

export default function HeadMovementIndicator({
  isActive,
  onToggle,
  direction,
  onDirectionChange,
}: HeadMovementIndicatorProps) {
  const [simulationActive, setSimulationActive] = useState(false)
  const [headDirection, setHeadDirection] = useState("none")
  const [connectionStatus, setConnectionStatus] = useState("Disconnected")

  // Connect to Flask backend when active
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isActive) {
      // Poll the Flask backend for head movement data
      interval = setInterval(async () => {
        try {
          const response = await fetch("http://localhost:5000/head_direction")
          const data = await response.json()

          setConnectionStatus("Connected")

          if (data.direction) {
            setHeadDirection(data.direction)

            // Only update the actual direction if simulation is active
            if (simulationActive) {
              onDirectionChange(data.direction)
            }
          }
        } catch (error) {
          console.error("Error fetching head movement data:", error)
          setConnectionStatus("Error: Cannot connect to Flask backend")

          // Fallback to simulation if connection fails
          if (simulationActive) {
            const directions = ["left", "right", "up", "down", "none", "none", "none"]
            const randomIndex = Math.floor(Math.random() * directions.length)
            const newDirection = directions[randomIndex]
            setHeadDirection(newDirection)

            if (simulationActive) {
              onDirectionChange(newDirection)
            }
          }
        }
      }, 200)
    } else {
      setConnectionStatus("Disconnected")
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, simulationActive, onDirectionChange])

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
        <CardTitle className="text-xl">Head Movement Control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection status */}
        <div className="text-sm text-center">
          <p>
            Status:{" "}
            <span className={connectionStatus === "Connected" ? "text-green-500" : "text-red-500"}>
              {connectionStatus}
            </span>
          </p>
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
