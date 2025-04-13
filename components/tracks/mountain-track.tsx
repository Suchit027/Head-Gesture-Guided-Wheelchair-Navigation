"use client"

import { useBox } from "@react-three/cannon"
import * as THREE from "three"

export default function MountainTrack() {
  return (
    <group>
      {/* Base terrain */}
      <mesh receiveShadow position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#4a6741" />
      </mesh>

      {/* Road */}
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 300]} />
        <meshStandardMaterial color="#8B4513" />

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

      {/* Mountains */}
      <Mountain position={[-20, 0, -30]} height={15} radius={10} color="#6B8E23" />
      <Mountain position={[-15, 0, -10]} height={10} radius={8} color="#556B2F" />
      <Mountain position={[-25, 0, 10]} height={18} radius={12} color="#808000" />
      <Mountain position={[-18, 0, 30]} height={12} radius={9} color="#6B8E23" />
      <Mountain position={[-20, 0, 50]} height={15} radius={10} color="#6B8E23" />
      <Mountain position={[-15, 0, 70]} height={10} radius={8} color="#556B2F" />
      <Mountain position={[-25, 0, 90]} height={18} radius={12} color="#808000" />
      <Mountain position={[-18, 0, 110]} height={12} radius={9} color="#6B8E23" />
      <Mountain position={[-20, 0, -50]} height={15} radius={10} color="#6B8E23" />
      <Mountain position={[-15, 0, -70]} height={10} radius={8} color="#556B2F" />
      <Mountain position={[-25, 0, -90]} height={18} radius={12} color="#808000" />
      <Mountain position={[-18, 0, -110]} height={12} radius={9} color="#6B8E23" />

      <Mountain position={[20, 0, -30]} height={15} radius={10} color="#6B8E23" />
      <Mountain position={[15, 0, -10]} height={10} radius={8} color="#556B2F" />
      <Mountain position={[25, 0, 10]} height={18} radius={12} color="#808000" />
      <Mountain position={[18, 0, 30]} height={12} radius={9} color="#6B8E23" />
      <Mountain position={[20, 0, 50]} height={15} radius={10} color="#6B8E23" />
      <Mountain position={[15, 0, 70]} height={10} radius={8} color="#556B2F" />
      <Mountain position={[25, 0, 90]} height={18} radius={12} color="#808000" />
      <Mountain position={[18, 0, 110]} height={12} radius={9} color="#6B8E23" />
      <Mountain position={[20, 0, -50]} height={15} radius={10} color="#6B8E23" />
      <Mountain position={[15, 0, -70]} height={10} radius={8} color="#556B2F" />
      <Mountain position={[25, 0, -90]} height={18} radius={12} color="#808000" />
      <Mountain position={[18, 0, -110]} height={12} radius={9} color="#6B8E23" />

      {/* Trees */}
      <TreeCluster position={[-8, 0, -20]} count={5} spread={3} />
      <TreeCluster position={[-7, 0, -5]} count={7} spread={4} />
      <TreeCluster position={[-9, 0, 10]} count={6} spread={3.5} />
      <TreeCluster position={[-8, 0, 25]} count={8} spread={5} />
      <TreeCluster position={[-8, 0, 40]} count={5} spread={3} />
      <TreeCluster position={[-7, 0, 55]} count={7} spread={4} />
      <TreeCluster position={[-9, 0, 70]} count={6} spread={3.5} />
      <TreeCluster position={[-8, 0, 85]} count={8} spread={5} />
      <TreeCluster position={[-8, 0, -35]} count={5} spread={3} />
      <TreeCluster position={[-7, 0, -50]} count={7} spread={4} />
      <TreeCluster position={[-9, 0, -65]} count={6} spread={3.5} />
      <TreeCluster position={[-8, 0, -80]} count={8} spread={5} />

      <TreeCluster position={[8, 0, -20]} count={5} spread={3} />
      <TreeCluster position={[7, 0, -5]} count={7} spread={4} />
      <TreeCluster position={[9, 0, 10]} count={6} spread={3.5} />
      <TreeCluster position={[8, 0, 25]} count={8} spread={5} />
      <TreeCluster position={[8, 0, 40]} count={5} spread={3} />
      <TreeCluster position={[7, 0, 55]} count={7} spread={4} />
      <TreeCluster position={[9, 0, 70]} count={6} spread={3.5} />
      <TreeCluster position={[8, 0, 85]} count={8} spread={5} />
      <TreeCluster position={[8, 0, -35]} count={5} spread={3} />
      <TreeCluster position={[7, 0, -50]} count={7} spread={4} />
      <TreeCluster position={[9, 0, -65]} count={6} spread={3.5} />
      <TreeCluster position={[8, 0, -80]} count={8} spread={5} />

      {/* Obstacles */}
      <FallenTree position={[-2, 0.5, -40]} rotation={[0, Math.PI / 4, 0]} />
      <FallenTree position={[2, 0.5, 30]} rotation={[0, -Math.PI / 3, 0]} />
      <Rock position={[0, 0.5, -10]} size={[2, 1, 2]} />
      <Rock position={[-1, 0.5, 50]} size={[1.5, 1.2, 1.5]} />
      <Rock position={[1.5, 0.5, 80]} size={[2.2, 1.5, 2.2]} />

      {/* Track boundaries */}
      <TrackBoundary position={[-5, 0.5, 0]} size={[1, 1, 300]} />
      <TrackBoundary position={[5, 0.5, 0]} size={[1, 1, 300]} />
      <TrackBoundary position={[0, 0.5, 150]} size={[10, 1, 1]} />
      <TrackBoundary position={[0, 0.5, -150]} size={[10, 1, 1]} />

      {/* River */}
      <River position={[-15, 0.1, 0]} width={5} length={300} />

      {/* Bridge */}
      <Bridge position={[0, 0.5, -15]} />
    </group>
  )
}

