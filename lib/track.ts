import * as THREE from "three"

/**
 * Track geometry core.
 *
 * A track is authored as a closed polygon whose vertices are the *centreline*
 * of the path the wheelchair drives. Everything else — the drivable ribbon,
 * kerbs, markings, scenery placement and off-track detection — is derived from
 * that polygon at load time.
 *
 * All units are metres. The world is scaled for a powered wheelchair
 * (~1.5 m/s top speed, ~1.2 m wide paths), not a car.
 */

export type Vec2 = { x: number; z: number }

export type TrackTheme = "indoor" | "city" | "park"

export interface TrackSpec {
  id: string
  name: string
  description: string
  /** Closed polygon, in metres. These are centreline vertices, not walls. */
  points: Vec2[]
  /** Drivable width of the path, in metres. */
  width: number
  /** Radius used to round off each corner so it is actually drivable. */
  cornerRadius: number
  theme: TrackTheme
  builtin?: boolean
}

/** A single point along the resampled centreline. */
export interface CenterlineSample {
  /** Position on the centreline. */
  p: Vec2
  /** Unit forward direction. */
  t: Vec2
  /** Unit right-hand normal — points to the driver's right. */
  n: Vec2
  /** Cumulative arc length from the start of the loop. */
  s: number
}

export interface NearestResult {
  /** Index of the nearest sample. */
  index: number
  /** Arc-length position of the projected point. */
  s: number
  /**
   * Signed lateral offset from the centreline, in metres.
   * Positive is to the driver's right, negative to their left.
   */
  lateral: number
  /** Forward direction of the track at the projected point. */
  tangent: Vec2
  /** The projected point itself. */
  point: Vec2
}

/** Spacing between resampled centreline points, in metres. */
const SAMPLE_SPACING = 0.35

/* ------------------------------------------------------------------ */
/* small 2D helpers                                                    */
/* ------------------------------------------------------------------ */

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z })
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z })
const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, z: a.z * k })
const len = (a: Vec2): number => Math.hypot(a.x, a.z)
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z
/** 2D cross product (z component of the 3D cross). Sign gives which side. */
const cross = (a: Vec2, b: Vec2): number => a.x * b.z - a.z * b.x

function normalize(a: Vec2): Vec2 {
  const l = len(a)
  return l < 1e-9 ? { x: 0, z: 0 } : { x: a.x / l, z: a.z / l }
}

/**
 * Rotate the tangent to get the right-hand normal.
 *
 * With the chair facing -Z at heading 0, this yields +X, which is the driver's
 * right — matching the sign convention used for lateral offset.
 */
const rightNormal = (t: Vec2): Vec2 => ({ x: -t.z, z: t.x })

/* ------------------------------------------------------------------ */
/* polygon -> filleted centreline                                      */
/* ------------------------------------------------------------------ */

/**
 * Round every corner of the polygon with a circular arc, keeping the straight
 * sections dead straight.
 *
 * A Catmull-Rom spline through the vertices would be shorter to write, but it
 * bows the straights outwards — a drawn square comes out looking like a blob.
 * Explicit fillets preserve the shape the user actually drew, which matters
 * when they are recreating a real corridor.
 *
 * The arc radius is clamped per corner so that two adjacent corners can never
 * eat into each other, no matter how tight the polygon is.
 */
