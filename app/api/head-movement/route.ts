import { NextResponse } from "next/server"
import { processHeadMovementData } from "@/lib/head-movement-api"

// This would be a real API endpoint that receives data from the Python script
// and forwards it to the frontend

export async function GET() {
  // In a real implementation, this would get the latest head movement data
  // from a database or in-memory store that's updated by the Python script

  // For demonstration, we'll return random directions
  const directions = ["left", "right", "up", "down", "none"]
  const randomIndex = Math.floor(Math.random() * directions.length)

  return NextResponse.json({ direction: directions[randomIndex] })
}

export async function POST(request: Request) {
  // In a real implementation, this would receive data from the Python script
  // and store it for retrieval by the frontend

  try {
    const data = await request.json()

    // Process the data from the Python script
    // The Python script sends data in the format: { command: 'left' | 'right' | 'up' | 'down' | 'error' }
    const direction = processHeadMovementData(data.command)

    // In a real implementation, you would store this in a database or in-memory store
    console.log("Received head movement data:", direction)

    return NextResponse.json({ success: true, direction })
  } catch (error) {
    console.error("Error processing head movement data:", error)
    return NextResponse.json({ success: false, error: "Failed to process data" }, { status: 400 })
  }
}
