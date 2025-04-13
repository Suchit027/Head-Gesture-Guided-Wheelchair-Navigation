"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RefreshCw } from "lucide-react"

interface HeadMovementSimulatorProps {
  onDirectionChange: (direction: string) => void
}

export default function HeadMovementSimulator({ onDirectionChange }: HeadMovementSimulatorProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [currentDirection, setCurrentDirection] = useState("none")

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning) {
      interval = setInterval(() => {
        // Simulate head movement detection
        const directions = ["left", "right", "up", "down", "none", "none", "none"]
        const newDirection = directions[Math.floor(Math.random() * directions.length)]
        setCurrentDirection(newDirection)
        onDirectionChange(newDirection)
      }, 2000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, onDirectionChange])

  const handleDirectionClick = (direction: string) => {
    setCurrentDirection(direction)
    onDirectionChange(direction)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Head Movement Simulator</CardTitle>
        <CardDescription>Simulates the Python head movement detection</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          <div className="grid grid-cols-3 gap-2 w-32 h-32">
            <div className="col-start-2">
              <Button
                variant={currentDirection === "up" ? "default" : "outline"}
                size="icon"
                onClick={() => handleDirectionClick("up")}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            <div className="col-start-1 row-start-2">
              <Button
                variant={currentDirection === "left" ? "default" : "outline"}
                size="icon"
                onClick={() => handleDirectionClick("left")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="col-start-3 row-start-2">
              <Button
                variant={currentDirection === "right" ? "default" : "outline"}
                size="icon"
                onClick={() => handleDirectionClick("right")}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="col-start-2 row-start-3">
              <Button
                variant={currentDirection === "down" ? "default" : "outline"}
                size="icon"
                onClick={() => handleDirectionClick("down")}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            variant={isRunning ? "default" : "outline"}
            onClick={() => setIsRunning(!isRunning)}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRunning ? "animate-spin" : ""}`} />
            {isRunning ? "Stop Simulation" : "Start Simulation"}
          </Button>

          <div className="text-sm text-center mt-2">
            <p>
              Current direction: <span className="font-bold">{currentDirection}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              In a real implementation, this would receive data from the Python script
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
