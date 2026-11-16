import { getSupabase } from '../supabase/client';
import { prepareImage } from '../images';
import { AUDIO_TYPES, MAX_VIDEO_BYTES, VIDEO_TYPES } from '../validation';
import type { AvatarConfig, PlanId, RoomKind } from '../types';
import { MEMORY_BUCKET } from './museum';

/** Database rows as the dashboards use them. */
export interface MuseumRow { id: string; owner_id: string; name: string; slug: string; status: 'draft' | 'published'; plan: PlanId; created_at: string }
export interface CoupleRow { partner_one_name: string; partner_two_name: string; anniversary_date: string | null }
export interface SettingsRow { welcome_message: string; final_message: string; music_path: string | null; music_volume: number; allow_partner_edit: boolean }
export interface RoomRow { id: string; kind: RoomKind; title: string; subtitle: string; position: number; width: number; depth: number; height: number; wall_color: string }
export interface AssetRow { id: string; storage_path: string; mime_type: string; width: number; height: number }
export interface MemoryRow { id: string; room_id: string; asset_id: string | null; title: string; caption: string; message: string; memory_date: string | null; position: number; asset: AssetRow | null; url: string | null }
export interface AvatarRow { id: string; user_id: string; display_name: string; config: Partial<AvatarConfig>; reference_photo_path: string | null; reference_consent_at: string | null }
export interface MemberRow { user_id: string; role: 'owner' | 'partner' }
export interface InvitationRow { id: string; email: string | null; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string }

export interface EditorData {
  museum: MuseumRow;
  couple: CoupleRow;
  settings: SettingsRow;
  rooms: RoomRow[];
  memories: MemoryRow[];
  avatars: AvatarRow[];
  members: MemberRow[];
  invitations: InvitationRow[];
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function listMuseums(all = false): Promise<(MuseumRow & { couple: CoupleRow | null })[]> {
  const sb = getSupabase();
  // RLS already limits rows to museums the user belongs to (or all of them for an administrator).
  const { data, error } = await sb.from('museums').select('*, couples(*)').order('created_at', { ascending: false }).limit(all ? 500 : 50);
  fail(error);
  return (data ?? []).map((m: any) => ({ ...m, couple: one<CoupleRow>(m.couples) }));
}

export async function createMuseum(name: string, partnerOne: string, partnerTwo: string, plan: PlanId): Promise<MuseumRow> {
  const { data, error } = await getSupabase().rpc('create_museum', { p_name: name, p_partner_one: partnerOne, p_partner_two: partnerTwo, p_plan: plan });
  fail(error);
  return data as MuseumRow;
}

export async function loadEditor(id: string): Promise<EditorData | null> {
  const sb = getSupabase();
  const { data: m, error } = await sb
    .from('museums')
    .select('*, couples(*), museum_settings(*), rooms(*), memories(*, photo_assets(*)), avatars(*), museum_members(user_id, role)')
    .eq('id', id)
    .maybeSingle();
  fail(error);
  if (!m) return null;
  const { data: invitations } = await sb.from('invitations').select('id, email, expires_at, accepted_at, revoked_at, created_at').eq('museum_id', id).order('created_at', { ascending: false });

  const mems = (m.memories as any[]).map((x) => ({ ...x, asset: one<AssetRow>(x.photo_assets) }));
  const paths = mems.filter((x) => x.asset).map((x) => x.asset.storage_path as string);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await sb.storage.from(MEMORY_BUCKET).createSignedUrls(paths, 3600);
    data?.forEach((u) => { if (u.path && u.signedUrl) urls.set(u.path, u.signedUrl); });
  }
  return {
    museum: m as MuseumRow,
    couple: one<CoupleRow>(m.couples) ?? { partner_one_name: '', partner_two_name: '', anniversary_date: null },
    settings: one<SettingsRow>(m.museum_settings) ?? { welcome_message: '', final_message: '', music_path: null, music_volume: 0.4, allow_partner_edit: false },
    rooms: (m.rooms as any[]).map((r) => ({ ...r, width: Number(r.width), depth: Number(r.depth), height: Number(r.height) })).sort((a, b) => a.position - b.position),
    memories: mems.map((x) => ({ ...x, url: x.asset ? urls.get(x.asset.storage_path) ?? null : null })).sort((a, b) => a.position - b.position),
    avatars: m.avatars as AvatarRow[],
    members: m.museum_members as MemberRow[],
    invitations: (invitations ?? []) as InvitationRow[],
  };
}

