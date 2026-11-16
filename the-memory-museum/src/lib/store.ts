import { create } from 'zustand';
import type { AvatarConfig, MemoryData } from './types';
import type { NetStatus, PlayerState } from './net/transport';

export interface PeerInfo { id: string; name: string; avatar: AvatarConfig; room: number }

interface ExperienceState {
  roomIndex: number;
  nearby: MemoryData | null;
  open: MemoryData | null;
  peers: Record<string, PeerInfo>;
  netStatus: NetStatus;
  onDais: boolean;
  quality: 'high' | 'low';
  localPartner: boolean;
  set: (patch: Partial<ExperienceState>) => void;
  upsertPeer: (s: PlayerState) => void;
  removePeer: (id: string) => void;
  reset: () => void;
}

export const useExperience = create<ExperienceState>((set, get) => ({
  roomIndex: 0,
  nearby: null,
  open: null,
  peers: {},
  netStatus: 'offline',
  onDais: false,
  quality: 'high',
  localPartner: false,
  set: (patch) => set(patch),
  upsertPeer: (s) => {
    const cur = get().peers[s.id];
    if (cur && cur.room === s.room && cur.name === s.name && cur.avatar === s.avatar) return;
    // Keep the avatar object stable unless it really changed, to avoid re-rendering.
    const avatar = cur && JSON.stringify(cur.avatar) === JSON.stringify(s.avatar) ? cur.avatar : s.avatar;
    if (cur && cur.room === s.room && cur.name === s.name && cur.avatar === avatar) return;
    set({ peers: { ...get().peers, [s.id]: { id: s.id, name: s.name, avatar, room: s.room } } });
  },
  removePeer: (id) => {
    if (!get().peers[id]) return;
    const peers = { ...get().peers };
    delete peers[id];
    set({ peers });
  },
  reset: () => set({ roomIndex: 0, nearby: null, open: null, peers: {}, onDais: false, localPartner: false }),
}));

/**
 * Per-frame data lives outside React so 60 fps updates never trigger a render.
 */
export interface PeerTarget { x: number; y: number; z: number; ry: number; moving: boolean; lastSeen: number }
export const peerTargets = new Map<string, PeerTarget>();

export const input = {
  keys: new Set<string>(),
  /** Joystick vector, x = strafe right, y = forward. */
  stick: { x: 0, y: 0 },
  yaw: 0,
  pitch: 0.22,
  interact: false,
};

/** Live positions of every avatar on this device, for avatar-vs-avatar collision. */
export const bodies = new Map<string, { x: number; z: number }>();
