"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Environment, PerspectiveCamera, Sky } from "@react-three/drei"
import * as THREE from "three"

import PolygonTrack from "./tracks/polygon-track"
import {
  Centerline,
  polygonBounds,
  tangentFromHeading,
  yawForHeading,
  type TrackSpec,
} from "@/lib/track"
import {
  makeChairState,
  MAX_TIMESTEP,
  stepChair,
  type ChairState,
} from "@/lib/wheelchair-model"

/**
 * Wheelchair training simulation.
 *
 * The chair is driven by a kinematic unicycle model integrated against real
 * elapsed time, not per-frame constants, so the timing a trainee learns here
 * transfers to a real chair regardless of their display's refresh rate.
 *
 * There is no rigid-body physics: a powered wheelchair on a flat floor is
 * fully described by (position, heading, speed), and collision with the path
 * edge is answered analytically from the centreline. That is both cheaper and
 * more accurate than boxing the track in with static colliders, and it works
 * for any polygon the user draws.
 */

export type CameraMode = "chase" | "first" | "overview"

export interface Telemetry {
  /** Current forward speed, m/s. Negative when reversing. */
  speed: number
  /** Signed distance from the path centre, metres. Positive is to the right. */
  lateral: number
  onTrack: boolean
  wrongWay: boolean
  /** Position around the lap, 0..1. */
  progress: number
  laps: number
  /** Total distance travelled, metres. */
  distance: number
  /** Seconds since the run started. */
  elapsed: number
  /** Fraction of elapsed time spent within the path edges, 0..1. */
  timeOnTrackRatio: number
  /** Mean absolute lateral error over the run, metres. */
  meanLateralError: number
}

/* ------------------------------------------------------------------ */
/* top-level component                                                 */
/* ------------------------------------------------------------------ */

interface WheelchairSimulationProps {
  spec: TrackSpec
  /** Latest gesture: "left" | "right" | "up" | "down" | "none". */
  direction: string
  /** Speed cap for this training level, m/s. */
  maxSpeed: number
  cameraMode: CameraMode
  keyboardControls?: boolean
  paused?: boolean
  /** Change this value to respawn the chair at the start line. */
  resetToken?: number
  onTelemetry?: (telemetry: Telemetry) => void
}