export function filletPolygon(points: Vec2[], cornerRadius: number): Vec2[] {
  const n = points.length
  if (n < 3) return points.slice()

  const out: Vec2[] = []

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const cur = points[i]
    const next = points[(i + 1) % n]

    // Unit vectors pointing away from the corner, along each adjacent edge.
    const v1 = normalize(sub(prev, cur))
    const v2 = normalize(sub(next, cur))

    const lenPrev = len(sub(prev, cur))
    const lenNext = len(sub(next, cur))

    // Interior angle at this vertex.
    const cosTheta = THREE.MathUtils.clamp(dot(v1, v2), -1, 1)
    const theta = Math.acos(cosTheta)

    // Nearly straight, or folded back on itself: emit the raw vertex.
    if (theta > Math.PI - 1e-3 || theta < 1e-3) {
      out.push({ ...cur })
      continue
    }

    // Distance from the corner to each arc endpoint, along the edges.
    let tangentLen = cornerRadius / Math.tan(theta / 2)

    // Never consume more than a bit under half of either adjacent edge, so
    // neighbouring fillets cannot overlap.
    const maxTangent = 0.45 * Math.min(lenPrev, lenNext)
    if (tangentLen > maxTangent) tangentLen = maxTangent

    const radius = tangentLen * Math.tan(theta / 2)
    if (radius < 1e-4) {
      out.push({ ...cur })
      continue
    }

    const arcStart = add(cur, scale(v1, tangentLen))
    const arcEnd = add(cur, scale(v2, tangentLen))

    // Arc centre lies along the angle bisector.
    const bisector = normalize(add(v1, v2))
    const centre = add(cur, scale(bisector, radius / Math.sin(theta / 2)))

    const a0 = Math.atan2(arcStart.z - centre.z, arcStart.x - centre.x)
    const a1 = Math.atan2(arcEnd.z - centre.z, arcEnd.x - centre.x)

    // Always take the short way round — a fillet arc is never more than 180°.
    let delta = a1 - a0
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2

    // One segment per ~4° of arc keeps corners smooth without exploding the
    // sample count on gentle bends.
    const steps = Math.max(2, Math.ceil(Math.abs(delta) / (Math.PI / 45)))
    for (let k = 0; k <= steps; k++) {
      const a = a0 + (delta * k) / steps
      out.push({
        x: centre.x + Math.cos(a) * radius,
        z: centre.z + Math.sin(a) * radius,
      })
    }
  }

  return out
}

/* ------------------------------------------------------------------ */
/* centreline                                                          */
/* ------------------------------------------------------------------ */

/**
 * The resampled, closed centreline of a track, plus the queries the simulation
 * needs each frame.
 */
export class Centerline {
  readonly samples: CenterlineSample[]
  readonly length: number

  constructor(samples: CenterlineSample[], length: number) {
    this.samples = samples
    this.length = length
  }

  static fromSpec(spec: TrackSpec): Centerline {
    const filleted = filletPolygon(spec.points, spec.cornerRadius)
    return Centerline.fromPolyline(filleted)
  }

  /** Resample a closed polyline at uniform arc-length spacing. */
  static fromPolyline(poly: Vec2[]): Centerline {
    const n = poly.length
    if (n < 2) return new Centerline([], 0)

    // Cumulative length around the closed loop.
    const edgeLen: number[] = []
    let total = 0
    for (let i = 0; i < n; i++) {
      const l = len(sub(poly[(i + 1) % n], poly[i]))
      edgeLen.push(l)
      total += l
    }
    if (total < 1e-6) return new Centerline([], 0)

    const count = Math.max(8, Math.round(total / SAMPLE_SPACING))
    const step = total / count

    const positions: Vec2[] = []
    let edge = 0
    let consumed = 0 // distance already walked along the current edge

    for (let k = 0; k < count; k++) {
      let remaining = k * step - consumed
      while (edge < n && remaining > edgeLen[edge]) {
        remaining -= edgeLen[edge]
        consumed += edgeLen[edge]
        edge++
      }
      if (edge >= n) break

      const a = poly[edge]
      const b = poly[(edge + 1) % n]
      const f = edgeLen[edge] < 1e-9 ? 0 : remaining / edgeLen[edge]
      positions.push({ x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f })
    }

    // Tangents from central differences around the loop, so the seam at the
    // start/end of the lap is as smooth as everywhere else.
    const m = positions.length
    const samples: CenterlineSample[] = []
    let s = 0
    for (let i = 0; i < m; i++) {
      const prev = positions[(i - 1 + m) % m]
      const next = positions[(i + 1) % m]
      const t = normalize(sub(next, prev))
      samples.push({ p: positions[i], t, n: rightNormal(t), s })
      s += len(sub(positions[(i + 1) % m], positions[i]))
    }

    return new Centerline(samples, s)
  }

