import type { MemoryData, MuseumData, RoomData } from '../types';

/**
 * Turns database-driven room + memory records into palace geometry.
 * Nothing here knows about a particular couple: add a room or a memory in the
 * dashboard and the palace grows a gallery or a frame on the next load.
 *
 * Convention: the palace runs along -Z. A room's interior spans
 * x ∈ [-width/2, width/2], z ∈ [zBack, zFront].
 */

export const WALL_T = 0.4;
export const CORRIDOR_LEN = 7;
export const CORRIDOR_W = 4.6;
export const CORRIDOR_H = 4.8;
export const DOOR_W = 3.2;
export const DOOR_H = 3.7;
export const FRAME_SPACING = 3.8;
export const FRAME_Y = 2.15;
export const PLAYER_RADIUS = 0.36;

export interface AABB {
  minX: number; maxX: number; minZ: number; maxZ: number;
  /** When set, only blocks points above this height (door lintels vs. the camera). */
  minY?: number;
}

export interface HeightZone { minX: number; maxX: number; minZ: number; maxZ: number; height: number }

export interface FrameSlot {
  position: [number, number, number];
  rotationY: number;
  maxW: number;
  maxH: number;
}

export interface PlacedMemory { memory: MemoryData; slot: FrameSlot }

export interface RoomLayout {
  room: RoomData;
  index: number;
  width: number;
  depth: number;
  height: number;
  zFront: number;
  zBack: number;
  hasFrontDoor: boolean;
  hasBackDoor: boolean;
  columns: [number, number][];
  chandeliers: [number, number, number][];
  frames: PlacedMemory[];
  dais: { width: number; depth: number; steps: number; stepH: number } | null;
}

export interface CorridorLayout { index: number; zStart: number; zEnd: number }

export interface PalaceLayout {
  rooms: RoomLayout[];
  corridors: CorridorLayout[];
  colliders: AABB[];
  heightZones: HeightZone[];
  bounds: AABB;
  spawns: [number, number][];
}

const DAIS = { width: 9, depth: 4.2, steps: 3, stepH: 0.14, run: 0.55 };

