"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VIDEO_FEED_URL } from "@/lib/backend"

export default function VideoFeed() {
  return (
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="text-xl">Marker tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* A plain <img> on an MJPEG endpoint: next/image would try to optimise
            a stream that never ends. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={VIDEO_FEED_URL}
          alt="Annotated camera feed showing the tracked green marker"
          width={600}
          height={400}
          className="w-full rounded border border-slate-700 bg-slate-950"
        />
        <p className="text-xs text-slate-500">
          The yellow box is the dead zone around your neutral position. The inset
          shows what the colour filter sees &mdash; the ball should appear there as
          a solid white blob.
        </p>
      </CardContent>
    </Card>
  )
}
