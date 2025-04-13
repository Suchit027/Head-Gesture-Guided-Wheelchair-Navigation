"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Gauge, ChevronUp, ChevronDown, Video, VideoOff } from "lucide-react"

interface ControlPanelProps {
  speed: number
  onIncreaseSpeed: () => void
  onDecreaseSpeed: () => void
  isHeadControlActive: boolean
  onToggleHeadControl: () => void
}

export default function ControlPanel({
  speed,
  onIncreaseSpeed,
  onDecreaseSpeed,
  isHeadControlActive,
  onToggleHeadControl,
}: ControlPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Speed Control</CardTitle>
          <CardDescription>Adjust the car's speed</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={onDecreaseSpeed}>
              <ChevronDown className="h-4 w-4" />
            </Button>

            <div className="flex flex-col items-center">
              <Gauge className="h-8 w-8 mb-2" />
              <span className="text-2xl font-bold">{speed} km/h</span>
            </div>

            <Button variant="outline" size="icon" onClick={onIncreaseSpeed}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Head Movement Control</CardTitle>
          <CardDescription>Use head movements to steer the car</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <p className="text-sm mb-2">
                {isHeadControlActive ? "Head control is active" : "Head control is inactive"}
              </p>
              <p className="text-xs text-muted-foreground">Tilt your head left/right to steer</p>
            </div>

            <Button variant={isHeadControlActive ? "default" : "outline"} onClick={onToggleHeadControl}>
              {isHeadControlActive ? (
                <>
                  <VideoOff className="h-4 w-4 mr-2" />
                  Disable
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  Enable
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