export function buildPalaceLayout(museum: Pick<MuseumData, 'rooms' | 'memories'>): PalaceLayout {
  const rooms = [...museum.rooms].sort((a, b) => a.position - b.position);
  const colliders: AABB[] = [];
  const heightZones: HeightZone[] = [];
  const layouts: RoomLayout[] = [];
  const corridors: CorridorLayout[] = [];
  let cursor = 0;
  let maxHalfW = CORRIDOR_W / 2;

  rooms.forEach((room, index) => {
    const isLast = index === rooms.length - 1;
    const isFinal = isLast && rooms.length > 1;
    const memories = museum.memories
      .filter((m) => m.roomId === room.id)
      .sort((a, b) => a.position - b.position);

    const width = clamp(room.width, 8, 30);
    const height = clamp(room.height, 4.5, 12);
    // The final room hangs its first memory on the end wall, above the dais.
    const backSlots = isFinal ? 1 : 0;
    const perSide = Math.max(1, Math.ceil(Math.max(0, memories.length - backSlots) / 2));
    const reserved = isFinal ? DAIS.depth + 1.5 : 0;
    const depth = Math.max(clamp(room.depth, 8, 60), 5.5 + reserved + (perSide - 1) * FRAME_SPACING);

    const zFront = cursor;
    const zBack = cursor - depth;
    maxHalfW = Math.max(maxHalfW, width / 2);

    // --- frame slots along the side walls -------------------------------
    const usableFront = zFront - 2.75;
    const usableBack = zBack + 2.75 + reserved;
    const usable = Math.max(0, usableFront - usableBack);
    const spacing = perSide > 1 ? usable / (perSide - 1) : 0;
    const zAt = (k: number) => (perSide > 1 ? usableFront - k * spacing : (usableFront + usableBack) / 2);
    const slotW = Math.min(2.5, Math.max(1.4, (spacing || 3.4) - 1.3));

    const slots: FrameSlot[] = [];
    if (backSlots) {
      const top = DAIS.steps * DAIS.stepH;
      slots.push({ position: [0, FRAME_Y + top + 0.25, zBack + 0.06], rotationY: 0, maxW: 3.2, maxH: 2.5 });
    }
    for (let k = 0; k < perSide; k++) {
      slots.push({ position: [-width / 2 + 0.06, FRAME_Y, zAt(k)], rotationY: Math.PI / 2, maxW: slotW, maxH: 1.9 });
      slots.push({ position: [width / 2 - 0.06, FRAME_Y, zAt(k)], rotationY: -Math.PI / 2, maxW: slotW, maxH: 1.9 });
    }
    const frames: PlacedMemory[] = memories.slice(0, slots.length).map((memory, i) => ({ memory, slot: slots[i] }));

    // --- pilaster columns between frames --------------------------------
    const columns: [number, number][] = [];
    const colZ: number[] = [];
    if (perSide > 1) {
      for (let k = 0; k < perSide - 1; k++) colZ.push(zAt(k) - spacing / 2);
    }
    colZ.push(zFront - 0.9, zBack + 0.9);
    for (const z of colZ) {
      for (const sx of [-1, 1]) {
        const x = sx * (width / 2 - 0.55);
        columns.push([x, z]);
        colliders.push({ minX: x - 0.42, maxX: x + 0.42, minZ: z - 0.42, maxZ: z + 0.42 });
      }
    }

    // --- chandeliers ------------------------------------------------------
    const nCh = depth > 20 ? 2 : 1;
    const chandeliers: [number, number, number][] = [];
    for (let c = 0; c < nCh; c++) {
      chandeliers.push([0, height - 0.5, zFront - (depth * (c + 1)) / (nCh + 1)]);
    }

    // --- colliders: side walls, door walls --------------------------------
    const hw = width / 2;
    colliders.push({ minX: -hw - WALL_T, maxX: -hw, minZ: zBack - WALL_T, maxZ: zFront + WALL_T });
    colliders.push({ minX: hw, maxX: hw + WALL_T, minZ: zBack - WALL_T, maxZ: zFront + WALL_T });
    const hasFrontDoor = index > 0;
    const hasBackDoor = !isLast;
    const doorWall = (zMin: number, open: boolean) => {
      if (!open) {
        colliders.push({ minX: -hw - WALL_T, maxX: hw + WALL_T, minZ: zMin, maxZ: zMin + WALL_T });
        return;
      }
      colliders.push({ minX: -hw - WALL_T, maxX: -DOOR_W / 2, minZ: zMin, maxZ: zMin + WALL_T });
      colliders.push({ minX: DOOR_W / 2, maxX: hw + WALL_T, minZ: zMin, maxZ: zMin + WALL_T });
      colliders.push({ minX: -DOOR_W / 2, maxX: DOOR_W / 2, minZ: zMin, maxZ: zMin + WALL_T, minY: DOOR_H - DOOR_W / 2 });
    };
    doorWall(zFront, hasFrontDoor);
    doorWall(zBack - WALL_T, hasBackDoor);

    // --- the dais (walkable ornamental steps) in the final room -----------
    let dais: RoomLayout['dais'] = null;
    if (isFinal) {
      const dw = Math.min(DAIS.width, width - 3);
      dais = { width: dw, depth: DAIS.depth, steps: DAIS.steps, stepH: DAIS.stepH };
      for (let s = 0; s < DAIS.steps; s++) {
        heightZones.push({
          minX: -dw / 2 + s * DAIS.run, maxX: dw / 2 - s * DAIS.run,
          minZ: zBack, maxZ: zBack + DAIS.depth - s * DAIS.run,
          height: (s + 1) * DAIS.stepH,
        });
      }
    }

    layouts.push({ room, index, width, depth, height, zFront, zBack, hasFrontDoor, hasBackDoor, columns, chandeliers, frames, dais });

    if (!isLast) {
      const zStart = zBack - WALL_T;
      const zEnd = zBack - CORRIDOR_LEN + WALL_T;
      corridors.push({ index, zStart, zEnd });
      const cw = CORRIDOR_W / 2;
      colliders.push({ minX: -cw - WALL_T, maxX: -cw, minZ: zEnd, maxZ: zStart });
      colliders.push({ minX: cw, maxX: cw + WALL_T, minZ: zEnd, maxZ: zStart });
      cursor = zBack - CORRIDOR_LEN;
    } else {
      cursor = zBack;
    }
  });

  const first = layouts[0];
  const spawnZ = first ? first.zFront - 5.5 : -5.5;
  return {
    rooms: layouts,
    corridors,
    colliders,
    heightZones,
    bounds: { minX: -maxHalfW - 1, maxX: maxHalfW + 1, minZ: cursor - 1, maxZ: 1 },
    spawns: [[-0.9, spawnZ], [0.9, spawnZ]],
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
}

/** Index of the room containing the point, or -1 when in a corridor. */
export function roomIndexAt(layout: PalaceLayout, z: number): number {
  for (const r of layout.rooms) if (z <= r.zFront + WALL_T && z >= r.zBack - WALL_T) return r.index;
  return -1;
}

export function ceilingAt(layout: PalaceLayout, z: number): number {
  const i = roomIndexAt(layout, z);
  return i >= 0 ? layout.rooms[i].height : CORRIDOR_H;
}

export function floorHeightAt(layout: PalaceLayout, x: number, z: number): number {
  let h = 0;
  for (const zone of layout.heightZones) {
    if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) h = Math.max(h, zone.height);
  }
  return h;
}

/** Circle-vs-walls test used by the player controller. */
export function isBlocked(layout: PalaceLayout, x: number, z: number, radius = PLAYER_RADIUS): boolean {
  for (const c of layout.colliders) {
    if (c.minY !== undefined) continue;
    if (x > c.minX - radius && x < c.maxX + radius && z > c.minZ - radius && z < c.maxZ + radius) return true;
  }
  return false;
}

/** Point test used to keep the camera inside the architecture. */
export function isCameraBlocked(layout: PalaceLayout, x: number, y: number, z: number): boolean {
  const m = 0.25;
  for (const c of layout.colliders) {
    if (c.minY !== undefined && y < c.minY - m) continue;
    if (x > c.minX - m && x < c.maxX + m && z > c.minZ - m && z < c.maxZ + m) return true;
  }
  return y > ceilingAt(layout, z) - 0.35;
}