export async function updateRow(table: 'museums' | 'couples' | 'museum_settings' | 'rooms' | 'memories' | 'users', match: Record<string, string>, patch: Record<string, unknown>) {
  let q = getSupabase().from(table).update(patch);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { error } = await q;
  fail(error);
}

/* ------------------------------------------------------------------ rooms */

export async function addRoom(museumId: string, position: number, title: string) {
  const { error } = await getSupabase().from('rooms').insert({ museum_id: museumId, kind: 'custom', title, position });
  fail(error);
}

export async function deleteRoom(roomId: string, memories: MemoryRow[]) {
  for (const m of memories.filter((x) => x.room_id === roomId)) await deleteMemory(m);
  const { error } = await getSupabase().from('rooms').delete().eq('id', roomId);
  fail(error);
}

/** Swaps two neighbours' positions (rooms or memories). */
export async function swapPositions(table: 'rooms' | 'memories', a: { id: string; position: number }, b: { id: string; position: number }) {
  const sb = getSupabase();
  const [pa, pb] = a.position === b.position ? [a.position, a.position + 1] : [a.position, b.position];
  fail((await sb.from(table).update({ position: pb }).eq('id', a.id)).error);
  fail((await sb.from(table).update({ position: pa }).eq('id', b.id)).error);
}

/* --------------------------------------------------------------- memories */

async function uploadAsset(museumId: string, file: File): Promise<AssetRow> {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('Please sign in again.');
  let blob: Blob = file, width = 16, height = 9, mime = file.type, ext = 'mp4';
  if (VIDEO_TYPES.includes(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) throw new Error('Videos can be up to 50 MB.');
    ext = file.type === 'video/webm' ? 'webm' : 'mp4';
  } else {
    const img = await prepareImage(file);
    blob = img.blob; width = img.width; height = img.height; mime = img.mime;
    ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : 'webp';
  }
  const path = `${museumId}/photos/${crypto.randomUUID()}.${ext}`;
  fail((await sb.storage.from(MEMORY_BUCKET).upload(path, blob, { contentType: mime, cacheControl: '3600', upsert: false })).error);
  const { data, error } = await sb.from('photo_assets').insert({
    museum_id: museumId, storage_path: path, mime_type: mime, width, height, bytes: blob.size,
    uploaded_by: auth.user.id, consent_confirmed_at: new Date().toISOString(),
  }).select('id, storage_path, mime_type, width, height').single();
  if (error) {
    await sb.storage.from(MEMORY_BUCKET).remove([path]); // never leave an orphaned file behind
    throw new Error(error.message);
  }
  return data as AssetRow;
}

async function removeAsset(asset: AssetRow | null) {
  if (!asset) return;
  const sb = getSupabase();
  await sb.storage.from(MEMORY_BUCKET).remove([asset.storage_path]);
  await sb.from('photo_assets').delete().eq('id', asset.id);
}

/** The caller must have collected the consent confirmation before calling this. */
export async function addMemory(museumId: string, roomId: string, file: File, position: number) {
  const asset = await uploadAsset(museumId, file);
  const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60);
  const { error } = await getSupabase().from('memories').insert({ museum_id: museumId, room_id: roomId, asset_id: asset.id, title, position });
  if (error) { await removeAsset(asset); throw new Error(error.message); }
}

export async function replaceMemoryImage(museumId: string, memory: MemoryRow, file: File) {
  const asset = await uploadAsset(museumId, file);
  const { error } = await getSupabase().from('memories').update({ asset_id: asset.id }).eq('id', memory.id);
  if (error) { await removeAsset(asset); throw new Error(error.message); }
  await removeAsset(memory.asset);
}

