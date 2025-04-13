"use client"

import { useBox } from "@react-three/cannon"
import { useFrame } from "@react-three/fiber"
import { useRef } from "react"

export default function CityTrack() {
  // Create a reference for animated elements
  const trafficLightsRef = useRef()

  // Animate traffic lights
  useFrame(({ clock }) => {
    if (trafficLightsRef.current) {
      const lights = trafficLightsRef.current.children
      const time = clock.getElapsedTime()

      // Cycle through red, yellow, green
      const phase = Math.floor(time % 6)

      lights.forEach((light, i) => {
        if (i === 0) {
          // Red
          light.material.emissive.set(phase < 3 ? "#ff0000" : "#330000")
        } else if (i === 1) {
          // Yellow
          light.material.emissive.set(phase === 3 ? "#ffff00" : "#333300")
        } else if (i === 2) {
          // Green
          light.material.emissive.set(phase > 3 ? "#00ff00" : "#003300")
        }
      })
    }
  })

  // Create a circular track
  const trackRadius = 50
  const trackWidth = 10
  const segments = 64

  return (
    <group>
      {/* Circular Road */}
      <CircularRoad radius={trackRadius} width={trackWidth} segments={segments} />

      {/* Buildings */}
      <Buildings radius={trackRadius} segments={segments} />

      {/* Street elements */}
      <StreetElements radius={trackRadius} segments={segments} />

      {/* Traffic lights */}
      <group ref={trafficLightsRef} position={[trackRadius, 3, 0]}>
        <mesh position={[0, 1, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#ffff00" emissive="#333300" />
        </mesh>
        <mesh position={[0, -1, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshStandardMaterial color="#00ff00" emissive="#003300" />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 4, 1]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      </group>

      {/* Obstacles */}
      <Obstacle position={[trackRadius - trackWidth / 2, 0.5, 0]} />
      <Obstacle position={[0, 0.5, trackRadius - trackWidth / 2]} />
      <Obstacle position={[-trackRadius + trackWidth / 2, 0.5, 0]} />
      <Obstacle position={[0, 0.5, -trackRadius + trackWidth / 2]} />

      {/* Track boundaries */}
      <TrackBoundaries radius={trackRadius} width={trackWidth} segments={segments} />
    </group>
  )
}

function CircularRoad({ radius, width, segments }) {
  // Create a ring geometry for the road
  const innerRadius = radius - width / 2
  const outerRadius = radius + width / 2

  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[innerRadius, outerRadius, segments]} />
      <meshStandardMaterial color="#555555" />

      {/* Road markings */}
      <RoadMarkings radius={radius} segments={segments} />
    </mesh>
  )
}

function RoadMarkings({ radius, segments }) {
  const markings = []
  const markingLength = 2
  const gap = 2
  const totalLength = markingLength + gap

  // Create dashed line in the middle of the road
  for (let i = 0; i < segments; i += 4) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const rotationY = angle + Math.PI / 2

    markings.push(
      <mesh key={`marking-${i}`} position={[x, 0.01, z]} rotation={[-Math.PI / 2, 0, rotationY]}>
        <planeGeometry args={[0.5, markingLength]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>,
    )
  }

  return <group>{markings}</group>
}

function Buildings({ radius, segments }) {
  const buildings = []
  const buildingRadius = radius + 20 // Place buildings outside the track

  // Place buildings around the track
  for (let i = 0; i < segments; i += 4) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * buildingRadius
    const z = Math.sin(angle) * buildingRadius

    // Random building properties
    const height = 10 + Math.random() * 20
    const width = 8 + Math.random() * 4
    const depth = 8 + Math.random() * 4
    const color = `#${Math.floor(Math.random() * 0x999999 + 0x666666).toString(16)}`

    buildings.push(
      <Building key={`building-${i}`} position={[x, height / 2, z]} size={[width, height, depth]} color={color} />,
    )
  }

  return <group>{buildings}</group>
}

