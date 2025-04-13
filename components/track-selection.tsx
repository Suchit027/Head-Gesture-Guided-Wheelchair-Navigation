"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Image from "next/image"

interface TrackSelectionProps {
  currentTrack: string
  onTrackChange: (track: string) => void
}

export default function TrackSelection({ currentTrack, onTrackChange }: TrackSelectionProps) {
  const tracks = [
    {
      id: "city",
      name: "City Track",
      description: "Navigate through a modern cityscape with tall buildings and wide streets.",
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      id: "mountain",
      name: "Mountain Track",
      description: "Drive through winding mountain roads surrounded by forests and cliffs.",
      image: "/placeholder.svg?height=200&width=300",
    },
    {
      id: "desert",
      name: "Desert Track",
      description: "Experience the thrill of racing through a vast desert under the stars.",
      image: "/placeholder.svg?height=200&width=300",
    },
  ]

  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Select Track</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`
              relative rounded-lg overflow-hidden cursor-pointer transition-all
              ${currentTrack === track.id ? "ring-2 ring-blue-500" : "opacity-70 hover:opacity-100"}
            `}
            onClick={() => onTrackChange(track.id)}
          >
            <Image
              src={track.image || "/placeholder.svg"}
              alt={track.name}
              width={300}
              height={150}
              className="w-full h-32 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-3">
              <h3 className="font-bold">{track.name}</h3>
              <p className="text-xs text-slate-300">{track.description}</p>
            </div>

            {currentTrack === track.id && (
              <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">Active</div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
