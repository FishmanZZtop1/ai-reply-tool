import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

function AuroraParticles() {
    const ref = useRef()
    const count = 3000

    const [positions] = useMemo(() => {
        const positions = new Float32Array(count * 3)
        const colors = new Float32Array(count * 3)

        // Pendo Magenta color palette
        const auroraColors = [
            new THREE.Color('#DE2864'),  // Primary magenta
            new THREE.Color('#C41E50'),  // Darker magenta
            new THREE.Color('#F03070'),  // Lighter magenta
            new THREE.Color('#FF4082'),  // Pink accent
            new THREE.Color('#9D1B48'),  // Deep magenta
        ]

        for (let i = 0; i < count; i++) {
            const i3 = i * 3
            // Distribute particles in a sphere
            const radius = 15 + Math.random() * 10
            const theta = Math.random() * Math.PI * 2
            const phi = Math.acos(2 * Math.random() - 1)

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
            positions[i3 + 2] = radius * Math.cos(phi)

            // Random aurora colors
            const color = auroraColors[Math.floor(Math.random() * auroraColors.length)]
            colors[i3] = color.r
            colors[i3 + 1] = color.g
            colors[i3 + 2] = color.b
        }

        return [positions, colors]
    }, [])

    useFrame((state, delta) => {
        if (ref.current) {
            ref.current.rotation.x += delta * 0.02
            ref.current.rotation.y += delta * 0.03
        }
    })

    return (
        <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
            <PointMaterial
                transparent
                vertexColors
                size={0.08}
                sizeAttenuation={true}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                opacity={0.6}
            />
        </Points>
    )
}

function AuroraGlow() {
    const meshRef = useRef()

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.z = state.clock.elapsedTime * 0.05
            meshRef.current.material.uniforms.time.value = state.clock.elapsedTime
        }
    })

    const shaderMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
            },
            vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        
        void main() {
          vec2 center = vec2(0.5, 0.5);
          float dist = distance(vUv, center);
          
          // Pendo Magenta gradient colors
          vec3 color1 = vec3(0.871, 0.157, 0.392); // #DE2864 - Primary magenta
          vec3 color2 = vec3(0.769, 0.118, 0.314); // #C41E50 - Darker magenta
          vec3 color3 = vec3(0.941, 0.188, 0.439); // #F03070 - Lighter magenta
          vec3 color4 = vec3(0.616, 0.106, 0.282); // #9D1B48 - Deep magenta
          
          float t = sin(time * 0.3 + dist * 3.0) * 0.5 + 0.5;
          vec3 gradient = mix(mix(color1, color2, t), mix(color3, color4, t), sin(time * 0.2) * 0.5 + 0.5);
          
          float alpha = smoothstep(0.8, 0.2, dist) * 0.2;
          gl_FragColor = vec4(gradient, alpha);
        }
      `,
            transparent: true,
            side: THREE.DoubleSide,
        })
    }, [])

    return (
        <mesh ref={meshRef} position={[0, 0, -5]}>
            <planeGeometry args={[30, 30]} />
            <primitive object={shaderMaterial} attach="material" />
        </mesh>
    )
}

export default function ThreeBackground() {
    return (
        <div id="three-canvas" className="fixed inset-0 -z-10 pointer-events-none">
            <Canvas
                camera={{ position: [0, 0, 10], fov: 60 }}
                gl={{ alpha: true, antialias: true }}
                style={{ background: 'transparent' }}
            >
                <ambientLight intensity={0.5} />
                <AuroraParticles />
                <AuroraGlow />
            </Canvas>
        </div>
    )
}
