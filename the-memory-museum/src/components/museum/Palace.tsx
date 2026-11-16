'use client';
import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { Instance, Instances, MeshReflectorMaterial, Sparkles } from '@react-three/drei';
import {
  CORRIDOR_H, CORRIDOR_W, DOOR_H, DOOR_W, WALL_T,
  type CorridorLayout, type PalaceLayout, type RoomLayout,
} from '@/lib/palace/layout';
import type { MemoryData, MuseumData } from '@/lib/types';
import { ceilingTexture, marbleTexture, panelTexture } from './textures';
import { BRONZE, CRYSTAL, FLAME, GOLD, GOLD_SOFT, STONE } from './materials';
import { Label } from './Label';
import { PhotoFrame } from './PhotoFrame';

interface PalaceProps {
  layout: PalaceLayout;
  museum: MuseumData;
  quality: 'high' | 'low';
  roomIndex: number;
  nearbyId: string | null;
  onOpen: (m: MemoryData) => void;
}

export function Palace({ layout, museum, quality, roomIndex, nearbyId, onOpen }: PalaceProps) {
  return (
    <group>
      <Floor layout={layout} reflective={quality === 'high'} />
      {layout.rooms.map((r) => (
        <group key={r.room.id}>
          <RoomShell r={r} layout={layout} museum={museum} lit={Math.abs(r.index - Math.max(roomIndex, 0)) <= 2 || quality === 'high'} />
          {r.frames.map((f) => (
            <PhotoFrame
              key={f.memory.id}
              placed={f}
              active={roomIndex < 0 || Math.abs(r.index - roomIndex) <= 1}
              highlighted={nearbyId === f.memory.id}
              onOpen={() => onOpen(f.memory)}
            />
          ))}
        </group>
      ))}
      {layout.corridors.map((c) => <CorridorShell key={c.index} c={c} />)}
    </group>
  );
}

/* ------------------------------------------------------------------ floor */

function Floor({ layout, reflective }: { layout: PalaceLayout; reflective: boolean }) {
  const b = layout.bounds;
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const map = useMemo(() => {
    const t = marbleTexture().clone();
    t.repeat.set(w / 4, d / 4);
    t.needsUpdate = true;
    return t;
  }, [w, d]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2]} receiveShadow>
      <planeGeometry args={[w, d]} />
      {reflective ? (
        <MeshReflectorMaterial
          map={map}
          resolution={1024}
          mirror={0.5}
          mixStrength={0.55}
          color="#e2d8c8"
          mixBlur={0.6}
          blur={[220, 80]}
          roughness={0.35}
          metalness={0.1}
          depthScale={0.6}
          minDepthThreshold={0.6}
          maxDepthThreshold={1.3}
        />
      ) : (
        <meshStandardMaterial map={map} color="#e2d8c8" roughness={0.22} metalness={0.12} />
      )}
    </mesh>
  );
}

/* ------------------------------------------------------------------ walls */

function usePanelMaterial(color: string, repeatX: number, repeatY = 1) {
  return useMemo(() => {
    const map = panelTexture().clone();
    map.repeat.set(repeatX, repeatY);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, color, roughness: 0.82, metalness: 0.02 });
  }, [color, repeatX, repeatY]);
}

function SideWall({ x, zMid, len, height, color }: { x: number; zMid: number; len: number; height: number; color: string }) {
  const mat = usePanelMaterial(color, Math.max(1, Math.round(len / 3.4)));
  return (
    <mesh position={[x, height / 2, zMid]} material={mat}>
      <boxGeometry args={[WALL_T, height, len]} />
    </mesh>
  );
}