export default function WheelchairSimulation({
  spec,
  direction,
  maxSpeed,
  cameraMode,
  keyboardControls = true,
  paused = false,
  resetToken = 0,
  onTelemetry,
}: WheelchairSimulationProps) {
  const [keyDirection, setKeyDirection] = useState("none")

  // Arrow keys stand in for gestures so the sim can be exercised without a
  // camera — useful for setting up a route before a session.
  useEffect(() => {
    if (!keyboardControls) {
      setKeyDirection("none")
      return
    }

    const keyMap: Record<string, string> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const mapped = keyMap[e.key]
      if (mapped) {
        e.preventDefault()
        setKeyDirection(mapped)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keyMap[e.key]) setKeyDirection("none")
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [keyboardControls])

  const effectiveDirection = keyDirection !== "none" ? keyDirection : direction

  // Rebuilding the centreline is the expensive part of loading a track, so it
  // is tied to the spec rather than recomputed on every render.
  const centerline = useMemo(() => Centerline.fromSpec(spec), [spec])

  const hasTrack = centerline.samples.length > 0

  if (!hasTrack) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-400">
        <p>This track has no drivable path yet. Add at least 3 points in the editor.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <Canvas shadows>
        <Suspense fallback={null}>
          <Scene
            spec={spec}
            centerline={centerline}
            direction={effectiveDirection}
            maxSpeed={maxSpeed}
            cameraMode={cameraMode}
            paused={paused}
            resetToken={resetToken}
            onTelemetry={onTelemetry}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* scene                                                               */
/* ------------------------------------------------------------------ */

interface SceneProps {
  spec: TrackSpec
  centerline: Centerline
  direction: string
  maxSpeed: number
  cameraMode: CameraMode
  paused: boolean
  resetToken: number
  onTelemetry?: (telemetry: Telemetry) => void
}

function Scene({
  spec,
  centerline,
  direction,
  maxSpeed,
  cameraMode,
  paused,
  resetToken,
  onTelemetry,
}: SceneProps) {
  const chairRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  // Chair state lives in a ref: it changes every frame, and putting it in
  // React state would re-render the whole tree 60 times a second.
  const state = useRef<ChairState>(makeChairState(centerline))
  const telemetryClock = useRef(0)

  // Respawn on an explicit reset, and whenever the track itself changes.
  useEffect(() => {
    state.current = makeChairState(centerline)
  }, [centerline, resetToken])

  const overview = useMemo(() => {
    const b = polygonBounds(spec.points, 6)
    const span = Math.max(b.width, b.depth)
    return {
      centre: new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2),
      height: span * 1.1,
    }
  }, [spec.points])

  useFrame((_, rawDelta) => {
    const chair = state.current
    const group = chairRef.current
    if (!group) return

    // Clamp for the camera too: stepChair does its own clamping, but a long
    // stalled frame would otherwise make the damped follow jump.
    const delta = Math.min(rawDelta, MAX_TIMESTEP)

    if (!paused) {
      stepChair(chair, delta, direction, maxSpeed, centerline, spec.width)
    }

    // Apply the integrated state to the scene graph. The yaw conversion is not
    // optional — see yawForHeading.
    group.position.set(chair.x, 0, chair.z)
    group.rotation.y = yawForHeading(chair.heading)

    updateCamera(camera, cameraMode, chair, overview, delta)

    // Telemetry drives React state, so it is throttled to 10 Hz rather than
    // fired every frame.
    if (onTelemetry) {
      telemetryClock.current += delta
      if (telemetryClock.current >= 0.1) {
        telemetryClock.current = 0
        onTelemetry({
          speed: chair.speed,
          lateral: chair.lastLateral,
          onTrack: Math.abs(chair.lastLateral) <= spec.width / 2,
          wrongWay: chair.wrongWay,
          progress: centerline.length > 0 ? chair.lastS / centerline.length : 0,
          laps: chair.laps,
          distance: chair.distance,
          elapsed: chair.elapsed,
          timeOnTrackRatio: chair.elapsed > 0 ? chair.onTrackTime / chair.elapsed : 1,
          meanLateralError:
            chair.lateralSamples > 0 ? chair.lateralSum / chair.lateralSamples : 0,
        })
      }
    }
  })

  const isIndoor = spec.theme === "indoor"

  return (
    <>
      <PerspectiveCamera
        makeDefault
        fov={cameraMode === "first" ? 70 : 55}
        near={0.1}
        far={500}
        position={[0, 2, 6]}
      />

      <ambientLight intensity={isIndoor ? 0.85 : 0.5} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={isIndoor ? 0.6 : 1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />

      <Wheelchair ref={chairRef} />
      <PolygonTrack spec={spec} centerline={centerline} />

      {!isIndoor && (
        <>
          <Sky sunPosition={[100, 30, 100]} />
          <Environment preset={spec.theme === "park" ? "forest" : "city"} />
        </>
      )}
      {isIndoor && <Environment preset="apartment" />}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* camera                                                              */
/* ------------------------------------------------------------------ */

// Scratch vectors, reused every frame to avoid per-frame allocation.
const scratchTarget = new THREE.Vector3()
const scratchDesired = new THREE.Vector3()

/**
 * Position the camera for the selected view.
 *
 * The chase camera sits *behind* the chair and looks along its direction of
 * travel — the view you get in a driving game. The previous implementation
 * subtracted the offset instead of adding it, which placed the camera in front
 * of the vehicle looking back at it.
 */
function updateCamera(
  camera: THREE.Camera,
  mode: CameraMode,
  chair: ChairState,
  overview: { centre: THREE.Vector3; height: number },
  delta: number,
) {
  const forward = tangentFromHeading(chair.heading)

  if (mode === "overview") {
    // Straight down over the middle of the track, used to read the route.
    camera.position.set(overview.centre.x, overview.height, overview.centre.z + 0.01)
    camera.lookAt(overview.centre)
    return
  }

  if (mode === "first") {
    // Seated eye height, just ahead of the backrest.
    camera.position.set(
      chair.x + forward.x * 0.15,
      1.2,
      chair.z + forward.z * 0.15,
    )
    scratchTarget.set(chair.x + forward.x * 10, 1.1, chair.z + forward.z * 10)
    camera.lookAt(scratchTarget)
    return
  }

  // Chase: behind and slightly above, added along the chair's own heading.
  const BACK = 3.6
  const HEIGHT = 1.9
  scratchDesired.set(chair.x - forward.x * BACK, HEIGHT, chair.z - forward.z * BACK)

  // Damped follow so the camera trails the chair instead of snapping to it,
  // which would make every turn feel like a jump cut.
  const lambda = 6
  camera.position.x = THREE.MathUtils.damp(camera.position.x, scratchDesired.x, lambda, delta)
  camera.position.y = THREE.MathUtils.damp(camera.position.y, scratchDesired.y, lambda, delta)
  camera.position.z = THREE.MathUtils.damp(camera.position.z, scratchDesired.z, lambda, delta)

  // Aim ahead of the chair rather than at it, so the path the trainee is about
  // to drive occupies the middle of the screen.
  scratchTarget.set(chair.x + forward.x * 4, 0.9, chair.z + forward.z * 4)
  camera.lookAt(scratchTarget)
}

/* ------------------------------------------------------------------ */
/* chair model                                                         */
/* ------------------------------------------------------------------ */

/**
 * A powered wheelchair, facing -Z to match the heading convention.
 * Roughly life-sized: ~0.65 m wide, ~1.1 m long, seat at 0.5 m.
 */
function Wheelchair({ ref }: { ref?: React.Ref<THREE.Group> }) {
  return (
    <group ref={ref} dispose={null}>
      {/* Seat base */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[0.52, 0.1, 0.5]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* Backrest */}
      <mesh castShadow position={[0, 0.78, 0.24]}>
        <boxGeometry args={[0.52, 0.55, 0.08]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      {/* Chassis */}
      <mesh castShadow position={[0, 0.32, 0]}>
        <boxGeometry args={[0.42, 0.22, 0.72]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {/* Footplate, at the front (-Z) */}
      <mesh castShadow position={[0, 0.16, -0.46]}>
        <boxGeometry args={[0.38, 0.05, 0.26]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>

      {/* Armrests */}
      <mesh castShadow position={[-0.3, 0.68, 0]}>
        <boxGeometry args={[0.07, 0.06, 0.42]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh castShadow position={[0.3, 0.68, 0]}>
        <boxGeometry args={[0.07, 0.06, 0.42]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      {/* Large driven wheels at the back */}
      <DriveWheel position={[-0.34, 0.3, 0.16]} />
      <DriveWheel position={[0.34, 0.3, 0.16]} />

      {/* Small casters at the front */}
      <Caster position={[-0.24, 0.09, -0.36]} />
      <Caster position={[0.24, 0.09, -0.36]} />

      {/* Rider proxy — gives the first-person view a body and makes the chase
          view read as a person rather than a vehicle. */}
      <mesh castShadow position={[0, 0.85, 0.05]}>
        <capsuleGeometry args={[0.16, 0.34, 4, 12]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh castShadow position={[0, 1.16, 0.02]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial color="#d6a884" />
      </mesh>

      {/* Knees, so the seated posture is legible from behind */}
      <mesh castShadow position={[-0.12, 0.5, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.08, 0.28, 4, 8]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
      <mesh castShadow position={[0.12, 0.5, -0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <capsuleGeometry args={[0.08, 0.28, 4, 8]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
    </group>
  )
}

function DriveWheel({ position }: { position: [number, number, number] }) {
  return (
    // Rotation belongs on the mesh: a `rotation` prop on the geometry element
    // is silently ignored, which left the old car's wheels lying flat.
    <mesh position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.28, 0.28, 0.06, 20]} />
      <meshStandardMaterial color="#18181b" />
    </mesh>
  )
}

function Caster({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.09, 0.09, 0.05, 14]} />
      <meshStandardMaterial color="#27272a" />
    </mesh>
  )
}