export async function deleteMemory(memory: MemoryRow) {
  fail((await getSupabase().from('memories').delete().eq('id', memory.id)).error);
  await removeAsset(memory.asset);
}

/* ------------------------------------------------------------------ music */

export async function setMusic(museumId: string, current: string | null, file: File | null) {
  const sb = getSupabase();
  let path: string | null = null;
  if (file) {
    if (!AUDIO_TYPES.includes(file.type)) throw new Error('Please choose an MP3, M4A or OGG file.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Music can be up to 20 MB.');
    path = `${museumId}/music/${crypto.randomUUID()}.${file.type === 'audio/ogg' ? 'ogg' : file.type === 'audio/mp4' ? 'm4a' : 'mp3'}`;
    fail((await sb.storage.from(MEMORY_BUCKET).upload(path, file, { contentType: file.type })).error);
  }
  fail((await sb.from('museum_settings').update({ music_path: path }).eq('museum_id', museumId)).error);
  if (current) await sb.storage.from(MEMORY_BUCKET).remove([current]);
}

/* ---------------------------------------------------------------- avatars */

export async function saveAvatar(museumId: string, userId: string, displayName: string, config: AvatarConfig) {
  const { error } = await getSupabase().from('avatars').upsert(
    { museum_id: museumId, user_id: userId, display_name: displayName, config },
    { onConflict: 'museum_id,user_id' },
  );
  fail(error);
}

/** Stores a reference photograph for avatar creation. Only called after explicit consent. */
export async function setAvatarReference(museumId: string, userId: string, current: string | null, file: File | null): Promise<string | null> {
  const sb = getSupabase();
  let path: string | null = null;
  if (file) {
    const img = await prepareImage(file, 1024);
    path = `${museumId}/avatars/${userId}-${crypto.randomUUID()}.webp`;
    fail((await sb.storage.from(MEMORY_BUCKET).upload(path, img.blob, { contentType: img.mime })).error);
  }
  const { error } = await sb.from('avatars').update({
    reference_photo_path: path, reference_consent_at: path ? new Date().toISOString() : null,
  }).eq('museum_id', museumId).eq('user_id', userId);
  fail(error);
  if (current) await sb.storage.from(MEMORY_BUCKET).remove([current]);
  return path;
}

export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await getSupabase().storage.from(MEMORY_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/* ------------------------------------------------------------ invitations */

export async function createInvitation(museumId: string, email: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('create_invitation', { p_museum: museumId, p_email: email || null });
  fail(error);
  return data as string;
}

export async function revokeInvitation(id: string) {
  fail((await getSupabase().from('invitations').update({ revoked_at: new Date().toISOString() }).eq('id', id)).error);
}

export async function removePartner(museumId: string) {
  fail((await getSupabase().from('museum_members').delete().eq('museum_id', museumId).eq('role', 'partner')).error);
}

/* --------------------------------------------------------------- deletion */

async function removeFolder(prefix: string) {
  const sb = getSupabase();
  for (const sub of ['photos', 'music', 'avatars']) {
    const { data } = await sb.storage.from(MEMORY_BUCKET).list(`${prefix}/${sub}`, { limit: 1000 });
    if (data?.length) await sb.storage.from(MEMORY_BUCKET).remove(data.map((f) => `${prefix}/${sub}/${f.name}`));
  }
}

/** Deletes a museum, every photograph in it and every database row that belongs to it. */
export async function deleteMuseum(museumId: string) {
  await removeFolder(museumId);
  fail((await getSupabase().from('museums').delete().eq('id', museumId)).error);
}

/** Deletes the account, the museums it owns and all their stored files. */
export async function deleteAccount() {
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return;
  const { data: owned } = await sb.from('museums').select('id').eq('owner_id', auth.user.id);
  for (const m of owned ?? []) await removeFolder(m.id);
  fail((await sb.rpc('delete_my_account')).error);
  await sb.auth.signOut();
}
