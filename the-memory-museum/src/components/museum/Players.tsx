'use client';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';
import {
  floorHeightAt, isBlocked, isCameraBlocked, roomIndexAt, PLAYER_RADIUS, type PalaceLayout,
} from '@/lib/palace/layout';
import type { Visitor } from '@/lib/types';
import type { PlayerState, Transport } from '@/lib/net/transport';
import { bodies, input, peerTargets, useExperience, type PeerInfo } from '@/lib/store';
import { Avatar, type Motion } from './Avatar';
import { Label } from './Label';

const WALK = 3.1;
const STROLL_FAST = 4.6;
const CAM_DIST = 4.6;
const SEND_MS = 80;
const IDLE_SEND_MS = 600;

const SCHEMES = {
  wasd: { f: 'KeyW', b: 'KeyS', l: 'KeyA', r: 'KeyD' },
  arrows: { f: 'ArrowUp', b: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight' },
} as const;

const angleLerp = (a: number, b: number, t: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

interface LocalProps {
  layout: PalaceLayout;
  visitor: Visitor;
  spawn: [number, number];
  scheme: keyof typeof SCHEMES;
  /** The primary player owns the camera, the joystick and the network. */
  primary: boolean;
  transport?: RefObject<Transport | null>;
  shadows: boolean;
}

export function LocalPlayer({ layout, visitor, spawn, scheme, primary, transport, shadows }: LocalProps) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<Motion>({ moving: false, speed: WALK });
  const pos = useRef(new THREE.Vector3(spawn[0], 0, spawn[1]));
  const facing = useRef(Math.PI);
  const lastSend = useRef(0);
  const tick = useRef(0);
  const camDist = useRef(CAM_DIST);
  const { camera, scene } = useThree();

  const frames = useMemo(
    () => layout.rooms.flatMap((r) => r.frames.map((f) => ({ memory: f.memory, x: f.slot.position[0], z: f.slot.position[2] }))),
    [layout],
  );
  const finalRoom = layout.rooms[layout.rooms.length - 1];

  useEffect(() => {
    bodies.set(visitor.id, { x: spawn[0], z: spawn[1] });
    return () => { bodies.delete(visitor.id); };
  }, [visitor.id, spawn]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const keys = SCHEMES[scheme];
    const paused = primary && useExperience.getState().open !== null;

    // --- intent -----------------------------------------------------------
    let f = 0, r = 0;
    if (!paused) {
      if (input.keys.has(keys.f)) f += 1;
      if (input.keys.has(keys.b)) f -= 1;
      if (input.keys.has(keys.r)) r += 1;
      if (input.keys.has(keys.l)) r -= 1;
      if (primary) { f += input.stick.y; r += input.stick.x; }
    }
    const mag = Math.hypot(f, r);
    const moving = mag > 0.12;
    const p = pos.current;

    if (moving) {
      const scale = Math.min(1, mag) / mag;
      const yaw = input.yaw;
      const dx = (f * -Math.sin(yaw) + r * Math.cos(yaw)) * scale;
      const dz = (f * -Math.cos(yaw) - r * Math.sin(yaw)) * scale;
      const fast = primary && (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight'));
      const speed = fast ? STROLL_FAST : WALK;
      motion.current.speed = speed * Math.min(1, mag);

      // --- collision: move one axis at a time so we slide along walls ------
      const nx = p.x + dx * speed * dt;
      if (!isBlocked(layout, nx, p.z) && !hitsBody(visitor.id, nx, p.z, p.x, p.z)) p.x = nx;
      const nz = p.z + dz * speed * dt;
      if (!isBlocked(layout, p.x, nz) && !hitsBody(visitor.id, p.x, nz, p.x, p.z)) p.z = nz;

      facing.current = angleLerp(facing.current, Math.atan2(dx, dz), Math.min(1, dt * 10));
    }
    motion.current.moving = moving;
    p.y += (floorHeightAt(layout, p.x, p.z) - p.y) * Math.min(1, dt * 12);
    bodies.set(visitor.id, { x: p.x, z: p.z });

    if (group.current) {
      group.current.position.copy(p);
      group.current.rotation.y = facing.current;
    }
    if (!primary) return;

    // --- third-person camera, kept inside the walls ------------------------
    const head = p.y + 1.55 * visitor.avatar.height;
    const cp = Math.cos(input.pitch), sp = Math.sin(input.pitch);
    const ox = Math.sin(input.yaw) * cp, oz = Math.cos(input.yaw) * cp;
    let allowed = CAM_DIST;
    for (let i = 1; i <= 14; i++) {
      const t = (CAM_DIST * i) / 14;
      if (isCameraBlocked(layout, p.x + ox * t, head + 0.25 + sp * t, p.z + oz * t)) { allowed = Math.max(0.5, t - CAM_DIST / 14); break; }
    }
    camDist.current += (allowed - camDist.current) * Math.min(1, dt * (allowed < camDist.current ? 18 : 4));
    const d = camDist.current;
    camera.position.set(p.x + ox * d, head + 0.25 + sp * d, p.z + oz * d);
    camera.lookAt(p.x, head, p.z);

    // The shadow-casting light travels with the visitor so one small map covers the palace.
    const sun = scene.getObjectByName('sun') as THREE.DirectionalLight | undefined;
    if (sun) {
      sun.position.set(p.x + 3, 11, p.z + 5);
      sun.target.position.set(p.x, 0, p.z);
      sun.target.updateMatrixWorld();
    }

    // --- awareness: which room, which frame is close -----------------------
    tick.current++;
    const store = useExperience.getState();
    if (tick.current % 6 === 0) {
      const room = roomIndexAt(layout, p.z);
      if (room >= 0 && room !== store.roomIndex) store.set({ roomIndex: room });
      let best: (typeof frames)[number] | null = null;
      let bestD = 3.4;
      for (const fr of frames) {
        const dist = Math.hypot(fr.x - p.x, fr.z - p.z);
        if (dist < bestD) { bestD = dist; best = fr; }
      }
      const nearby = best?.memory ?? null;
      if (nearby?.id !== store.nearby?.id) store.set({ nearby });
      const onDais = Boolean(finalRoom?.dais) && p.y > 0.25;
      if (onDais !== store.onDais) store.set({ onDais });
    }

    // --- replication --------------------------------------------------------
    const now = performance.now();
    if (transport?.current && now - lastSend.current > (moving ? SEND_MS : IDLE_SEND_MS)) {
      lastSend.current = now;
      const state: PlayerState = {
        id: visitor.id, name: visitor.name, avatar: visitor.avatar,
        x: round(p.x), y: round(p.y), z: round(p.z), ry: round(facing.current),
        moving, room: Math.max(0, roomIndexAt(layout, p.z)),
      };
      transport.current.send(state);
    }
  });

  return (
    <group ref={group} position={[spawn[0], 0, spawn[1]]} rotation={[0, Math.PI, 0]}>
      <Avatar config={visitor.avatar} motion={motion} shadows={shadows} />
      {!primary && <NameTag name={visitor.name} height={visitor.avatar.height} />}
    </group>
  );
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** True when the step would walk into another avatar (but lets overlapping avatars separate). */
function hitsBody(selfId: string, nx: number, nz: number, ox: number, oz: number) {
  const min = PLAYER_RADIUS * 2;
  for (const [id, b] of bodies) {
    if (id === selfId) continue;
    const next = Math.hypot(b.x - nx, b.z - nz);
    if (next < min && next < Math.hypot(b.x - ox, b.z - oz)) return true;
  }
  return false;
}

function NameTag({ name, height }: { name: string; height: number }) {
  return (
    <Billboard position={[0, 2.08 * height, 0]}>
      <Label lines={[{ text: name, size: 110, color: '#F3EBDD', weight: 600 }]} width={1.3} />
    </Billboard>
  );
}

/* ----------------------------------------------------------- remote peers */

export function RemotePlayer({ peer, shadows }: { peer: PeerInfo; shadows: boolean }) {
  const group = useRef<THREE.Group>(null);
  const motion = useRef<Motion>({ moving: false, speed: WALK });
  const started = useRef(false);

  useEffect(() => () => { bodies.delete(peer.id); }, [peer.id]);

  useFrame((_, dt) => {
    const t = peerTargets.get(peer.id);
    const g = group.current;
    if (!t || !g) return;
    if (!started.current) {
      g.position.set(t.x, t.y, t.z);
      g.rotation.y = t.ry;
      started.current = true;
    }
    // Exponential smoothing toward the newest snapshot hides the 12 Hz send rate.
    const k = 1 - Math.exp(-dt * 11);
    const dx = t.x - g.position.x, dz = t.z - g.position.z;
    if (Math.hypot(dx, dz) > 6) g.position.set(t.x, t.y, t.z); // teleport after a long stall
    else { g.position.x += dx * k; g.position.z += dz * k; g.position.y += (t.y - g.position.y) * k; }
    g.rotation.y = angleLerp(g.rotation.y, t.ry, k);
    motion.current.moving = t.moving || Math.hypot(dx, dz) > 0.08;
    bodies.set(peer.id, { x: g.position.x, z: g.position.z });
  });

  return (
    <group ref={group}>
      <Avatar config={peer.avatar} motion={motion} shadows={shadows} />
      <NameTag name={peer.name} height={peer.avatar.height} />
    </group>
  );
}
