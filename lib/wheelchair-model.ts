import { Centerline, tangentFromHeading } from "./track"

/**
 * Kinematic model of a powered wheelchair.
 *
 * Deliberately free of React and Three.js so the dynamics can be exercised
 * headlessly — the timing behaviour here is what a trainee actually learns, so
 * it needs to be testable without a browser.
 *
 * The chair is a unicycle: state is (position, heading, speed) and the wheels
 * are assumed not to slip. On a flat floor that is an accurate description of
 * a powered chair, and it avoids a rigid-body solver entirely.
 *
 * All units are SI — metres, seconds, radians.
 */

/** Forward acceleration under a sustained "up" gesture, m/s². */
export const ACCELERATION = 0.55
/** Deceleration under a sustained "down" gesture, m/s². */
export const BRAKING = 0.9
/** Passive slow-down when no gesture is held, m/s². */
export const COAST = 0.3
/** Maximum yaw rate, rad/s (~55°/s). */
export const MAX_TURN_RATE = (55 * Math.PI) / 180
/** Fastest reverse, as a fraction of the forward cap. */
export const REVERSE_FRACTION = 0.35
/** Speed multiplier once a wheel drops off the path edge. */
export const OFF_TRACK_SPEED_FACTOR = 0.45
/** Longest timestep the integrator will accept, seconds. */
export const MAX_TIMESTEP = 0.1

/**
 * Creep speed the chair settles at while steering, m/s.
 *
 * Steering implies wanting to go somewhere, so holding left or right brings the
 * chair up to a slow walk on its own. Without this the user has to alternate
 * between "accelerate" and "turn" to get round a corner, which is awkward with
 * a gesture detector that only reports one direction at a time.
 *
 * Capped against the session speed limit by TURN_ASSIST_MAX_FRACTION so that a
 * trainee on a deliberately gentle limit is never pushed past it.
 */
export const TURN_ASSIST_SPEED = 0.35
/** Turn assist will not exceed this fraction of the session speed limit. */
export const TURN_ASSIST_MAX_FRACTION = 0.5

export interface ChairState {
  x: number
  z: number
  heading: number
  speed: number
  /** Index of the last nearest centreline sample, used to seed the next search. */
  lastIndex: number
  /** Arc-length position from the last step. */
  lastS: number
  /** Lateral offset from the last step, reused by telemetry. */
  lastLateral: number
  laps: number
  distance: number
  elapsed: number
  onTrackTime: number
  lateralSum: number
  lateralSamples: number
  wrongWay: boolean
}

export function makeChairState(centerline: Centerline): ChairState {
  const { position, heading } = centerline.startPose()
  return {
    x: position.x,
    z: position.z,
    heading,
    speed: 0,
    lastIndex: 0,
    lastS: 0,
    lastLateral: 0,
    laps: 0,
    distance: 0,
    elapsed: 0,
    onTrackTime: 0,
    lateralSum: 0,
    lateralSamples: 0,
    wrongWay: false,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Advance the chair by one timestep.
 *
 * Speed is *persistent*: "up" and "down" change it, "left" and "right" steer
 * without altering it. That matters because the gesture backend emits one
 * direction at a time (its detector is an if/elif chain), so a model requiring
 * simultaneous throttle and steering would be undrivable. It also matches how
 * real head-gesture chairs behave.
 *
 * `delta` is real elapsed seconds, so behaviour does not vary with framerate.
 */
export function stepChair(
  chair: ChairState,
  delta: number,
  direction: string,
  maxSpeed: number,
  centerline: Centerline,
  trackWidth: number,
): void {
  // Clamp so an alt-tab or a stalled frame cannot teleport the chair through
  // a wall.
  const dt = Math.min(delta, MAX_TIMESTEP)
  if (dt <= 0) return

  chair.elapsed += dt

  const near = centerline.nearest(chair.x, chair.z, chair.lastIndex)
  const onTrack = Math.abs(near.lateral) <= trackWidth / 2

  // Dropping a wheel off the edge costs speed, the way a kerb or a carpet edge
  // would. It is a penalty, not a hard wall: being able to recover from a
  // mistake is the thing being trained.
  const speedCap = onTrack ? maxSpeed : maxSpeed * OFF_TRACK_SPEED_FACTOR
  const reverseCap = -speedCap * REVERSE_FRACTION

  // Creep target while steering. Never above the session limit, and never so
  // high that it fights a trainee who has deliberately chosen a gentle cap.
  const assistFloor = Math.min(TURN_ASSIST_SPEED, speedCap * TURN_ASSIST_MAX_FRACTION)

  switch (direction) {
    case "up":
      // An explicit command always wins: accelerating and braking ignore the
      // turn-assist floor entirely, so the user stays in charge of the speed.
      chair.speed += ACCELERATION * dt
      break

    case "down":
      chair.speed -= BRAKING * dt
      break

    case "left":
    case "right":
      // Speed is held while steering rather than coasting away, and creeps up
      // to the assist floor if the chair is going slower than that.
      //
      // Only when moving forwards: if the user is deliberately reversing, a
      // turn should steer the reverse, not shove them forwards again.
      if (chair.speed >= 0 && chair.speed < assistFloor) {
        chair.speed = Math.min(assistFloor, chair.speed + ACCELERATION * dt)
      }
      break

    default:
      // Coast toward a stop without overshooting into reverse.
      if (chair.speed > 0) chair.speed = Math.max(0, chair.speed - COAST * dt)
      else if (chair.speed < 0) chair.speed = Math.min(0, chair.speed + COAST * dt)
      break
  }
  chair.speed = clamp(chair.speed, reverseCap, speedCap)

  // Powered chairs limit yaw rate as speed rises, both for stability and to
  // stop a small gesture becoming a large swerve at pace.
  const speedRatio = maxSpeed > 0 ? Math.abs(chair.speed) / maxSpeed : 0
  const turnRate = MAX_TURN_RATE * (1 - 0.45 * Math.min(1, speedRatio))

  if (direction === "left") chair.heading -= turnRate * dt
  else if (direction === "right") chair.heading += turnRate * dt

  // Integrate position along the current heading.
  const forward = tangentFromHeading(chair.heading)
  const step = chair.speed * dt
  chair.x += forward.x * step
  chair.z += forward.z * step
  chair.distance += Math.abs(step)

  // Progress, lap counting and wrong-way detection all fall out of how the
  // arc-length position moved this step.
  const after = centerline.nearest(chair.x, chair.z, near.index)
  const loop = centerline.length
  let ds = after.s - chair.lastS
  // Unwrap across the start/finish seam.
  if (ds > loop / 2) ds -= loop
  else if (ds < -loop / 2) ds += loop

  if (Math.abs(step) > 1e-5) {
    // Reversing deliberately is a legitimate manoeuvre, so only driving
    // *forwards* against the track direction counts as going the wrong way.
    chair.wrongWay = chair.speed > 0.05 && ds < 0

    // A lap is a seam crossing: arc length jumped backwards while genuine
    // forward progress was made (or the reverse, when backing over the line).
    if (ds > 0 && after.s < chair.lastS) chair.laps += 1
    else if (ds < 0 && after.s > chair.lastS) chair.laps = Math.max(0, chair.laps - 1)
  } else {
    chair.wrongWay = false
  }

  chair.lastS = after.s
  chair.lastIndex = after.index
  chair.lastLateral = after.lateral

  if (onTrack) chair.onTrackTime += dt
  chair.lateralSum += Math.abs(after.lateral)
  chair.lateralSamples += 1
}
