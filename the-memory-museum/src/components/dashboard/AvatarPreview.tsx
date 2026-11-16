'use client';
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type { AvatarConfig } from '@/lib/types';
import { Avatar, type Motion } from '@/components/museum/Avatar';

function Turntable({ config, walking }: { config: AvatarConfig; walking: boolean }) {
  const g = useRef<THREE.Group>(null);
  const motion = useRef<Motion>({ moving: walking, speed: 3 });
  motion.current.moving = walking;
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.5; });
  return <group ref={g} position={[0, -0.95, 0]}><Avatar config={config} motion={motion} shadows={false} /></group>;
}

/** Live 3D preview used by the avatar customiser. */
export default function AvatarPreview({ config, walking }: { config: AvatarConfig; walking: boolean }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 32, position: [0, 0.25, 4.6] }}>
      <ambientLight intensity={1.1} color="#FFF1DC" />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#FFE8C8" />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#C6A36B" />
      <Turntable config={config} walking={walking} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.95, 0]}>
        <circleGeometry args={[1.1, 48]} />
        <meshStandardMaterial color="#D8C9B5" roughness={0.4} />
      </mesh>
    </Canvas>
  );
}
