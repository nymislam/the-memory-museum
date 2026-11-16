import { DEFAULT_AVATAR, type AvatarConfig, type MemoryData, type MuseumData, type RoomData, type Visitor } from '../types';
import { getSupabase, isSupabaseConfigured } from '../supabase/client';
import { DEMO_MUSEUM } from './demo';

export const MEMORY_BUCKET = 'memories';
const SIGNED_URL_TTL = 60 * 60 * 2; // two hours

export type LoadResult =
  | { ok: true; museum: MuseumData; visitor: Visitor | null; isOwner: boolean; demo: boolean }
  | { ok: false; reason: 'not-configured' | 'sign-in' | 'not-found' | 'unpublished' | 'error'; message?: string };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapRoom(r: any): RoomData {
  return {
    id: r.id, kind: r.kind, title: r.title, subtitle: r.subtitle ?? '', position: r.position,
    width: Number(r.width), depth: Number(r.depth), height: Number(r.height), wallColor: r.wall_color ?? '#F3EBDD',
  };
}

/**
 * Loads one museum for the signed-in visitor. RLS guarantees that only the owner,
 * the invited partner or an administrator receives any rows; photographs are
 * delivered as short-lived signed URLs from a private bucket.
 */
export async function loadMuseum(slug: string): Promise<LoadResult> {
  if (slug === 'demo') return { ok: true, museum: DEMO_MUSEUM, visitor: null, isOwner: false, demo: true };
  if (!isSupabaseConfigured) return { ok: false, reason: 'not-configured' };

  const sb = getSupabase();
  const { data: auth } = await sb.auth.getSession();
  const user = auth.session?.user;
  if (!user) return { ok: false, reason: 'sign-in' };

  const { data: m, error } = await sb
    .from('museums')
    .select('*, couples(*), museum_settings(*), rooms(*), memories(*, photo_assets(*)), avatars(*)')
    .eq('slug', slug)
    .maybeSingle();
  if (error) return { ok: false, reason: 'error', message: error.message };
  if (!m) return { ok: false, reason: 'not-found' };

  const isOwner = m.owner_id === user.id;
  if (m.status !== 'published' && !isOwner) {
    const { data: me } = await sb.from('users').select('role').eq('id', user.id).maybeSingle();
    if (me?.role !== 'admin') return { ok: false, reason: 'unpublished' };
  }

  const couple: any = one(m.couples);
  const settings: any = one(m.museum_settings);

  const paths: string[] = [];
  for (const mem of m.memories as any[]) {
    const asset = one<any>(mem.photo_assets);
    if (asset?.storage_path) paths.push(asset.storage_path);
  }
  if (settings?.music_path) paths.push(settings.music_path);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await sb.storage.from(MEMORY_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
    urls?.forEach((u) => { if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl); });
  }

  const memories: MemoryData[] = (m.memories as any[]).map((mem) => {
    const asset = one<any>(mem.photo_assets);
    const url = asset ? signed.get(asset.storage_path) ?? null : null;
    const isVideo = asset?.mime_type?.startsWith('video/');
    return {
      id: mem.id, roomId: mem.room_id, title: mem.title ?? '', caption: mem.caption ?? '', message: mem.message ?? '',
      date: mem.memory_date, position: mem.position, kind: isVideo ? 'video' : 'photo',
      imageUrl: isVideo ? null : url, videoUrl: isVideo ? url : null,
      width: asset?.width ?? 4, height: asset?.height ?? 3,
    };
  });

  const museum: MuseumData = {
    id: m.id, slug: m.slug, name: m.name, status: m.status, plan: m.plan,
    partnerOne: couple?.partner_one_name ?? '', partnerTwo: couple?.partner_two_name ?? '',
    anniversary: couple?.anniversary_date ?? null,
    welcomeMessage: settings?.welcome_message ?? '', finalMessage: settings?.final_message ?? '',
    musicUrl: settings?.music_path ? signed.get(settings.music_path) ?? null : null,
    musicVolume: Number(settings?.music_volume ?? 0.4),
    rooms: (m.rooms as any[]).map(mapRoom),
    memories,
  };

  const mine = (m.avatars as any[]).find((a) => a.user_id === user.id);
  const visitor: Visitor = {
    id: user.id,
    name: mine?.display_name || (isOwner ? museum.partnerOne : museum.partnerTwo) || 'Guest',
    avatar: { ...DEFAULT_AVATAR, ...((mine?.config as Partial<AvatarConfig>) ?? {}) },
  };
  return { ok: true, museum, visitor, isOwner, demo: false };
}
