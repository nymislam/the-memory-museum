'use client';
import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig } from '@/lib/types';

export interface Motion { moving: boolean; speed: number }

interface Props {
  config: AvatarConfig;
  /** Mutable motion state, read every frame without re-rendering. */
  motion: RefObject<Motion>;
  shadows?: boolean;
}

/**
 * An elegant stylised figure built from primitives and driven entirely by an
 * AvatarConfig record. Walk and idle animation are procedural, so no rigged
 * model has to be downloaded. A GLB character can replace this component later
 * without touching the controllers or the network code.
 */
export function Avatar({ config, motion, shadows = true }: Props) {
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const blend = useRef(0);

  useFrame((state, dt) => {
    const m = motion.current;
    const target = m?.moving ? 1 : 0;
    blend.current += (target - blend.current) * Math.min(1, dt * 8);
    phase.current += dt * (m?.moving ? 7.5 * Math.max(0.6, (m.speed || 3) / 3.2) : 0);
    const swing = Math.sin(phase.current) * 0.55 * blend.current;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
    if (armL.current) armL.current.rotation.x = -swing * 0.7;
    if (armR.current) armR.current.rotation.x = swing * 0.7;
    if (body.current) {
      const breathe = Math.sin(state.clock.elapsedTime * 1.6) * 0.008 * (1 - blend.current);
      const bob = Math.abs(Math.cos(phase.current)) * 0.03 * blend.current;
      body.current.position.y = breathe + bob;
    }
  });

  const skirt = config.outfit === 'dress';
  const coat = config.outfit === 'coat';
  const cast = shadows;
  const fabric = { color: config.outfitColor, roughness: 0.75, metalness: 0.05 };
  const skin = { color: config.skin, roughness: 0.6 };
  const hair = { color: config.hair, roughness: 0.55 };
  const trousers = skirt ? config.skin : config.outfit === 'suit' ? config.outfitColor : '#2a2420';

  return (
    <group scale={config.height}>
      <group ref={body}>
        {/* legs */}
        {([[-0.1, legL], [0.1, legR]] as const).map(([x, ref]) => (
          <group key={x} ref={ref} position={[x, 0.88, 0]}>
            <mesh position={[0, -0.4, 0]} castShadow={cast}>
              <capsuleGeometry args={[0.075, 0.66, 4, 10]} />
              <meshStandardMaterial color={trousers} roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.84, 0.05]} castShadow={cast}>
              <boxGeometry args={[0.13, 0.08, 0.26]} />
              <meshStandardMaterial color="#17130F" roughness={0.4} />
            </mesh>
          </group>
        ))}

        {/* torso */}
        <mesh position={[0, 1.18, 0]} scale={[1, 1, 0.68]} castShadow={cast}>
          <capsuleGeometry args={[0.2, 0.36, 6, 14]} />
          <meshStandardMaterial {...fabric} />
        </mesh>
        {skirt && (
          <mesh position={[0, 0.6, 0]} castShadow={cast}>
            <cylinderGeometry args={[0.19, 0.44, 0.92, 20, 1, true]} />
            <meshStandardMaterial {...fabric} side={THREE.DoubleSide} />
          </mesh>
        )}
        {coat && (
          <mesh position={[0, 0.78, 0]} scale={[1, 1, 0.75]} castShadow={cast}>
            <cylinderGeometry args={[0.2, 0.29, 0.66, 18, 1, true]} />
            <meshStandardMaterial {...fabric} side={THREE.DoubleSide} />
          </mesh>
        )}
        {/* accent: sash or tie line */}
        <mesh position={[0, skirt ? 1.03 : 1.25, skirt ? 0 : 0.132]} rotation={[skirt ? Math.PI / 2 : 0, 0, 0]} scale={skirt ? [1, 0.7, 1] : [1, 1, 1]}>
          {skirt ? <torusGeometry args={[0.19, 0.022, 8, 24]} /> : <boxGeometry args={[0.05, 0.3, 0.02]} />}
          <meshStandardMaterial color={config.accentColor} metalness={0.6} roughness={0.35} />
        </mesh>

        {/* arms */}
        {([[-0.27, armL], [0.27, armR]] as const).map(([x, ref]) => (
          <group key={x} ref={ref} position={[x, 1.42, 0]}>
            <mesh position={[0, -0.28, 0]} castShadow={cast}>
              <capsuleGeometry args={[0.055, 0.46, 4, 10]} />
              <meshStandardMaterial {...fabric} />
            </mesh>
            <mesh position={[0, -0.6, 0]}>
              <sphereGeometry args={[0.058, 10, 10]} />
              <meshStandardMaterial {...skin} />
            </mesh>
          </group>
        ))}

        {/* neck + head */}
        <mesh position={[0, 1.52, 0]}>
          <cylinderGeometry args={[0.055, 0.065, 0.12, 12]} />
          <meshStandardMaterial {...skin} />
        </mesh>
        <mesh position={[0, 1.69, 0]} scale={[0.92, 1.06, 0.98]} castShadow={cast}>
          <sphereGeometry args={[0.155, 24, 20]} />
          <meshStandardMaterial {...skin} />
        </mesh>

        {/* hair */}
        {config.hairStyle !== 'none' && config.hairStyle !== 'covered' && (
          <mesh position={[0, 1.725, -0.028]} scale={[0.97, 1.02, 1.02]} castShadow={cast}>
            <sphereGeometry args={[0.162, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
            <meshStandardMaterial {...hair} />
          </mesh>
        )}
        {config.hairStyle === 'long' && (
          <mesh position={[0, 1.5, -0.09]} scale={[1, 1, 0.55]} castShadow={cast}>
            <capsuleGeometry args={[0.15, 0.3, 4, 14]} />
            <meshStandardMaterial {...hair} />
          </mesh>
        )}
        {config.hairStyle === 'bun' && (
          <mesh position={[0, 1.84, -0.1]} castShadow={cast}>
            <sphereGeometry args={[0.075, 14, 12]} />
            <meshStandardMaterial {...hair} />
          </mesh>
        )}
        {config.hairStyle === 'covered' && (
          <>
            <mesh position={[0, 1.7, -0.025]} scale={[1, 1.08, 1.04]} castShadow={cast}>
              <sphereGeometry args={[0.172, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
              <meshStandardMaterial color={config.accentColor} roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.47, -0.01]} scale={[1, 1, 0.8]}>
              <cylinderGeometry args={[0.13, 0.25, 0.2, 18, 1, true]} />
              <meshStandardMaterial color={config.accentColor} roughness={0.8} side={THREE.DoubleSide} />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
}
