/** Shared domain types. The 3D layer only ever sees these — never raw database rows. */

export type RoomKind = 'entrance' | 'first_memories' | 'love' | 'journey' | 'final' | 'custom';
export type PlanId = 'starter' | 'premium' | 'luxury' | 'custom';
export type MuseumStatus = 'draft' | 'published';

export interface AvatarConfig {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bun' | 'covered' | 'none';
  outfit: 'suit' | 'dress' | 'coat';
  outfitColor: string;
  accentColor: string;
  /** Height multiplier, 0.9 – 1.1 */
  height: number;
}

export interface RoomData {
  id: string;
  kind: RoomKind;
  title: string;
  subtitle: string;
  position: number;
  width: number;
  depth: number;
  height: number;
  wallColor: string;
}

export interface MemoryData {
  id: string;
  roomId: string;
  title: string;
  caption: string;
  message: string;
  date: string | null;
  position: number;
  kind: 'photo' | 'video';
  /** Short-lived signed URL (or a demo data URL). Never a public bucket URL. */
  imageUrl: string | null;
  videoUrl: string | null;
  width: number;
  height: number;
}

export interface MuseumData {
  id: string;
  slug: string;
  name: string;
  status: MuseumStatus;
  plan: PlanId;
  partnerOne: string;
  partnerTwo: string;
  anniversary: string | null;
  welcomeMessage: string;
  finalMessage: string;
  musicUrl: string | null;
  musicVolume: number;
  rooms: RoomData[];
  memories: MemoryData[];
}

export interface Visitor {
  id: string;
  name: string;
  avatar: AvatarConfig;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: '#D9A77F',
  hair: '#2B1D14',
  hairStyle: 'short',
  outfit: 'suit',
  outfitColor: '#17130F',
  accentColor: '#C6A36B',
  height: 1,
};