  /**
   * Nearest point on the centreline to (x, z), with signed lateral offset.
   *
   * `hint` is the previously returned index. Because the chair moves
   * continuously, searching a window around the last result is enough almost
   * every frame; pass `undefined` (or let the window fail) to fall back to a
   * full scan, which is what happens on spawn and after a reset.
   */
  nearest(x: number, z: number, hint?: number): NearestResult {
    const m = this.samples.length
    if (m === 0) {
      return { index: 0, s: 0, lateral: 0, tangent: { x: 0, z: -1 }, point: { x, z } }
    }

    const target = { x, z }
    let bestIndex = 0
    let bestDistSq = Infinity

    const scanRange = (from: number, to: number) => {
      for (let k = from; k <= to; k++) {
        const i = ((k % m) + m) % m
        const d = sub(this.samples[i].p, target)
        const dSq = d.x * d.x + d.z * d.z
        if (dSq < bestDistSq) {
          bestDistSq = dSq
          bestIndex = i
        }
      }
    }

    // A window of ±30 samples is ~10 m of track at the default spacing, far
    // more than the chair can cover between frames.
    const WINDOW = 30
    if (hint !== undefined && hint >= 0 && hint < m) {
      scanRange(hint - WINDOW, hint + WINDOW)
    }

    // If the windowed hit landed on the window edge we may have been chasing a
    // local minimum, so redo it properly.
    const offEdge =
      hint === undefined ||
      bestDistSq === Infinity ||
      Math.min(
        Math.abs(bestIndex - hint),
        m - Math.abs(bestIndex - hint),
      ) >= WINDOW - 1
    if (offEdge) {
      bestDistSq = Infinity
      scanRange(0, m - 1)
    }

    // Refine by projecting onto the two segments either side of the best
    // sample, so the result is continuous rather than quantised to samples.
    let best: NearestResult | null = null
    let bestRefinedSq = Infinity
    for (const seg of [bestIndex - 1, bestIndex]) {
      const i = ((seg % m) + m) % m
      const j = (i + 1) % m
      const a = this.samples[i].p
      const b = this.samples[j].p
      const ab = sub(b, a)
      const abLenSq = ab.x * ab.x + ab.z * ab.z
      if (abLenSq < 1e-12) continue

      const f = THREE.MathUtils.clamp(dot(sub(target, a), ab) / abLenSq, 0, 1)
      const point = add(a, scale(ab, f))
      const d = sub(target, point)
      const distSq = d.x * d.x + d.z * d.z

      if (distSq < bestRefinedSq) {
        bestRefinedSq = distSq
        const tangent = normalize(ab)
        // Sign of the cross product tells us which side of the track we are on.
        const side = cross(tangent, d) >= 0 ? 1 : -1
        const segLen = Math.sqrt(abLenSq)
        best = {
          index: i,
          s: (this.samples[i].s + segLen * f) % this.length,
          lateral: Math.sqrt(distSq) * side,
          tangent,
          point,
        }
      }
    }


    if (!best) {
      const sample = this.samples[bestIndex]
      const d = sub(target, sample.p)
      return {
        index: bestIndex,
        s: sample.s,
        lateral: len(d) * (cross(sample.t, d) >= 0 ? 1 : -1),
        tangent: sample.t,
        point: sample.p,
      }
    }
    return best
  }

  /** Position and heading at the start of the lap, for spawning the chair. */
  startPose(): { position: Vec2; heading: number } {
    if (this.samples.length === 0) {
      return { position: { x: 0, z: 0 }, heading: 0 }
    }
    const first = this.samples[0]
    return { position: first.p, heading: headingFromTangent(first.t) }
  }
}

/**
 * Convert a forward tangent to a Three.js Y-rotation.
 *
 * The chair model faces -Z locally (headlights/footplate at -Z), which is the
 * Three.js convention, so heading 0 points down -Z.
 */
export function headingFromTangent(t: Vec2): number {
  return Math.atan2(t.x, -t.z)
}

/** Forward tangent for a Y-rotation. Inverse of {@link headingFromTangent}. */
export function tangentFromHeading(heading: number): Vec2 {
  return { x: Math.sin(heading), z: -Math.cos(heading) }
}

/**
 * Three.js `rotation.y` that makes a -Z-facing model point along `heading`.
 *
 * Heading is measured clockwise from -Z (`atan2(t.x, -t.z)`), whereas a
 * Three.js Y-rotation is counter-clockwise. Assigning the heading directly to
 * `rotation.y` therefore mirrors the model about the Z axis: at heading 90° the
 * chair travels towards +X while the mesh faces -X, so in a turn the rider ends
 * up facing backwards relative to travel.
 */
export function yawForHeading(heading: number): number {
  return -heading
}

/* ------------------------------------------------------------------ */
/* geometry builders                                                   */
/* ------------------------------------------------------------------ */

/**
 * Build a closed ribbon of the given width around the centreline.
 *
 * `offset` shifts the whole ribbon sideways, which is how kerbs and verges are
 * built from the same function.
 */
