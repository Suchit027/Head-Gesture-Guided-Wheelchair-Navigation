"use client"

import React from "react"
import { Suspense, useRef, useEffect, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { PerspectiveCamera, Environment, Sky, Stars } from "@react-three/drei"
import { Physics, useBox, usePlane } from "@react-three/cannon"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

// Track components
import CityTrack from "./tracks/city-track"
import MountainTrack from "./tracks/mountain-track"
import DesertTrack from "./tracks/desert-track"

interface CarSimulationProps {
  speed: number
  trackType: string
  direction: string
  keyboardControls?: boolean
}

export default function CarSimulation({ speed, trackType, direction, keyboardControls = true }: CarSimulationProps) {
  const [keyDirection, setKeyDirection] = useState("none")

  // Handle keyboard controls
  useEffect(() => {
    if (!keyboardControls) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          setKeyDirection("left")
          break
        case "ArrowRight":
          setKeyDirection("right")
          break
        case "ArrowUp":
          setKeyDirection("up")
          break
        case "ArrowDown":
          setKeyDirection("down")
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown":
          setKeyDirection("none")
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [keyboardControls])

  // Determine the effective direction (head movement or keyboard)
  const effectiveDirection = keyDirection !== "none" ? keyDirection : direction

  return (
    <div className="w-full h-[calc(100vh-64px)]">
      <Canvas shadows>
        <Suspense fallback={null}>
          <Scene speed={speed} trackType={trackType} direction={effectiveDirection} />
        </Suspense>
      </Canvas>
    </div>
  )
}

function Scene({ speed, trackType, direction }) {
  const carRef = useRef()
  const cameraRef = useRef()

  // Update camera position to follow the car
  useFrame(() => {
    if (carRef.current && cameraRef.current) {
      const carPosition = new THREE.Vector3()
      carRef.current.getWorldPosition(carPosition)

      // Get car rotation
      const carQuaternion = new THREE.Quaternion()
      carRef.current.getWorldQuaternion(carQuaternion)
      const carEuler = new THREE.Euler().setFromQuaternion(carQuaternion)

      // Calculate camera position behind the car
      const cameraOffset = new THREE.Vector3(0, 5, 10)
      cameraOffset.applyEuler(carEuler)

      // Set camera position
      cameraRef.current.position.x = carPosition.x - cameraOffset.x
      cameraRef.current.position.y = carPosition.y + cameraOffset.y
      cameraRef.current.position.z = carPosition.z - cameraOffset.z

      // Make camera look at car
      cameraRef.current.lookAt(carPosition)
    }
  })

  return (
    <>
      <PerspectiveCamera makeDefault ref={cameraRef} position={[0, 5, 10]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Physics>
        <Car ref={carRef} position={[0, 0.5, 0]} speed={speed} direction={direction} />

        {trackType === "city" && <CityTrack />}
        {trackType === "mountain" && <MountainTrack />}
        {trackType === "desert" && <DesertTrack />}

        <Ground />
      </Physics>

      {trackType === "city" && (
        <>
          <Sky sunPosition={[100, 10, 100]} />
          <Environment preset="city" />
        </>
      )}

      {trackType === "mountain" && (
        <>
          <Sky sunPosition={[10, 2, 1]} />
          <Environment preset="forest" />
          <fog attach="fog" args={["#90b4d6", 10, 100]} />
        </>
      )}

      {trackType === "desert" && (
        <>
          <Sky sunPosition={[1, 0.5, 0]} rayleigh={6} />
          <Environment preset="sunset" />
          {/* Add stars for desert night scene */}
          <Stars radius={100} depth={50} count={5000} factor={4} />
        </>
      )}
    </>
  )
}

const Car = React.forwardRef(({ position, speed, direction }, ref) => {
  const carRef = useRef()
  const [carColor] = useState(() => {
    // Random car color
    const colors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6"]
    return colors[Math.floor(Math.random() * colors.length)]
  })

  const [boxRef, api] = useBox(() => ({
    mass: 500,
    position,
    args: [2, 1, 4],
    allowSleep: false,
  }))

  // Combine refs
  React.useImperativeHandle(ref, () => boxRef.current)

  const currentSpeed = speed / 10 // Scale down the speed for better control

  // Create a circular path
  const radius = 50 // Radius of the circular track
  const center = new THREE.Vector3(0, 0, 0) // Center of the circular track
  const [angle, setAngle] = useState(0) // Current angle on the circular track
  const [isOnTrack, setIsOnTrack] = useState(true) // Whether the car is on the track

  useFrame(() => {
    if (!boxRef.current) return

    // Get current position and rotation
    const position = new THREE.Vector3()
    const quaternion = new THREE.Quaternion()
    boxRef.current.getWorldPosition(position)
    boxRef.current.getWorldQuaternion(quaternion)

    // Convert quaternion to Euler angles
    const euler = new THREE.Euler().setFromQuaternion(quaternion)

    // Calculate forward direction based on current rotation
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(euler)
    forward.multiplyScalar(currentSpeed * 0.01)

    // Apply direction changes based on head movement or keyboard
    let rotationChange = 0
    if (direction === "left") {
      rotationChange = 0.02
    } else if (direction === "right") {
      rotationChange = -0.02
    }

    // Apply rotation
    euler.y += rotationChange
    const newQuaternion = new THREE.Quaternion().setFromEuler(euler)

    // Apply movement
    api.position.set(position.x + forward.x, position.y, position.z + forward.z)
    api.rotation.copy(euler)

    // Check if car is too far from the center (off track)
    const distanceFromCenter = new THREE.Vector2(position.x, position.z).length()
    if (Math.abs(distanceFromCenter - radius) > 20) {
      // Car is off track, gradually guide it back
      const toCenter = new THREE.Vector3(center.x - position.x, 0, center.z - position.z).normalize()
      const correction = toCenter.multiplyScalar(0.05)
      api.position.set(position.x + correction.x, position.y, position.z + correction.z)
      setIsOnTrack(false)
    } else {
      setIsOnTrack(true)
    }
  })

  return (
    <group ref={boxRef} dispose={null}>
      {/* Car body */}
      <mesh castShadow>
        <boxGeometry args={[2, 0.5, 4]} />
        <meshStandardMaterial color={carColor} />
      </mesh>

      {/* Car cabin */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.5, 0.5, 2]} />
        <meshStandardMaterial color={carColor} />
      </mesh>

      {/* Wheels */}
      <Wheel position={[-1, -0.25, 1.5]} />
      <Wheel position={[1, -0.25, 1.5]} />
      <Wheel position={[-1, -0.25, -1.5]} />
      <Wheel position={[1, -0.25, -1.5]} />

      {/* Headlights */}
      <mesh position={[-0.6, 0, -2]} castShadow>
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color="#FFFF99" emissive="#FFFF99" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.6, 0, -2]} castShadow>
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color="#FFFF99" emissive="#FFFF99" emissiveIntensity={1} />
      </mesh>

      {/* Taillights */}
      <mesh position={[-0.6, 0, 2]} castShadow>
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.6, 0, 2]} castShadow>
        <boxGeometry args={[0.4, 0.2, 0.1]} />
        <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
})

function Wheel({ position }) {
  return (
    <mesh position={position} castShadow>
      <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} rotation={[Math.PI / 2, 0, 0]} />
      <meshStandardMaterial color="#111111" />
    </mesh>
  )
}

function Ground() {
  const [ref] = usePlane(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
  }))

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color="#303030" />
    </mesh>
  )
}