function Mountain({ position, height, radius, color }) {
  // Create a more realistic mountain with noise
  const segments = 32
  const geometry = new THREE.ConeGeometry(radius, height, segments)

  // Add some noise to the vertices
  const vertices = geometry.attributes.position.array
  for (let i = 0; i < vertices.length; i += 3) {
    if (vertices[i + 1] < height - 1) {
      // Don't modify the peak too much
      vertices[i] += (Math.random() - 0.5) * (radius * 0.2)
      vertices[i + 2] += (Math.random() - 0.5) * (radius * 0.2)
    }
  }

  // Add snow cap
  const snowCapGeometry = new THREE.ConeGeometry(radius * 0.4, height * 0.2, segments)
  const snowCapPosition = [0, height - height * 0.1, 0]

  return (
    <group position={position}>
      <mesh castShadow>
        <primitive object={geometry} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={snowCapPosition} castShadow>
        <primitive object={snowCapGeometry} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
    </group>
  )
}

function Tree({ position, height = 3 }) {
  const trunkHeight = height * 0.3
  const trunkRadius = height * 0.1
  const leavesHeight = height * 0.7
  const leavesRadius = height * 0.3

  // Randomize the tree a bit
  const scale = 0.8 + Math.random() * 0.4
  const rotation = Math.random() * Math.PI * 2

  return (
    <group position={position} scale={scale} rotation={[0, rotation, 0]}>
      {/* Trunk */}
      <mesh castShadow position={[0, trunkHeight / 2, 0]}>
        <cylinderGeometry args={[trunkRadius, trunkRadius * 1.2, trunkHeight, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Leaves - multiple layers for more realism */}
      <mesh castShadow position={[0, trunkHeight + leavesHeight * 0.25, 0]}>
        <coneGeometry args={[leavesRadius, leavesHeight * 0.5, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>

      <mesh castShadow position={[0, trunkHeight + leavesHeight * 0.5, 0]}>
        <coneGeometry args={[leavesRadius * 0.8, leavesHeight * 0.5, 8]} />
        <meshStandardMaterial color="#006400" />
      </mesh>

      <mesh castShadow position={[0, trunkHeight + leavesHeight * 0.75, 0]}>
        <coneGeometry args={[leavesRadius * 0.6, leavesHeight * 0.5, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
    </group>
  )
}

function TreeCluster({ position, count, spread }) {
  const trees = []

  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * spread
    const z = (Math.random() - 0.5) * spread
    const height = 2 + Math.random() * 2

    trees.push(<Tree key={i} position={[position[0] + x, position[1], position[2] + z]} height={height} />)
  }

  return <group>{trees}</group>
}

function FallenTree({ position, rotation }) {
  const [ref] = useBox(() => ({
    position,
    rotation,
    args: [5, 0.8, 0.8],
    type: "static",
  }))

  return (
    <mesh ref={ref} position={position} rotation={rotation} castShadow>
      <boxGeometry args={[5, 0.8, 0.8]} />
      <meshStandardMaterial color="#8B4513" />
    </mesh>
  )
}

function Rock({ position, size }) {
  const [ref] = useBox(() => ({
    position,
    args: size,
    type: "static",
  }))

  return (
    <mesh ref={ref} position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#777777" />
    </mesh>
  )
}

function River({ position, width, length }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#4a80bd" transparent opacity={0.8} metalness={0.1} roughness={0.2} />
      </mesh>
    </group>
  )
}

function Bridge({ position }) {
  return (
    <group position={position}>
      {/* Main bridge structure */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[10, 1, 5]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Railings */}
      <mesh castShadow position={[-4.5, 1.5, 0]}>
        <boxGeometry args={[1, 2, 5]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      <mesh castShadow position={[4.5, 1.5, 0]}>
        <boxGeometry args={[1, 2, 5]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Support beams */}
      <mesh castShadow position={[-4, -1, -2]}>
        <cylinderGeometry args={[0.5, 0.5, 4, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      <mesh castShadow position={[-4, -1, 2]}>
        <cylinderGeometry args={[0.5, 0.5, 4, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      <mesh castShadow position={[4, -1, -2]}>
        <cylinderGeometry args={[0.5, 0.5, 4, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      <mesh castShadow position={[4, -1, 2]}>
        <cylinderGeometry args={[0.5, 0.5, 4, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
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