export function buildRibbonGeometry(
  centerline: Centerline,
  width: number,
  offset = 0,
  y = 0,
): THREE.BufferGeometry {
  const samples = centerline.samples
  const m = samples.length
  const geometry = new THREE.BufferGeometry()
  if (m < 2) return geometry

  const positions = new Float32Array(m * 2 * 3)
  const uvs = new Float32Array(m * 2 * 2)
  const normals = new Float32Array(m * 2 * 3)

  const half = width / 2
  for (let i = 0; i < m; i++) {
    const { p, n, s } = samples[i]
    const lx = p.x + n.x * (offset + half)
    const lz = p.z + n.z * (offset + half)
    const rx = p.x + n.x * (offset - half)
    const rz = p.z + n.z * (offset - half)

    positions.set([lx, y, lz], i * 6)
    positions.set([rx, y, rz], i * 6 + 3)
    normals.set([0, 1, 0, 0, 1, 0], i * 6)
    // Repeat the texture once per metre travelled.
    uvs.set([0, s, 1, s], i * 4)
  }

  // Close the loop by wrapping the last quad back onto sample 0.
  const indices: number[] = []
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m
    const a = i * 2
    const b = i * 2 + 1
    const c = j * 2
    const d = j * 2 + 1
    indices.push(a, c, b, b, c, d)
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3))
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Evenly spaced poses along the centreline, offset sideways.
 * Used to place dashes, kerb posts and scenery without hardcoding coordinates.
 */
export function posesAlong(
  centerline: Centerline,
  spacing: number,
  offset = 0,
): { position: Vec2; normal: Vec2; heading: number; s: number }[] {
  const out: { position: Vec2; normal: Vec2; heading: number; s: number }[] = []
  if (centerline.samples.length === 0 || spacing <= 0) return out

  const count = Math.max(1, Math.floor(centerline.length / spacing))
  const m = centerline.samples.length

  for (let k = 0; k < count; k++) {
    const s = k * spacing
    // Samples are uniformly spaced, so index maps linearly from arc length.
    const idx = Math.min(m - 1, Math.round((s / centerline.length) * m))
    const sample = centerline.samples[idx]
    out.push({
      position: {
        x: sample.p.x + sample.n.x * offset,
        z: sample.p.z + sample.n.z * offset,
      },
      // Returned so callers can push a prop further out by its own size.
      normal: sample.n,
      heading: headingFromTangent(sample.t),
      s,
    })
  }
  return out
}

/**
 * Does an object of this footprint, placed here, stay clear of the path?
 *
 * Offsetting a curve sideways by more than the local radius of curvature makes
 * the offset curve fold back through itself, so on a tight corner a prop
 * "outside" the path can land on the far side of it. Rather than reasoning
 * about curvature, this measures the result: the prop's footprint is sampled
 * along its long axis and every sample must clear the path edge.
 */
export function footprintClearsPath(
  centerline: Centerline,
  position: Vec2,
  heading: number,
  halfLength: number,
  halfWidth: number,
  requiredClearance: number,
): boolean {
  const along = tangentFromHeading(heading)
  const limit = halfWidth + requiredClearance

  // Centre plus both ends; enough for the elongated props, and exact for the
  // compact ones where halfLength is ~0.
  for (const t of [-1, -0.5, 0, 0.5, 1]) {
    const probe = {
      x: position.x + along.x * halfLength * t,
      z: position.z + along.z * halfLength * t,
    }
    const near = centerline.nearest(probe.x, probe.z)
    if (Math.abs(near.lateral) < limit) return false
  }
  return true
}

/** Axis-aligned bounds of a polygon, with optional padding. */
export function polygonBounds(points: Vec2[], pad = 0) {
  if (points.length === 0) {
    return { minX: -pad, maxX: pad, minZ: -pad, maxZ: pad, width: pad * 2, depth: pad * 2 }
  }
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z)
    maxZ = Math.max(maxZ, p.z)
  }
  return {
    minX: minX - pad,
    maxX: maxX + pad,
    minZ: minZ - pad,
    maxZ: maxZ + pad,
    width: maxX - minX + pad * 2,
    depth: maxZ - minZ + pad * 2,
  }
}

/* ------------------------------------------------------------------ */
/* validation                                                          */
/* ------------------------------------------------------------------ */

export interface TrackValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/** True if segments ab and cd properly cross. Shared endpoints do not count. */
function segmentsIntersect(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  const d1 = cross(sub(b, a), sub(c, a))
  const d2 = cross(sub(b, a), sub(d, a))
  const d3 = cross(sub(d, c), sub(a, c))
  const d4 = cross(sub(d, c), sub(b, c))
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))
}

