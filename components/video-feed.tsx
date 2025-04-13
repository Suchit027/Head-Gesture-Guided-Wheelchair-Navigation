"use client"

import { useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface VideoFeedProps {
  isActive?: boolean
}

export default function VideoFeed({ isActive = true }: VideoFeedProps) {
  const videoRef = useRef<HTMLImageElement>(null)

  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Head Movement Detection</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="video-container">
          <h1>Live Video Feed</h1>
          <img
            ref={videoRef}
            src="http://localhost:5000/video_feed"
            alt="Live Processed Video"
            width="600"
            height="400"
          />
        </div>
      </CardContent>
    </Card>
  )
}
