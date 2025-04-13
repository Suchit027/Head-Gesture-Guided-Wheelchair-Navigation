"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Dashboard from "@/components/dashboard"
import TrackSelection from "@/components/track-selection"
import HeadMovementIndicator from "@/components/head-movement-indicator"
import SpeedControls from "@/components/speed-controls"
import VideoFeed from "@/components/video-feed"

// Dynamically import the 3D simulation to avoid SSR issues
const CarSimulation = dynamic(() => import("@/components/car-simulation"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-64px)] flex items-center justify-center bg-slate-900">
      <div className="text-white text-xl">Loading 3D Environment...</div>
    </div>
  ),
})

export default function Home() {
  const [speed, setSpeed] = useState(30)
  const [currentTrack, setCurrentTrack] = useState("city")
  const [direction, setDirection] = useState("none")
  const [isHeadControlActive, setIsHeadControlActive] = useState(false)

  const increaseSpeed = () => {
    setSpeed((prev) => Math.min(prev + 10, 120))
  }

  const decreaseSpeed = () => {
    setSpeed((prev) => Math.max(prev - 10, 10))
  }

  const toggleHeadControl = () => {
    setIsHeadControlActive(!isHeadControlActive)
    if (!isHeadControlActive) {
      console.log("Head control activated")
    } else {
      console.log("Head control deactivated")
      setDirection("none")
    }
  }

  const handleDirectionChange = (newDirection: string) => {
    setDirection(newDirection)
  }

  return (
    <main className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-6">
        <h1 className="text-2xl font-bold">Car Driving Simulation</h1>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* 3D Simulation */}
        <div className="flex-1 relative">
          <CarSimulation
            speed={speed}
            trackType={currentTrack}
            direction={direction}
            keyboardControls={!isHeadControlActive}
          />

          {/* Overlay Dashboard */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-3xl px-4">
            <Dashboard speed={speed} direction={direction} trackType={currentTrack} />
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-[600px] bg-slate-800 border-l border-slate-700 flex flex-col overflow-auto">
          <Tabs defaultValue="controls" className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-3 mx-4 mt-4">
              <TabsTrigger value="controls">Controls</TabsTrigger>
              <TabsTrigger value="tracks">Tracks</TabsTrigger>
              <TabsTrigger value="head">Head</TabsTrigger>
            </TabsList>

            <TabsContent value="controls" className="flex-1 p-4 overflow-auto">
              <SpeedControls speed={speed} onIncreaseSpeed={increaseSpeed} onDecreaseSpeed={decreaseSpeed} />

              {/* Always show video feed */}
              <div className="mt-4">
                <VideoFeed />
              </div>
            </TabsContent>

            <TabsContent value="tracks" className="flex-1 p-4 overflow-auto">
              <TrackSelection currentTrack={currentTrack} onTrackChange={setCurrentTrack} />

              {/* Always show video feed */}
              <div className="mt-4">
                <VideoFeed />
              </div>
            </TabsContent>

            <TabsContent value="head" className="flex-1 p-4 overflow-auto">
              <HeadMovementIndicator
                isActive={isHeadControlActive}
                onToggle={toggleHeadControl}
                direction={direction}
                onDirectionChange={handleDirectionChange}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