/** A wall across the palace axis. With `door`, a true arched opening is cut out of it. */
function CrossWall({ z, width, height, color, door }: { z: number; width: number; height: number; color: string; door: boolean }) {
  const W = width + WALL_T * 2;
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2, 0); shape.lineTo(W / 2, 0); shape.lineTo(W / 2, height); shape.lineTo(-W / 2, height); shape.closePath();
    if (door) {
      const r = DOOR_W / 2;
      const hole = new THREE.Path();
      hole.moveTo(-r, 0);
      hole.lineTo(-r, DOOR_H - r);
      hole.absarc(0, DOOR_H - r, r, Math.PI, 0, true);
      hole.lineTo(r, 0);
      hole.closePath();
      shape.holes.push(hole);
    }
    return new THREE.ExtrudeGeometry(shape, { depth: WALL_T, bevelEnabled: false, curveSegments: 24 });
  }, [W, height, door]);
  // Extrude UVs are in metres, so the panel texture repeats per metre here.
  const mat = usePanelMaterial(color, 1 / 3.4, 1 / height);
  const r = DOOR_W / 2;
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={geometry} material={mat} />
      {door && [-0.03, WALL_T + 0.03].map((dz) => (
        <group key={dz} position={[0, 0, dz]}>
          <mesh position={[0, DOOR_H - r, 0]} material={GOLD}>
            <torusGeometry args={[r + 0.09, 0.075, 10, 40, Math.PI]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (r + 0.09), (DOOR_H - r) / 2, 0]} material={GOLD}>
              <boxGeometry args={[0.15, DOOR_H - r, 0.09]} />
            </mesh>
          ))}
          <mesh position={[0, DOOR_H + 0.16, 0]} material={GOLD}>
            <octahedronGeometry args={[0.13]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------ decoration */

const Column = memo(function Column({ x, z, height }: { x: number; z: number; height: number }) {
  const shaft = height - 1.15;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.14, 0]} material={STONE} castShadow><boxGeometry args={[0.78, 0.28, 0.78]} /></mesh>
      <mesh position={[0, 0.36, 0]} material={GOLD_SOFT}><cylinderGeometry args={[0.33, 0.37, 0.16, 20]} /></mesh>
      <mesh position={[0, 0.44 + shaft / 2, 0]} material={STONE} castShadow><cylinderGeometry args={[0.25, 0.3, shaft, 20]} /></mesh>
      <mesh position={[0, 0.5 + shaft, 0]} material={GOLD}><cylinderGeometry args={[0.4, 0.26, 0.26, 20]} /></mesh>
      <mesh position={[0, height - 0.26, 0]} material={STONE}><boxGeometry args={[0.86, 0.5, 0.86]} /></mesh>
    </group>
  );
});

const octa = new THREE.OctahedronGeometry(0.07);
const candle = new THREE.CylinderGeometry(0.022, 0.028, 0.2, 8);
const flame = new THREE.SphereGeometry(0.045, 8, 8);

function Chandelier({ position, light, big }: { position: [number, number, number]; light: boolean; big: boolean }) {
  const s = big ? 1.25 : 1;
  const parts = useMemo(() => {
    const candles: [number, number, number][] = [];
    const crystals: [number, number, number, number][] = [];
    const rings = [{ r: 1.0, y: -1.25, n: 10 }, { r: 0.55, y: -0.85, n: 6 }];
    for (const ring of rings) {
      for (let i = 0; i < ring.n; i++) {
        const a = (i / ring.n) * Math.PI * 2;
        candles.push([Math.cos(a) * ring.r, ring.y + 0.14, Math.sin(a) * ring.r]);
        crystals.push([Math.cos(a) * ring.r, ring.y - 0.14, Math.sin(a) * ring.r, 1]);
        const a2 = a + Math.PI / ring.n;
        crystals.push([Math.cos(a2) * ring.r * 0.82, ring.y - 0.3, Math.sin(a2) * ring.r * 0.82, 0.8]);
      }
    }
    for (let k = 0; k < 5; k++) crystals.push([0, -1.45 - k * 0.16, 0, 1.5 - k * 0.2]);
    return { candles, crystals };
  }, []);
  return (
    <group position={position}>
      <group scale={s}>
        <mesh position={[0, -0.3, 0]} material={GOLD}><cylinderGeometry args={[0.02, 0.02, 0.9, 6]} /></mesh>
        <mesh position={[0, 0.12, 0]} material={GOLD}><cylinderGeometry args={[0.28, 0.4, 0.12, 20]} /></mesh>
        <mesh position={[0, -1.25, 0]} rotation={[Math.PI / 2, 0, 0]} material={GOLD}><torusGeometry args={[1.0, 0.035, 8, 40]} /></mesh>
        <mesh position={[0, -0.85, 0]} rotation={[Math.PI / 2, 0, 0]} material={GOLD}><torusGeometry args={[0.55, 0.03, 8, 32]} /></mesh>
        <mesh position={[0, -1.0, 0]} material={GOLD}><cylinderGeometry args={[0.05, 0.12, 0.7, 10]} /></mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, -1.05, 0]} rotation={[0, (i / 5) * Math.PI, 0]} material={GOLD}>
            <boxGeometry args={[2.0, 0.025, 0.025]} />
          </mesh>
        ))}
        <Instances limit={parts.candles.length} geometry={candle} material={STONE}>
          {parts.candles.map((p, i) => <Instance key={i} position={p} />)}
        </Instances>
        <Instances limit={parts.candles.length} geometry={flame} material={FLAME}>
          {parts.candles.map((p, i) => <Instance key={i} position={[p[0], p[1] + 0.14, p[2]]} scale={[0.8, 1.4, 0.8]} />)}
        </Instances>
        <Instances limit={parts.crystals.length} geometry={octa} material={CRYSTAL}>
          {parts.crystals.map((p, i) => <Instance key={i} position={[p[0], p[1], p[2]]} scale={[p[3], p[3] * 1.7, p[3]]} />)}
        </Instances>
      </group>
      {light && <pointLight position={[0, -1.3 * s, 0]} color="#FFE6C4" intensity={big ? 150 : 95} distance={32} decay={2} />}
    </group>
  );
}

