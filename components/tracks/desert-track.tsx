"use client"

import { useBox } from "@react-three/cannon"
import { useFrame } from "@react-three/fiber"
import { useRef } from "react"
import * as THREE from "three"

export default function DesertTrack() {
  // Create refs for animated elements
  const tumbleweeds = useRef([])

  // Animate tumbleweeds
  useFrame(({ clock }) => {
    if (tumbleweeds.current.length > 0) {
      tumbleweeds.current.forEach((tumbleweed, i) => {
        if (tumbleweed) {
          const time = clock.getElapsedTime() + i * 100

          // Move and rotate the tumbleweed
          tumbleweed.position.x = Math.sin(time * 0.5) * 5 + 15
          tumbleweed.position.z = ((time * 2) % 300) - 150
          tumbleweed.rotation.x = time * 2
          tumbleweed.rotation.z = time * 3
        }
      })
    }
  })

  return (
    <group>
      {/* Desert terrain */}
      <mesh receiveShadow position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#D2B48C" />
      </mesh>

      {/* Road */}
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 300]} />
        <meshStandardMaterial color="#C19A6B" />

        {/* Road markings */}
        <group position={[0, 0, 0]}>
          {Array.from({ length: 60 }).map((_, i) => (
            <mesh key={i} position={[0, -i * 5 + 145, 0.01]} rotation={[0, 0, 0]}>
              <planeGeometry args={[0.5, 2]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          ))}
        </group>
      </mesh>

      {/* Cacti */}
      <Cactus position={[-8, 0, -20]} height={2} />
      <Cactus position={[-12, 0, -10]} height={3} />
      <Cactus position={[-9, 0, 5]} height={2.5} />
      <Cactus position={[-15, 0, 15]} height={2.2} />
      <Cactus position={[-10, 0, 25]} height={3.2} />
      <Cactus position={[-8, 0, 40]} height={2} />
      <Cactus position={[-12, 0, 55]} height={3} />
      <Cactus position={[-9, 0, 70]} height={2.5} />
      <Cactus position={[-15, 0, 85]} height={2.2} />
      <Cactus position={[-10, 0, 100]} height={3.2} />
      <Cactus position={[-8, 0, -40]} height={2} />
      <Cactus position={[-12, 0, -55]} height={3} />
      <Cactus position={[-9, 0, -70]} height={2.5} />
      <Cactus position={[-15, 0, -85]} height={2.2} />
      <Cactus position={[-10, 0, -100]} height={3.2} />

      <Cactus position={[8, 0, -20]} height={2} />
      <Cactus position={[12, 0, -10]} height={3} />
      <Cactus position={[9, 0, 5]} height={2.5} />
      <Cactus position={[15, 0, 15]} height={2.2} />
      <Cactus position={[10, 0, 25]} height={3.2} />
      <Cactus position={[8, 0, 40]} height={2} />
      <Cactus position={[12, 0, 55]} height={3} />
      <Cactus position={[9, 0, 70]} height={2.5} />
      <Cactus position={[15, 0, 85]} height={2.2} />
      <Cactus position={[10, 0, 100]} height={3.2} />
      <Cactus position={[8, 0, -40]} height={2} />
      <Cactus position={[12, 0, -55]} height={3} />
      <Cactus position={[9, 0, -70]} height={2.5} />
      <Cactus position={[15, 0, -85]} height={2.2} />
      <Cactus position={[10, 0, -100]} height={3.2} />

      {/* Sand dunes */}
      <SandDune position={[-20, 0, -30]} size={[15, 5, 10]} />
      <SandDune position={[-25, 0, 0]} size={[20, 7, 15]} />
      <SandDune position={[-18, 0, 30]} size={[12, 4, 8]} />
      <SandDune position={[-20, 0, 60]} size={[15, 5, 10]} />
      <SandDune position={[-25, 0, 90]} size={[20, 7, 15]} />
      <SandDune position={[-18, 0, 120]} size={[12, 4, 8]} />
      <SandDune position={[-20, 0, -60]} size={[15, 5, 10]} />
      <SandDune position={[-25, 0, -90]} size={[20, 7, 15]} />
      <SandDune position={[-18, 0, -120]} size={[12, 4, 8]} />

      <SandDune position={[20, 0, -30]} size={[15, 5, 10]} />
      <SandDune position={[25, 0, 0]} size={[20, 7, 15]} />
      <SandDune position={[18, 0, 30]} size={[12, 4, 8]} />
      <SandDune position={[20, 0, 60]} size={[15, 5, 10]} />
      <SandDune position={[25, 0, 90]} size={[20, 7, 15]} />
      <SandDune position={[18, 0, 120]} size={[12, 4, 8]} />
      <SandDune position={[20, 0, -60]} size={[15, 5, 10]} />
      <SandDune position={[25, 0, -90]} size={[20, 7, 15]} />
      <SandDune position={[18, 0, -120]} size={[12, 4, 8]} />

      {/* Obstacles */}
      <Barrel position={[-2, 0.5, -50]} />
      <Barrel position={[2, 0.5, 20]} />
      <Barrel position={[0, 0.5, 70]} />
      <Barrel position={[-1, 0.5, -100]} />
      <Barrel position={[1, 0.5, 120]} />

      {/* Tumbleweeds */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) tumbleweeds.current[i] = el
          }}
          position={[15, 1, -30 + i * 20]}
          castShadow
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color="#8B7355" wireframe />
        </mesh>
      ))}

      {/* Oasis */}
      <Oasis position={[-30, 0, 0]} />

      {/* Track boundaries */}
      <TrackBoundary position={[-5, 0.5, 0]} size={[1, 1, 300]} />
      <TrackBoundary position={[5, 0.5, 0]} size={[1, 1, 300]} />
      <TrackBoundary position={[0, 0.5, 150]} size={[10, 1, 1]} />
      <TrackBoundary position={[0, 0.5, -150]} size={[10, 1, 1]} />
    </group>
  )
}

