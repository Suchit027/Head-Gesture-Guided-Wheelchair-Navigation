"use client"

import { useMemo } from "react"
import * as THREE from "three"
import {
  buildRibbonGeometry,
  footprintClearsPath,
  polygonBounds,
  posesAlong,
  yawForHeading,
  type Centerline,
  type TrackSpec,
  type TrackTheme,
} from "@/lib/track"

/**
 * Renders any closed-polygon track.
 *
 * This replaces the old per-track components (city/mountain/desert), which
 * hardcoded both the road shape and every prop position. Here the shape comes
 * from the TrackSpec and every prop is placed by walking the centreline, so a
 * theme works on any polygon the user draws.
 */

interface PolygonTrackProps {
  spec: TrackSpec
  centerline: Centerline
}

interface ThemePalette {
  ground: string
  surface: string
  kerb: string
  marking: string
  /** Distance from the centreline to the scenery line, beyond the path edge. */
  sceneryOffset: number
  /** Metres between scenery props. */
  scenerySpacing: number
}

const PALETTES: Record<TrackTheme, ThemePalette> = {
  indoor: {
    ground: "#3f3f46",
    surface: "#d6d3d1",
    kerb: "#a8a29e",
    marking: "#f59e0b",
    sceneryOffset: 1.6,
    scenerySpacing: 4,
  },
  city: {
    ground: "#4b5563",
    surface: "#6b7280",
    kerb: "#9ca3af",
    marking: "#f8fafc",
    sceneryOffset: 3.2,
    scenerySpacing: 7,
  },
  park: {
    ground: "#4a6741",
    surface: "#a1866f",
    kerb: "#8b7355",
    marking: "#f5f5f4",
    sceneryOffset: 2.6,
    scenerySpacing: 5,
  },
}

export default function PolygonTrack({ spec, centerline }: PolygonTrackProps) {
  const palette = PALETTES[spec.theme]

  // All geometry is derived once per track. Rebuilding it per frame would be
  // pointless work — the track never changes while you are driving it.
  const { surface, kerbLeft, kerbRight } = useMemo(() => {
    const kerbWidth = 0.12
    const edge = spec.width / 2 + kerbWidth / 2
    return {
      surface: buildRibbonGeometry(centerline, spec.width, 0, 0.01),
      kerbLeft: buildRibbonGeometry(centerline, kerbWidth, -edge, 0.04),
      kerbRight: buildRibbonGeometry(centerline, kerbWidth, edge, 0.04),
    }
  }, [centerline, spec.width])

  const bounds = useMemo(() => polygonBounds(spec.points, 30), [spec.points])

  // Dashes are spaced by arc length, so they stay even through the corners.
  const dashes = useMemo(() => posesAlong(centerline, 2.4, 0), [centerline])

  const scenery = useMemo(
    () => placeScenery(centerline, spec, palette),
    [centerline, spec, palette],
  )

  const start = centerline.samples[0]

  return (
    <group>
      {/* Ground plane, sized to the polygon rather than a fixed 300 m slab. */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(bounds.minX + bounds.maxX) / 2, -0.02, (bounds.minZ + bounds.maxZ) / 2]}
      >
        <planeGeometry args={[bounds.width, bounds.depth]} />
        <meshStandardMaterial color={palette.ground} />
      </mesh>

      {/* Drivable surface */}
      <mesh geometry={surface} receiveShadow>
        <meshStandardMaterial color={palette.surface} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Kerbs, so the path edge is readable from the driving view */}
      <mesh geometry={kerbLeft}>
        <meshStandardMaterial color={palette.kerb} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={kerbRight}>
        <meshStandardMaterial color={palette.kerb} side={THREE.DoubleSide} />
      </mesh>

      {/* Centre dashes */}
      <group>
        {dashes.map((pose, i) => (
          <mesh
            key={`dash-${i}`}
            position={[pose.position.x, 0.02, pose.position.z]}
            rotation={[-Math.PI / 2, 0, -pose.heading]}
          >
            <planeGeometry args={[0.1, 0.8]} />
            <meshStandardMaterial color={palette.marking} />
          </mesh>
        ))}
      </group>

      {/* Start / finish line */}
      {start && (
        <mesh
          position={[start.p.x, 0.03, start.p.z]}
          rotation={[-Math.PI / 2, 0, -Math.atan2(start.t.x, -start.t.z)]}
        >
          <planeGeometry args={[spec.width, 0.3]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.4} />
        </mesh>
      )}

      {/* Theme scenery. Placement accounts for each prop's own size, and
          anything that would still overlap the path has been dropped. */}
      <group>
        {scenery.map((placed, i) => (
          <SceneryProp key={`prop-${i}`} placed={placed} />
        ))}
      </group>
    </group>
  )
}