/**
 * Check a polygon is usable as a track.
 *
 * Errors block driving; warnings mean it will work but may be uncomfortable —
 * which is worth surfacing given the point of this app is realistic practice.
 */
export function validateTrack(spec: {
  points: Vec2[]
  width: number
  cornerRadius: number
}): TrackValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const { points, width, cornerRadius } = spec
  const n = points.length

  if (n < 3) {
    errors.push("A track needs at least 3 points.")
    return { valid: false, errors, warnings }
  }

  // Degenerate and self-crossing edges.
  for (let i = 0; i < n; i++) {
    const a = points[i]
    const b = points[(i + 1) % n]
    const segLen = len(sub(b, a))

    if (segLen < 1e-3) {
      errors.push(`Points ${i + 1} and ${((i + 1) % n) + 1} are on top of each other.`)
      continue
    }
    if (segLen < width) {
      warnings.push(
        `Segment ${i + 1} is ${segLen.toFixed(1)} m, shorter than the ${width.toFixed(
          1,
        )} m path width — it will feel cramped.`,
      )
    }

    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges: they legitimately share a vertex.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue
      const c = points[j]
      const d = points[(j + 1) % n]
      if (segmentsIntersect(a, b, c, d)) {
        errors.push(`The path crosses itself between segments ${i + 1} and ${j + 1}.`)
      }
    }
  }

  // Corners too tight for the fillet radius requested.
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const cur = points[i]
    const next = points[(i + 1) % n]
    const v1 = normalize(sub(prev, cur))
    const v2 = normalize(sub(next, cur))
    const theta = Math.acos(THREE.MathUtils.clamp(dot(v1, v2), -1, 1))

    if (theta < Math.PI / 6) {
      warnings.push(
        `Corner ${i + 1} is a ${THREE.MathUtils.radToDeg(theta).toFixed(
          0,
        )}° hairpin — hard to take in one pass.`,
      )
      continue
    }

    const needed = cornerRadius / Math.tan(theta / 2)
    const available = 0.45 * Math.min(len(sub(prev, cur)), len(sub(next, cur)))
    if (needed > available + 1e-6) {
      warnings.push(
        `Corner ${i + 1} is too tight for a ${cornerRadius.toFixed(
          1,
        )} m radius; it will be rounded less than requested.`,
      )
    }
  }

  // Dedupe so a single mistake does not produce a wall of near-identical text.
  return {
    valid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    warnings: Array.from(new Set(warnings)),
  }
}

/* ------------------------------------------------------------------ */
/* builtin tracks                                                      */
/* ------------------------------------------------------------------ */

/** A regular polygon, used to build the ring track. */
function regularPolygon(radius: number, sides: number): Vec2[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2
    return { x: Math.cos(a) * radius, z: Math.sin(a) * radius }
  })
}

export const BUILTIN_TRACKS: TrackSpec[] = [
  {
    id: "builtin-corridor",
    name: "Corridor Loop",
    description:
      "A rectangular indoor circuit at hallway scale. The gentlest place to start — four right-angle turns and nothing else.",
    points: [
      { x: -6, z: -4 },
      { x: 6, z: -4 },
      { x: 6, z: 4 },
      { x: -6, z: 4 },
    ],
    width: 1.4,
    cornerRadius: 1.2,
    theme: "indoor",
    builtin: true,
  },
  {
    id: "builtin-ring",
    name: "Practice Ring",
    description:
      "A wide continuous curve with no corners. Good for getting used to holding a steady turn and a steady speed.",
    points: regularPolygon(10, 12),
    width: 1.8,
    cornerRadius: 2.5,
    theme: "park",
    builtin: true,
  },
  {
    id: "builtin-block",
    name: "City Block",
    description:
      "Outdoor pavement circuit with a chicane and one tight corner. Practice for kerbs, crossings and traffic.",
    points: [
      { x: -14, z: -10 },
      { x: -2, z: -12 },
      { x: 8, z: -10 },
      { x: 14, z: -2 },
      { x: 12, z: 8 },
      { x: 2, z: 13 },
      { x: -9, z: 11 },
      { x: -15, z: 2 },
    ],
    width: 1.6,
    cornerRadius: 2,
    theme: "city",
    builtin: true,
  },
]

export function makeEmptyTrack(): TrackSpec {
  return {
    id: `track-${Date.now().toString(36)}`,
    name: "My Environment",
    description: "",
    points: [],
    width: 1.4,
    cornerRadius: 1.2,
    theme: "indoor",
  }
}