function StreetElements({ radius, segments }) {
  const elements = []
  const lightRadius = radius + 5 // Place street lights just outside the track

  // Place street lights around the track
  for (let i = 0; i < segments; i += 8) {
    const angle = (i / segments) * Math.PI * 2
    const x = Math.cos(angle) * lightRadius
    const z = Math.sin(angle) * lightRadius
    const rotationY = angle + Math.PI / 2

    elements.push(<StreetLight key={`light-${i}`} position={[x, 0, z]} rotation={[0, rotationY, 0]} />)
  }

  return <group>{elements}</group>
}

function TrackBoundaries({ radius, width, segments }) {
  const boundaries = []
  const innerRadius = radius - width / 2
  const outerRadius = radius + width / 2

  // Create invisible collision boundaries along the track
  for (let i = 0; i < segments; i += 4) {
    const angle = (i / segments) * Math.PI * 2
    const innerX = Math.cos(angle) * innerRadius
    const innerZ = Math.sin(angle) * innerRadius
    const outerX = Math.cos(angle) * outerRadius
    const outerZ = Math.sin(angle) * outerRadius
    const rotationY = angle + Math.PI / 2

    // Inner boundary
    boundaries.push(
      <TrackBoundary
        key={`boundary-inner-${i}`}
        position={[innerX, 0.5, innerZ]}
        rotation={[0, rotationY, 0]}
        size={[1, 1, 5]}
      />,
    )

    // Outer boundary
    boundaries.push(
      <TrackBoundary
        key={`boundary-outer-${i}`}
        position={[outerX, 0.5, outerZ]}
        rotation={[0, rotationY, 0]}
        size={[1, 1, 5]}
      />,
    )
  }

  return <group>{boundaries}</group>
}

function Building({ position, size, color }) {
  // Create windows
  const windows = []
  const [width, height, depth] = size
  const windowSize = 1
  const spacing = 2

  for (let y = 2; y < height - 2; y += spacing) {
    for (let x = -width / 2 + 2; x < width / 2 - 1; x += spacing) {
      for (let z = -depth / 2 + 2; z < depth / 2 - 1; z += spacing) {
        // Only create windows on the outside faces
        if (Math.abs(x) > width / 2 - 3 || Math.abs(z) > depth / 2 - 3) {
          windows.push(
            <mesh key={`${x}-${y}-${z}`} position={[x, y, z]}>
              <boxGeometry args={[windowSize, windowSize, windowSize]} />
              <meshStandardMaterial color="#FFFDDD" emissive="#FFFDDD" emissiveIntensity={0.5} />
            </mesh>,
          )
        }
      }
    }
  }

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
      {windows}
    </group>
  )
}

function StreetLight({ position, rotation }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Pole */}
      <mesh castShadow>
        <cylinderGeometry args={[0.1, 0.1, 5, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Arm */}
      <mesh castShadow position={[0, 2.4, 0.5]}>
        <boxGeometry args={[0.1, 0.1, 1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Light */}
      <mesh position={[0, 2.4, 1]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#FFFDDD" emissive="#FFFDDD" emissiveIntensity={1} />
      </mesh>

      {/* Light cone */}
      <spotLight position={[0, 2.4, 1]} angle={0.5} penumbra={0.5} intensity={1} castShadow color="#FFFDDD" />
    </group>
  )
}

function Obstacle({ position }) {
  const [ref] = useBox(() => ({
    position,
    args: [1.5, 1, 1.5],
    type: "static",
  }))

  return (
    <mesh ref={ref} position={position} castShadow>
      <boxGeometry args={[1.5, 1, 1.5]} />
      <meshStandardMaterial color="#FF4444" />
    </mesh>
  )
}

function TrackBoundary({ position, rotation, size }) {
  const [ref] = useBox(() => ({
    position,
    rotation,
    args: size,
    type: "static",
  }))

  return (
    <mesh ref={ref} position={position} rotation={rotation} visible={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="red" transparent opacity={0.2} />
    </mesh>
  )
}