/* ------------------------------------------------------------------ */
/* scenery                                                             */
/* ------------------------------------------------------------------ */

/**
 * A prop's dimensions, decided once and used for *both* placement and
 * rendering.
 *
 * Keeping these together is the point. When the renderer chose its own size
 * independently of the placement code, an 8 m-wide building could be dropped
 * 4 m from the centreline and half of it would sit on the path.
 */
type PropSpec =
  | { kind: "building"; width: number; depth: number; height: number; color: string }
  | { kind: "streetlight" }
  | { kind: "tree"; height: number }
  | { kind: "bench" }
  | { kind: "wall"; length: number; height: number }
  | { kind: "doorway" }
  | { kind: "cabinet" }

interface PlacedProp {
  spec: PropSpec
  position: { x: number; z: number }
  yaw: number
}

/** Half-extent perpendicular to the path. Drives how far out the prop sits. */
function lateralHalfExtent(spec: PropSpec): number {
  switch (spec.kind) {
    case "building": return spec.width / 2
    case "streetlight": return 0.2
    case "tree": return spec.height * 0.35
    case "bench": return 0.2
    // A wall is thin across the path even though it is long along it.
    case "wall": return 0.08
    case "doorway": return 0.08
    case "cabinet": return 0.25
  }
}

/** Half-extent along the path. Used for the overlap check on tight corners. */
function longitudinalHalfExtent(spec: PropSpec): number {
  switch (spec.kind) {
    case "building": return spec.depth / 2
    case "streetlight": return 0.2
    case "tree": return spec.height * 0.35
    case "bench": return 0.7
    case "wall": return spec.length / 2
    case "doorway": return 0.55
    case "cabinet": return 0.6
  }
}

/**
 * Deterministic pseudo-random variation from an index.
 *
 * Math.random() here would reshuffle every prop on each React re-render,
 * making the whole world visibly flicker.
 */
function hashUnit(index: number): number {
  const seed = Math.sin(index * 12.9898) * 43758.5453
  return seed - Math.floor(seed)
}

function describeProp(theme: TrackTheme, rand: number): PropSpec {
  if (theme === "city") {
    if (rand < 0.45) {
      const width = 4 + rand * 4
      return {
        kind: "building",
        width,
        depth: width * 0.8,
        height: 6 + rand * 24,
        color: `hsl(${210 + rand * 40}, 12%, ${35 + rand * 20}%)`,
      }
    }
    return { kind: "streetlight" }
  }

  if (theme === "park") {
    if (rand < 0.75) return { kind: "tree", height: 2.5 + rand * 3 }
    return { kind: "bench" }
  }

  if (rand < 0.7) return { kind: "wall", length: 3.6, height: 2.4 }
  if (rand < 0.85) return { kind: "doorway" }
  return { kind: "cabinet" }
}

/**
 * Choose where every prop goes.
 *
 * Each prop is pushed out from the path edge by its own lateral size, then
 * checked against the path and discarded if it still overlaps — which happens
 * on corners tight enough that the offset curve folds back through itself.
 */
