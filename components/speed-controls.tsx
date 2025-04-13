"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Gauge, ChevronUp, ChevronDown } from "lucide-react"
import { useState, useEffect } from "react"

interface SpeedControlsProps {
  speed: number
  onIncreaseSpeed: () => void
  onDecreaseSpeed: () => void
}

export default function SpeedControls({ speed, onIncreaseSpeed, onDecreaseSpeed }: SpeedControlsProps) {
  const [isAccelerating, setIsAccelerating] = useState(false)
  const [isBraking, setIsBraking] = useState(false)

  // Handle long press for acceleration
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isAccelerating) {
      interval = setInterval(() => {
        onIncreaseSpeed()
      }, 200)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isAccelerating, onIncreaseSpeed])

  // Handle long press for braking
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isBraking) {
      interval = setInterval(() => {
        onDecreaseSpeed()
      }, 200)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isBraking, onDecreaseSpeed])

  const setSpeedPreset = (targetSpeed: number) => {
    // Simulate setting speed by calling increase/decrease multiple times
    if (targetSpeed > speed) {
      // Need to increase
      const times = Math.floor((targetSpeed - speed) / 10)
      for (let i = 0; i < times; i++) {
        onIncreaseSpeed()
      }
    } else if (targetSpeed < speed) {
      // Need to decrease
      const times = Math.floor((speed - targetSpeed) / 10)
      for (let i = 0; i < times; i++) {
        onDecreaseSpeed()
      }
    }
  }

  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Speed Control</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-6">
          {/* Speed gauge */}
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle cx="50" cy="50" r="45" fill="none" stroke="#334155" strokeWidth="10" />

              {/* Speed indicator */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="10"
                strokeDasharray={`${(speed / 120) * 283} 283`}
                transform="rotate(-90 50 50)"
              />
            </svg>

            <div className="absolute flex flex-col items-center">
              <Gauge className="h-6 w-6 mb-1" />
              <span className="text-4xl font-bold">{speed}</span>
              <span className="text-sm text-slate-400">km/h</span>
            </div>
          </div>

          {/* Control buttons */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <Button
              variant="outline"
              className="h-16 bg-green-900/20 border-green-700 hover:bg-green-800/30"
              onMouseDown={() => setIsAccelerating(true)}
              onMouseUp={() => setIsAccelerating(false)}
              onMouseLeave={() => setIsAccelerating(false)}
              onTouchStart={() => setIsAccelerating(true)}
              onTouchEnd={() => setIsAccelerating(false)}
            >
              <div className="flex flex-col items-center">
                <ChevronUp className="h-6 w-6" />
                <span>Accelerate</span>
              </div>
            </Button>

            <Button
              variant="outline"
              className="h-16 bg-red-900/20 border-red-700 hover:bg-red-800/30"
              onMouseDown={() => setIsBraking(true)}
              onMouseUp={() => setIsBraking(false)}
              onMouseLeave={() => setIsBraking(false)}
              onTouchStart={() => setIsBraking(true)}
              onTouchEnd={() => setIsBraking(false)}
            >
              <div className="flex flex-col items-center">
                <ChevronDown className="h-6 w-6" />
                <span>Brake</span>
              </div>
            </Button>
          </div>

          {/* Speed presets */}
          <div className="grid grid-cols-3 gap-2 w-full">
            <Button variant="outline" className="border-slate-700" onClick={() => setSpeedPreset(30)}>
              30
            </Button>
            <Button variant="outline" className="border-slate-700" onClick={() => setSpeedPreset(60)}>
              60
            </Button>
            <Button variant="outline" className="border-slate-700" onClick={() => setSpeedPreset(90)}>
              90
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
