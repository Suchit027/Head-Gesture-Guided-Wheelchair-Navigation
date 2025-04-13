"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Gauge, Compass, Map } from "lucide-react"

interface DashboardProps {
  speed: number
  direction: string
  trackType: string
}

export default function Dashboard({ speed, direction, trackType }: DashboardProps) {
  const [rotation, setRotation] = useState(0)

  // Update rotation based on direction
  useEffect(() => {
    if (direction === "left") {
      setRotation(-30)
    } else if (direction === "right") {
      setRotation(30)
    } else {
      setRotation(0)
    }
  }, [direction])

  return (
    <Card className="bg-slate-800/80 backdrop-blur-md border-slate-700 text-white p-4">
      <div className="grid grid-cols-3 gap-4">
        {/* Speed */}
        <div className="flex flex-col items-center justify-center">
          <Gauge className="h-6 w-6 mb-1" />
          <div className="text-3xl font-bold">{speed}</div>
          <div className="text-xs text-slate-400">km/h</div>
        </div>

        {/* Steering */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative">
            <Compass className="h-6 w-6 mb-1" />
            <div
              className="w-8 h-1 bg-blue-500 absolute top-3 left-1/2 -translate-x-1/2 origin-center transition-transform"
              style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
            />
          </div>
          <div className="text-lg font-semibold capitalize">{direction === "none" ? "center" : direction}</div>
          <div className="text-xs text-slate-400">steering</div>
        </div>

        {/* Track */}
        <div className="flex flex-col items-center justify-center">
          <Map className="h-6 w-6 mb-1" />
          <div className="text-lg font-semibold capitalize">{trackType}</div>
          <div className="text-xs text-slate-400">track</div>
        </div>
      </div>
    </Card>
  )
}