function placeScenery(
  centerline: Centerline,
  spec: TrackSpec,
  palette: ThemePalette,
): PlacedProp[] {
  const halfWidth = spec.width / 2
  const placed: PlacedProp[] = []

  const sides: { spacing: number; sign: number; seed: number }[] = [
    { spacing: palette.scenerySpacing, sign: 1, seed: 0 },
    { spacing: palette.scenerySpacing * 1.6, sign: -1, seed: 977 },
  ]

  for (const side of sides) {
    // Walk the centreline itself; the sideways offset is applied per prop
    // below, because it depends on how big that prop turned out to be.
    const poses = posesAlong(centerline, side.spacing, 0)

    poses.forEach((pose, i) => {
      const propSpec = describeProp(spec.theme, hashUnit(side.seed + i))
      const offset =
        side.sign * (halfWidth + palette.sceneryOffset + lateralHalfExtent(propSpec))

      const position = {
        x: pose.position.x + pose.normal.x * offset,
        z: pose.position.z + pose.normal.z * offset,
      }

      // Final guard: on a corner whose radius is smaller than the offset, the
      // offset curve folds over and this position can land across the path.
      const clears = footprintClearsPath(
        centerline,
        position,
        pose.heading,
        longitudinalHalfExtent(propSpec),
        halfWidth,
        lateralHalfExtent(propSpec) * 0.5,
      )
      if (!clears) return

      placed.push({ spec: propSpec, position, yaw: yawForHeading(pose.heading) })
    })
  }

  return placed
}

function SceneryProp({ placed }: { placed: PlacedProp }) {
  const { spec, position, yaw } = placed
  // yaw is already converted from the track heading — see yawForHeading.
  const at: [number, number, number] = [position.x, 0, position.z]

  switch (spec.kind) {
    case "building":
      return (
        <mesh castShadow position={[position.x, spec.height / 2, position.z]} rotation={[0, yaw, 0]}>
          <boxGeometry args={[spec.width, spec.height, spec.depth]} />
          <meshStandardMaterial color={spec.color} />
        </mesh>
      )

    case "streetlight":
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh castShadow position={[0, 1.75, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 3.5, 8]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <mesh position={[0, 3.5, 0]}>
            <sphereGeometry args={[0.16, 12, 12]} />
            <meshStandardMaterial color="#fffdd0" emissive="#fffdd0" emissiveIntensity={1} />
          </mesh>
        </group>
      )

    case "tree":
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh castShadow position={[0, spec.height * 0.3, 0]}>
            <cylinderGeometry args={[0.12, 0.18, spec.height * 0.6, 8]} />
            <meshStandardMaterial color="#5b3a29" />
          </mesh>
          <mesh castShadow position={[0, spec.height * 0.75, 0]}>
            <coneGeometry args={[spec.height * 0.35, spec.height * 0.7, 9]} />
            <meshStandardMaterial color="#2f6b32" />
          </mesh>
        </group>
      )

    case "bench":
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh castShadow position={[0, 0.45, 0]}>
            <boxGeometry args={[0.4, 0.08, 1.4]} />
            <meshStandardMaterial color="#8b5a2b" />
          </mesh>
          <mesh castShadow position={[0, 0.22, 0]}>
            <boxGeometry args={[0.08, 0.35, 1.2]} />
            <meshStandardMaterial color="#6b7280" />
          </mesh>
        </group>
      )

    case "wall":
      return (
        <mesh
          castShadow
          receiveShadow
          position={[position.x, spec.height / 2, position.z]}
          rotation={[0, yaw, 0]}
        >
          {/* Thin across the path, long along it. */}
          <boxGeometry args={[0.15, spec.height, spec.length]} />
          <meshStandardMaterial color="#e7e5e4" />
        </mesh>
      )

    case "doorway":
      return (
        <group position={at} rotation={[0, yaw, 0]}>
          <mesh castShadow position={[0, 1.05, -0.45]}>
            <boxGeometry args={[0.16, 2.1, 0.12]} />
            <meshStandardMaterial color="#78716c" />
          </mesh>
          <mesh castShadow position={[0, 1.05, 0.45]}>
            <boxGeometry args={[0.16, 2.1, 0.12]} />
            <meshStandardMaterial color="#78716c" />
          </mesh>
          <mesh castShadow position={[0, 2.15, 0]}>
            <boxGeometry args={[0.16, 0.12, 1.02]} />
            <meshStandardMaterial color="#78716c" />
          </mesh>
        </group>
      )

    case "cabinet":
      return (
        <mesh castShadow position={[position.x, 0.4, position.z]} rotation={[0, yaw, 0]}>
          <boxGeometry args={[0.5, 0.8, 1.2]} />
          <meshStandardMaterial color="#a16207" />
        </mesh>
      )
  }
}