function Cactus({ position, height }) {
  const bodyHeight = height
  const bodyRadius = height * 0.15

  // Randomize the cactus a bit
  const armHeight1 = height * (0.3 + Math.random() * 0.2)
  const armHeight2 = height * (0.2 + Math.random() * 0.2)
  const armPosition1 = height * (0.5 + Math.random() * 0.2)
  const armPosition2 = height * (0.6 + Math.random() * 0.2)
  const rotation = Math.random() * Math.PI * 2

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Main body */}
      <mesh castShadow position={[0, bodyHeight / 2, 0]}>
        <cylinderGeometry args={[bodyRadius, bodyRadius * 1.2, bodyHeight, 8]} />
        <meshStandardMaterial color="#2E8B57" />
      </mesh>

      {/* Arms */}
      <mesh castShadow position={[bodyRadius * 1.2, armPosition1, 0]} rotation={[0, 0, Math.PI / 4]}>
        <cylinderGeometry args={[bodyRadius * 0.6, bodyRadius * 0.7, armHeight1, 8]} />
        <meshStandardMaterial color="#2E8B57" />
      </mesh>

      <mesh castShadow position={[-bodyRadius * 1.2, armPosition2, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <cylinderGeometry args={[bodyRadius * 0.5, bodyRadius * 0.6, armHeight2, 8]} />
        <meshStandardMaterial color="#2E8B57" />
      </mesh>

      {/* Flowers */}
      <mesh position={[0, bodyHeight + 0.2, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#FF69B4" />
      </mesh>

      <mesh position={[bodyRadius * 1.2 + 0.5, armPosition1 + 0.5, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#FF69B4" />
      </mesh>
    </group>
  )
}

function SandDune({ position, size }) {
  // Create a more realistic dune with noise
  const geometry = new THREE.BoxGeometry(...size, 1, 1, 1)

  // Add some noise to the vertices
  const vertices = geometry.attributes.position.array
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 1] > 0) {
      // Only modify the top
      vertices[i + 1] += (Math.random() - 0.5) * (size[1] * 0.2)
    }
  }

  return (
    <mesh position={position} castShadow>
      <primitive object={geometry} />
      <meshStandardMaterial color="#E6C88C" />
    </mesh>
  )
}

function Barrel({ position }) {
  const [ref] = useBox(() => ({
    position,
    args: [1, 1.5, 1],
    type: "static",
  }))

  return (
    <mesh ref={ref} position={position} castShadow>
      <cylinderGeometry args={[0.5, 0.5, 1.5, 16]} />
      <meshStandardMaterial color="#8B4513" />
    </mesh>
  )
}

function Oasis({ position }) {
  return (
    <group position={position}>
      {/* Water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <circleGeometry args={[5, 32]} />
        <meshStandardMaterial color="#4a80bd" transparent opacity={0.8} metalness={0.1} roughness={0.2} />
      </mesh>

      {/* Palm trees */}
      <PalmTree position={[-2, 0, -2]} height={5} />
      <PalmTree position={[2, 0, 1]} height={6} />
      <PalmTree position={[0, 0, 3]} height={4} />

      {/* Sand border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[5, 6, 32]} />
        <meshStandardMaterial color="#E6C88C" />
      </mesh>
    </group>
  )
}

function PalmTree({ position, height }) {
  const trunkHeight = height
  const trunkRadius = height * 0.1

  return (
    <group position={position}>
      {/* Trunk - curved */}
      <mesh castShadow>
        <cylinderGeometry
          args={[trunkRadius, trunkRadius * 1.2, trunkHeight, 8]}
          // Apply a transformation to curve the trunk
          onUpdate={(geometry) => {
            const positionAttribute = geometry.attributes.position
            const vertex = new THREE.Vector3()

            for (let i = 0; i < positionAttribute.count; i++) {
              vertex.fromBufferAttribute(positionAttribute, i)

              // Apply a sine curve to the trunk
              const t = (vertex.y + trunkHeight / 2) / trunkHeight
              vertex.x += Math.sin(t * Math.PI) * 0.5

              positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z)
            }

            geometry.computeVertexNormals()
          }}
        />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Palm leaves */}
      <group position={[0.5, trunkHeight - 0.5, 0]}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
          const angle = (i / 8) * Math.PI * 2
          const x = Math.cos(angle) * 0.5
          const z = Math.sin(angle) * 0.5

          return (
            <mesh key={i} position={[x, 0, z]} rotation={[0.5, angle, 0.3]}>
              <coneGeometry args={[0.5, 2, 4]} />
              <meshStandardMaterial color="#228B22" side={THREE.DoubleSide} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

function TrackBoundary({ position, size }) {
  const [ref] = useBox(() => ({
    position,
    args: size,
    type: "static",
  }))

  return (
    <mesh ref={ref} position={position} visible={false}>
      <boxGeometry args={size} />
      <meshStandardMaterial color="red" transparent opacity={0.2} />
    </mesh>
  )
}