function Sconce({ x, z, face }: { x: number; z: number; face: number }) {
  return (
    <group position={[x, 2.6, z]}>
      <mesh position={[face * 0.08, -0.1, 0]} material={GOLD}><boxGeometry args={[0.05, 0.5, 0.16]} /></mesh>
      <mesh position={[face * 0.2, 0, 0]} material={GOLD}><cylinderGeometry args={[0.07, 0.03, 0.12, 10]} /></mesh>
      <mesh position={[face * 0.2, 0.14, 0]} material={FLAME}><sphereGeometry args={[0.06, 10, 10]} /></mesh>
    </group>
  );
}

function Ceiling({ width, depth, y, zMid }: { width: number; depth: number; y: number; zMid: number }) {
  const map = useMemo(() => {
    const t = ceilingTexture().clone();
    t.repeat.set(Math.max(1, Math.round(width / 3.5)), Math.max(1, Math.round(depth / 3.5)));
    t.needsUpdate = true;
    return t;
  }, [width, depth]);
  return (
    <mesh position={[0, y, zMid]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width + WALL_T * 2, depth + WALL_T * 2]} />
      <meshStandardMaterial map={map} roughness={0.9} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ rooms */

function RoomShell({ r, layout, museum, lit }: { r: RoomLayout; layout: PalaceLayout; museum: MuseumData; lit: boolean }) {
  const { width, depth, height, zFront, zBack } = r;
  const zMid = (zFront + zBack) / 2;
  const hw = width / 2;
  const color = r.room.wallColor;
  const dark = isDark(color);
  const prev = layout.rooms[r.index - 1];
  const next = layout.rooms[r.index + 1];
  const isEntrance = r.index === 0;
  const names = [museum.partnerOne, museum.partnerTwo].filter(Boolean).join('  &  ');

  return (
    <group>
      <SideWall x={-hw - WALL_T / 2} zMid={zMid} len={depth + WALL_T * 2} height={height} color={color} />
      <SideWall x={hw + WALL_T / 2} zMid={zMid} len={depth + WALL_T * 2} height={height} color={color} />
      <CrossWall z={zFront} width={width} height={height} color={color} door={r.hasFrontDoor} />
      <CrossWall z={zBack - WALL_T} width={width} height={height} color={color} door={r.hasBackDoor} />
      <Ceiling width={width} depth={depth} y={height} zMid={zMid} />

      {/* cornice, picture rail and skirting */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (hw - 0.09), height - 0.2, zMid]} material={GOLD}><boxGeometry args={[0.18, 0.2, depth]} /></mesh>
          <mesh position={[s * (hw - 0.05), height - 0.5, zMid]} material={STONE}><boxGeometry args={[0.1, 0.34, depth]} /></mesh>
          <mesh position={[s * (hw - 0.03), 0.14, zMid]} material={dark ? GOLD_SOFT : BRONZE}><boxGeometry args={[0.06, 0.28, depth]} /></mesh>
        </group>
      ))}
      {[zFront - 0.09, zBack + 0.09].map((z) => (
        <mesh key={z} position={[0, height - 0.2, z]} material={GOLD}><boxGeometry args={[width, 0.2, 0.18]} /></mesh>
      ))}

      {r.columns.map(([x, z]) => <Column key={`${x}:${z}`} x={x} z={z} height={height} />)}
      {r.chandeliers.map((p, i) => <Chandelier key={i} position={p} light={lit} big={height >= 7.5} />)}

      {/* wayfinding above the arches */}
      {next && (
        <Label
          lines={[{ text: next.room.title.toUpperCase(), size: 54, font: 'sans', spacing: 0.3, color: dark ? '#E6CFA0' : '#8A6A3C', weight: 500 }]}
          width={Math.min(5.2, width - 3)}
          position={[0, DOOR_H + 0.62, zBack + 0.02]}
        />
      )}
      {prev && (
        <Label
          lines={[{ text: prev.room.title.toUpperCase(), size: 54, font: 'sans', spacing: 0.3, color: dark ? '#E6CFA0' : '#8A6A3C', weight: 500 }]}
          width={Math.min(5.2, width - 3)}
          position={[0, DOOR_H + 0.62, zFront - 0.02]}
          rotation={[0, Math.PI, 0]}
        />
      )}

      {isEntrance && (
        <>
          {/* the couple's names over the first arch */}
          <Label
            lines={[
              { text: 'THE MEMORY MUSEUM OF', size: 40, font: 'sans', spacing: 0.42, color: '#8A6A3C' },
              { text: names || museum.name, size: 150, weight: 500, color: '#B08A52', gap: 18 },
              ...(museum.anniversary ? [{ text: `SINCE ${new Date(`${museum.anniversary}T00:00:00`).getFullYear()}`, size: 36, font: 'sans' as const, spacing: 0.5, color: '#8A6A3C', gap: 22 }] : []),
            ]}
            width={Math.min(8.5, width - 4)}
            position={[0, Math.min(height - 1.5, DOOR_H + 2.2), zBack + 0.03]}
          />
          <GrandDoors z={zFront - 0.01} />
        </>
      )}

      {r.dais && <Dais zBack={zBack} dais={r.dais} />}
    </group>
  );
}

