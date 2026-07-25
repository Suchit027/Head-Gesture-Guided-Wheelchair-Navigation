"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Dashboard from "@/components/dashboard"
import TrackSelection from "@/components/track-selection"
import TrackEditor from "@/components/track-editor"
import HeadMovementIndicator from "@/components/head-movement-indicator"
import SpeedControls from "@/components/speed-controls"
import VideoFeed from "@/components/video-feed"
import { BUILTIN_TRACKS, type TrackSpec } from "@/lib/track"
import {
  deleteTrack,
  importTrack,
  loadSavedTracks,
  saveTrack,
} from "@/lib/track-storage"
import type { CameraMode, Telemetry } from "@/components/wheelchair-simulation"

// Loaded client-side only: the simulation touches WebGL, which has no
// server-side equivalent.
const WheelchairSimulation = dynamic(() => import("@/components/wheelchair-simulation"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900">
      <div className="text-white text-xl">Loading environment…</div>
    </div>
  ),
})

const EMPTY_TELEMETRY: Telemetry = {
  speed: 0,
  lateral: 0,
  onTrack: true,
  wrongWay: false,
  progress: 0,
  laps: 0,
  distance: 0,
  elapsed: 0,
  timeOnTrackRatio: 1,
  meanLateralError: 0,
}

export default function Home() {
  const [savedTracks, setSavedTracks] = useState<TrackSpec[]>([])
  const [currentTrack, setCurrentTrack] = useState<TrackSpec>(BUILTIN_TRACKS[0])
  const [editing, setEditing] = useState<TrackSpec | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)

  const [maxSpeed, setMaxSpeed] = useState(0.8)
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase")
  const [paused, setPaused] = useState(false)
  const [resetToken, setResetToken] = useState(0)

  const [direction, setDirection] = useState("none")
  const [isHeadControlActive, setIsHeadControlActive] = useState(false)
  const [telemetry, setTelemetry] = useState<Telemetry>(EMPTY_TELEMETRY)

  // localStorage is only available in the browser, so saved tracks load after
  // mount rather than during the initial render.
  useEffect(() => {
    setSavedTracks(loadSavedTracks())
  }, [])

  const tracks = [...BUILTIN_TRACKS, ...savedTracks]

  const restart = useCallback(() => {
    setResetToken((t) => t + 1)
    setTelemetry(EMPTY_TELEMETRY)
    setPaused(false)
  }, [])

  const handleSelectTrack = (track: TrackSpec) => {
    setCurrentTrack(track)
    restart()
  }

  const handleSaveTrack = (track: TrackSpec) => {
    setSavedTracks(saveTrack(track))
    setCurrentTrack(track)
    setIsEditorOpen(false)
    setEditing(null)
    restart()
  }

  const handleDeleteTrack = (id: string) => {
    const remaining = deleteTrack(id)
    setSavedTracks(remaining)
    // Fall back to a builtin if the track being driven was the one deleted.
    if (currentTrack.id === id) {
      setCurrentTrack(BUILTIN_TRACKS[0])
      restart()
    }
  }

  const handleImportTrack = (json: string) => {
    const imported = importTrack(json)
    if (!imported) {
      console.error("That file is not a valid track.")
      return
    }
    setSavedTracks(saveTrack(imported))
    setCurrentTrack(imported)
    restart()
  }

  const toggleHeadControl = () => {
    setIsHeadControlActive((active) => {
      if (active) setDirection("none")
      return !active
    })
  }

  // Identity-stable so the simulation's effect dependencies do not churn.
  const handleTelemetry = useCallback((next: Telemetry) => setTelemetry(next), [])

  return (
    <main className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      <header className="h-16 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-6 shrink-0">
        <h1 className="text-2xl font-bold">Wheelchair Gesture Training</h1>
        <p className="text-sm text-slate-400 hidden md:block">{currentTrack.name}</p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <WheelchairSimulation
            spec={currentTrack}
            direction={direction}
            maxSpeed={maxSpeed}
            cameraMode={cameraMode}
            keyboardControls={!isHeadControlActive}
            paused={paused}
            resetToken={resetToken}
            onTelemetry={handleTelemetry}
          />

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 pointer-events-none">
            <Dashboard
              telemetry={telemetry}
              trackName={currentTrack.name}
              trackWidth={currentTrack.width}
              direction={direction}
            />
          </div>

          {!isHeadControlActive && (
            <div className="absolute top-4 left-4 text-xs text-slate-400 bg-slate-900/70 rounded px-3 py-2">
              Arrow keys drive while head control is off
            </div>
          )}
        </div>

        <div className="w-[600px] bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden shrink-0">
          <Tabs defaultValue="controls" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-3 mx-4 mt-4 shrink-0">
              <TabsTrigger value="controls">Session</TabsTrigger>
              <TabsTrigger value="tracks">Environments</TabsTrigger>
              <TabsTrigger value="head">Head</TabsTrigger>
            </TabsList>

            <TabsContent value="controls" className="flex-1 p-4 overflow-auto space-y-4">
              <SpeedControls
                maxSpeed={maxSpeed}
                onMaxSpeedChange={setMaxSpeed}
                cameraMode={cameraMode}
                onCameraModeChange={setCameraMode}
                paused={paused}
                onTogglePause={() => setPaused((p) => !p)}
                onReset={restart}
                telemetry={telemetry}
              />
              <VideoFeed />
            </TabsContent>

            <TabsContent value="tracks" className="flex-1 p-4 overflow-auto">
              {isEditorOpen ? (
                <TrackEditor
                  initial={editing ?? undefined}
                  onSave={handleSaveTrack}
                  onCancel={() => {
                    setIsEditorOpen(false)
                    setEditing(null)
                  }}
                />
              ) : (
                <TrackSelection
                  tracks={tracks}
                  currentTrackId={currentTrack.id}
                  onSelect={handleSelectTrack}
                  onCreate={() => {
                    setEditing(null)
                    setIsEditorOpen(true)
                  }}
                  onEdit={(track) => {
                    setEditing(track)
                    setIsEditorOpen(true)
                  }}
                  onDelete={handleDeleteTrack}
                  onImport={handleImportTrack}
                />
              )}
            </TabsContent>

            <TabsContent value="head" className="flex-1 p-4 overflow-auto space-y-4">
              {/* The camera belongs on this tab, not only under Session:
                  "Set neutral position" is meaningless unless you can see that
                  the marker is actually being tracked at the moment you press
                  it. Tabs are mutually exclusive, so without this you would be
                  calibrating blind and checking the result on another tab. */}
              <VideoFeed />
              <HeadMovementIndicator
                isActive={isHeadControlActive}
                onToggle={toggleHeadControl}
                direction={direction}
                onDirectionChange={setDirection}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  )
}
