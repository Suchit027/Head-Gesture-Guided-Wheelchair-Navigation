/**
 * Location of the Python gesture-tracking backend.
 *
 * Defaults to port 5001 rather than 5000: on macOS the AirPlay Receiver binds
 * 5000 and answers every request with a 403, which is indistinguishable from a
 * crashed backend. Override with NEXT_PUBLIC_BACKEND_URL if you run it
 * elsewhere — note that Next.js inlines this at build time, so a change needs a
 * dev-server restart.
 */
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5001"

export const VIDEO_FEED_URL = `${BACKEND_URL}/video_feed`
export const HEAD_DIRECTION_URL = `${BACKEND_URL}/head_direction`
export const CALIBRATE_URL = `${BACKEND_URL}/calibrate`

/** Shape of the /head_direction response. */
export interface HeadDirectionResponse {
  direction: string
  detected: boolean
  calibrated: boolean
  cameraOk: boolean
}