function GrandDoors({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]} rotation={[0, Math.PI, 0]}>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.92, 2.1, 0.06]}>
          <mesh material={BRONZE}><boxGeometry args={[1.8, 4.2, 0.12]} /></mesh>
          {[1.1, -0.2, -1.4].map((y) => (
            <mesh key={y} position={[0, y, 0.07]} material={GOLD_SOFT}><boxGeometry args={[1.25, y > 0 ? 1.3 : 0.9, 0.02]} /></mesh>
          ))}
          <mesh position={[-s * 0.7, -0.1, 0.12]} material={GOLD}><sphereGeometry args={[0.08, 12, 12]} /></mesh>
        </group>
      ))}
      <mesh position={[0, 4.32, 0.05]} material={GOLD}><boxGeometry args={[4.0, 0.2, 0.16]} /></mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.94, 2.1, 0.05]} material={GOLD}><boxGeometry args={[0.16, 4.3, 0.16]} /></mesh>
      ))}
    </group>
  );
}

function Dais({ zBack, dais }: { zBack: number; dais: NonNullable<RoomLayout['dais']> }) {
  const run = 0.55;
  return (
    <group>
      {Array.from({ length: dais.steps }, (_, s) => {
        const w = dais.width - s * run * 2;
        const d = dais.depth - s * run;
        return (
          <group key={s} position={[0, s * dais.stepH, zBack + d / 2]}>
            <mesh position={[0, dais.stepH / 2, 0]} material={STONE} receiveShadow castShadow>
              <boxGeometry args={[w, dais.stepH, d]} />
            </mesh>
            <mesh position={[0, dais.stepH - 0.012, d / 2 + 0.006]} material={GOLD}>
              <boxGeometry args={[w + 0.02, 0.03, 0.02]} />
            </mesh>
          </group>
        );
      })}
      <Sparkles count={70} scale={[dais.width - 1, 4, dais.depth]} position={[0, 2.4, zBack + dais.depth / 2]} size={3.2} speed={0.25} opacity={0.75} color="#E6C88F" />
    </group>
  );
}

/* --------------------------------------------------------------- corridor */

function CorridorShell({ c }: { c: CorridorLayout }) {
  const len = c.zStart - c.zEnd;
  const zMid = (c.zStart + c.zEnd) / 2;
  const hw = CORRIDOR_W / 2;
  const mat = usePanelMaterial('#EFE4D2', Math.max(1, Math.round(len / 3.2)));
  return (
    <group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * (hw + WALL_T / 2), CORRIDOR_H / 2, zMid]} material={mat}>
            <boxGeometry args={[WALL_T, CORRIDOR_H, len]} />
          </mesh>
          <mesh position={[s * (hw - 0.07), CORRIDOR_H - 0.16, zMid]} material={GOLD}><boxGeometry args={[0.14, 0.16, len]} /></mesh>
          <mesh position={[s * (hw - 0.03), 0.14, zMid]} material={BRONZE}><boxGeometry args={[0.06, 0.28, len]} /></mesh>
          <Sconce x={s * hw} z={zMid} face={-s} />
        </group>
      ))}
      <Ceiling width={CORRIDOR_W} depth={len - WALL_T * 2} y={CORRIDOR_H} zMid={zMid} />
      {/* a runner of dark marble marks the passage */}
      <mesh position={[0, 0.006, zMid]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.9, len + WALL_T * 2]} />
        <meshStandardMaterial color="#6B1F2A" roughness={0.85} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.98, 0.008, zMid]} rotation={[-Math.PI / 2, 0, 0]} material={GOLD_SOFT}>
          <planeGeometry args={[0.06, len + WALL_T * 2]} />
        </mesh>
      ))}
      <pointLight position={[0, 3.2, zMid]} color="#FFD9A0" intensity={28} distance={12} decay={2} />
    </group>
  );
}

function isDark(hex: string) {
  const c = new THREE.Color(hex);
  return c.r * 0.299 + c.g * 0.587 + c.b * 0.114 < 0.45;
}
