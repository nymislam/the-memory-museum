'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  addMemory, addRoom, createInvitation, deleteAccount, deleteMemory, deleteMuseum, deleteRoom, loadEditor, removePartner,
  replaceMemoryImage, revokeInvitation, setMusic, swapPositions, updateRow,
  type EditorData, type MemoryRow, type RoomRow,
} from '@/lib/data/editor';
import { PLANS, planById } from '@/lib/plans';
import { firstError, memorySchema, museumSchema, roomSchema } from '@/lib/validation';
import type { PlanId } from '@/lib/types';
import { AvatarEditor } from './AvatarEditor';

const TABS = ['Museum', 'Rooms', 'Memories', 'Avatar', 'Sharing', 'Privacy'] as const;
type Tab = (typeof TABS)[number];

interface Props { museumId: string; userId: string; isAdmin: boolean }

export function MuseumEditor({ museumId, userId, isAdmin }: Props) {
  const router = useRouter();
  const [data, setData] = useState<EditorData | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('Museum');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const reload = useCallback(async () => {
    try { setData(await loadEditor(museumId)); } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Could not load the museum.' }); setData(null); }
  }, [museumId]);
  useEffect(() => { void reload(); }, [reload]);

  /** Runs a mutation, shows the outcome and refreshes the data. */
  const run = useCallback(async (fn: () => Promise<void>, done = 'Saved.') => {
    setBusy(true); setNote(null);
    try { await fn(); setNote({ ok: true, text: done }); await reload(); }
    catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong.' }); }
    finally { setBusy(false); }
  }, [reload]);

  if (data === undefined) return <p className="px-5 py-24 text-center text-beige">Opening the editor…</p>;
  if (data === null) return <p className="px-5 py-24 text-center text-beige">This museum does not exist, or you do not have access to it.</p>;

  const { museum } = data;
  const isOwner = museum.owner_id === userId;
  const canEdit = isOwner || isAdmin || data.settings.allow_partner_edit;
  const plan = planById(museum.plan);
  const tabs = TABS.filter((t) => (t === 'Sharing' || t === 'Privacy' ? isOwner || isAdmin : t === 'Avatar' ? data.members.some((m) => m.user_id === userId) : true));
  const ctx: Ctx = { data, run, busy, canEdit, isOwner, isAdmin, userId };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={isAdmin && !isOwner ? '/admin' : '/dashboard'} className="eyebrow hover:underline">← {isAdmin && !isOwner ? 'Administration' : 'Your museums'}</Link>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl">{museum.name}</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-beige">
            {plan.name} · <span className={museum.status === 'published' ? 'text-emerald-300' : 'text-gold'}>{museum.status === 'published' ? 'Published' : 'Draft'}</span>
            {' · '}{data.memories.length}/{plan.maxPhotos} photographs · {data.rooms.length}/{plan.maxRooms} rooms
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/museum/${museum.slug}`} className="btn-ghost">Preview in 3D</Link>
          {(isOwner || isAdmin) && (
            <button className="btn-gold" disabled={busy}
              onClick={() => run(() => updateRow('museums', { id: museum.id }, { status: museum.status === 'published' ? 'draft' : 'published' }), museum.status === 'published' ? 'Museum unpublished.' : 'Museum published — your partner can now enter.')}>
              {museum.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      <div role="tablist" className="mt-8 flex gap-1 overflow-x-auto border-b border-gold/20">
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setNote(null); }}
            className={`whitespace-nowrap px-4 py-3 font-sans text-[11px] uppercase tracking-[0.22em] transition ${tab === t ? 'border-b-2 border-gold text-gold' : 'text-beige hover:text-ivory'}`}>{t}</button>
        ))}
      </div>

      {note && <p role="status" className={`mt-5 border px-4 py-3 text-sm ${note.ok ? 'border-gold/40 text-gold' : 'border-red-400/50 text-red-300'}`}>{note.text}</p>}
      {!canEdit && tab !== 'Avatar' && <p className="mt-5 text-sm text-beige">You can look, but only the museum’s owner can change this section.</p>}

      <div className="mt-8">
        {tab === 'Museum' && <MuseumTab {...ctx} />}
        {tab === 'Rooms' && <RoomsTab {...ctx} />}
        {tab === 'Memories' && <MemoriesTab {...ctx} />}
        {tab === 'Avatar' && <AvatarEditor museumId={museum.id} userId={userId} row={data.avatars.find((a) => a.user_id === userId)} onSaved={reload} />}
        {tab === 'Sharing' && <SharingTab {...ctx} />}
        {tab === 'Privacy' && <PrivacyTab {...ctx} onGone={() => router.push(isAdmin && !isOwner ? '/admin' : '/dashboard')} />}
      </div>
    </div>
  );
}

interface Ctx {
  data: EditorData;
  run: (fn: () => Promise<void>, done?: string) => Promise<void>;
  busy: boolean;
  canEdit: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  userId: string;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="field-label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-beige/60">{hint}</span>}</label>;
}

/* ----------------------------------------------------------------- museum */

function MuseumTab({ data, run, busy, canEdit, isOwner, isAdmin }: Ctx) {
  const { museum, couple, settings } = data;
  const [f, setF] = useState({
    name: museum.name, one: couple.partner_one_name, two: couple.partner_two_name, anniversary: couple.anniversary_date ?? '',
    welcome: settings.welcome_message, final: settings.final_message, volume: Number(settings.music_volume),
  });
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  const owner = isOwner || isAdmin;

  const save = () => run(async () => {
    const parsed = museumSchema.safeParse({ name: f.name, partnerOne: f.one, partnerTwo: f.two });
    if (!parsed.success) throw new Error(firstError(parsed.error));
    if (owner) await updateRow('museums', { id: museum.id }, { name: parsed.data.name });
    await updateRow('couples', { museum_id: museum.id }, { partner_one_name: parsed.data.partnerOne, partner_two_name: parsed.data.partnerTwo, anniversary_date: f.anniversary || null });
    if (owner) await updateRow('museum_settings', { museum_id: museum.id }, { welcome_message: f.welcome.slice(0, 600), final_message: f.final.slice(0, 1200), music_volume: f.volume });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <fieldset disabled={!canEdit || busy} className="card space-y-5">
        <h2 className="font-serif text-2xl">The couple</h2>
        <Field label="Museum name"><input className="input" value={f.name} maxLength={80} disabled={!owner} onChange={(e) => set({ name: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name"><input className="input" value={f.one} maxLength={40} onChange={(e) => set({ one: e.target.value })} /></Field>
          <Field label="Partner’s name"><input className="input" value={f.two} maxLength={40} onChange={(e) => set({ two: e.target.value })} /></Field>
        </div>
        <Field label="Together since" hint="Shown above the first arch."><input type="date" className="input" value={f.anniversary} onChange={(e) => set({ anniversary: e.target.value })} /></Field>
        {isAdmin && (
          <Field label="Package (administrators only)">
            <select className="input" value={museum.plan} onChange={(e) => run(() => updateRow('museums', { id: museum.id }, { plan: e.target.value as PlanId }), 'Package changed.')}>
              {PLANS.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.price}</option>)}
            </select>
          </Field>
        )}
      </fieldset>

      <fieldset disabled={!owner || busy} className="card space-y-5">
        <h2 className="font-serif text-2xl">Words</h2>
        <Field label="Welcome message" hint="Shown on the private welcome page before entering.">
          <textarea className="input min-h-24" value={f.welcome} maxLength={600} onChange={(e) => set({ welcome: e.target.value })} />
        </Field>
        <Field label="Final message" hint="Revealed when a visitor steps onto the dais in the last room.">
          <textarea className="input min-h-28" value={f.final} maxLength={1200} onChange={(e) => set({ final: e.target.value })} />
        </Field>
      </fieldset>

      <fieldset disabled={!owner || busy} className="card space-y-4">
        <h2 className="font-serif text-2xl">Background music</h2>
        <p className="text-sm text-beige">{settings.music_path ? 'A track is set. It plays softly once a visitor enters.' : 'No music yet. Upload an MP3, M4A or OGG you have the right to use.'}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="btn-small cursor-pointer">{settings.music_path ? 'Replace track' : 'Upload track'}
            <input type="file" accept="audio/mpeg,audio/mp4,audio/ogg" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(() => setMusic(museum.id, settings.music_path, file), 'Music updated.'); }} />
          </label>
          {settings.music_path && <button className="btn-danger" onClick={() => run(() => setMusic(museum.id, settings.music_path, null), 'Music removed.')}>Remove</button>}
        </div>
        <Field label={`Volume · ${Math.round(f.volume * 100)}%`}><input type="range" min={0} max={1} step={0.05} value={f.volume} onChange={(e) => set({ volume: Number(e.target.value) })} className="w-full accent-[#C6A36B]" /></Field>
      </fieldset>

      <div className="flex items-start lg:col-span-2"><button className="btn-gold" disabled={!canEdit || busy} onClick={save}>Save changes</button></div>
    </div>
  );
}

/* ------------------------------------------------------------------ rooms */

function RoomsTab({ data, run, busy, canEdit }: Ctx) {
  const plan = planById(data.museum.plan);
  const [title, setTitle] = useState('');
  return (
    <div className="space-y-4">
      <p className="text-sm text-beige">Rooms are built in this order, front door to final room, and joined by corridors. A gallery grows longer automatically when it needs more wall for its photographs.</p>
      {data.rooms.map((room, i) => (
        <RoomCard key={room.id} room={room} count={data.memories.filter((m) => m.room_id === room.id).length} disabled={!canEdit || busy}
          onSave={(patch) => run(() => updateRow('rooms', { id: room.id }, patch))}
          onMove={(dir) => { const other = data.rooms[i + dir]; if (other) void run(() => swapPositions('rooms', room, other), 'Order changed.'); }}
          onDelete={() => { if (confirm(`Delete “${room.title}” and the memories hanging in it?`)) void run(() => deleteRoom(room.id, data.memories), 'Room deleted.'); }}
          first={i === 0} last={i === data.rooms.length - 1} />
      ))}
      {canEdit && data.rooms.length < plan.maxRooms ? (
        <form className="card flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void run(async () => { await addRoom(data.museum.id, (data.rooms.at(-1)?.position ?? -1) + 1, title.trim().slice(0, 60)); setTitle(''); }, 'Room added.'); }}>
          <div className="min-w-56 flex-1"><Field label="New room title"><input className="input" value={title} maxLength={60} placeholder="The Summer Gallery" onChange={(e) => setTitle(e.target.value)} /></Field></div>
          <button className="btn-ghost" disabled={busy}>Add room</button>
        </form>
      ) : canEdit && <p className="text-sm text-beige/70">The {plan.name} includes up to {plan.maxRooms} rooms.</p>}
    </div>
  );
}

function RoomCard({ room, count, disabled, onSave, onMove, onDelete, first, last }: {
  room: RoomRow; count: number; disabled: boolean; first: boolean; last: boolean;
  onSave: (patch: Record<string, unknown>) => void; onMove: (dir: -1 | 1) => void; onDelete: () => void;
}) {
  const [f, setF] = useState({ title: room.title, subtitle: room.subtitle, width: room.width, depth: room.depth, height: room.height, wallColor: room.wall_color });
  const [err, setErr] = useState('');
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  const save = () => {
    const parsed = roomSchema.safeParse(f);
    if (!parsed.success) { setErr(firstError(parsed.error)); return; }
    setErr('');
    const d = parsed.data;
    onSave({ title: d.title, subtitle: d.subtitle, width: d.width, depth: d.depth, height: d.height, wall_color: d.wallColor });
  };
  const num = (k: 'width' | 'depth' | 'height', label: string, min: number, max: number) => (
    <Field label={label}><input type="number" className="input" min={min} max={max} step={0.5} value={f[k]} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<typeof f>)} /></Field>
  );
  return (
    <fieldset disabled={disabled} className="card">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
        <Field label="Title"><input className="input" value={f.title} maxLength={60} onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Subtitle"><input className="input" value={f.subtitle} maxLength={80} onChange={(e) => set({ subtitle: e.target.value })} /></Field>
        <Field label="Wall colour"><input type="color" className="h-[46px] w-20 cursor-pointer border border-beige/25 bg-transparent" value={f.wallColor} onChange={(e) => set({ wallColor: e.target.value })} /></Field>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4 md:max-w-md">
        {num('width', 'Width (m)', 8, 30)}{num('depth', 'Depth (m)', 8, 60)}{num('height', 'Height (m)', 4.5, 12)}
      </div>
      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button className="btn-small" onClick={save}>Save room</button>
        <button className="btn-small" disabled={first} onClick={() => onMove(-1)} aria-label="Move earlier">↑ Earlier</button>
        <button className="btn-small" disabled={last} onClick={() => onMove(1)} aria-label="Move later">↓ Later</button>
        <button className="btn-danger" onClick={onDelete}>Delete</button>
        <span className="ml-auto text-xs text-beige/70">{count} {count === 1 ? 'memory' : 'memories'}</span>
      </div>
    </fieldset>
  );
}

/* --------------------------------------------------------------- memories */

function MemoriesTab({ data, run, busy, canEdit }: Ctx) {
  const plan = planById(data.museum.plan);
  const [roomId, setRoomId] = useState(data.rooms[1]?.id ?? data.rooms[0]?.id ?? '');
  const [consent, setConsent] = useState(false);
  const inRoom = data.memories.filter((m) => m.room_id === roomId);
  const left = plan.maxPhotos - data.memories.length;

  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, left));
    void run(async () => {
      let pos = (inRoom.at(-1)?.position ?? -1) + 1;
      for (const file of list) await addMemory(data.museum.id, roomId, file, pos++);
    }, `${list.length} ${list.length === 1 ? 'memory' : 'memories'} hung in the gallery.`);
  };

  if (!data.rooms.length) return <p className="text-sm text-beige">Add a room first.</p>;
  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto">
        {data.rooms.map((r) => (
          <button key={r.id} onClick={() => setRoomId(r.id)} className={`whitespace-nowrap border px-4 py-2 font-serif text-lg transition ${roomId === r.id ? 'border-gold bg-gold text-ink' : 'border-gold/30 text-ivory hover:border-gold'}`}>
            {r.title} <span className="font-sans text-xs opacity-70">{data.memories.filter((m) => m.room_id === r.id).length}</span>
          </button>
        ))}
      </div>

      {canEdit && (
        <div className="card space-y-4">
          <h2 className="font-serif text-2xl">Add photographs</h2>
          <label className="flex items-start gap-3 text-xs leading-relaxed text-beige">
            <input type="checkbox" className="mt-0.5 accent-[#C6A36B]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I have the right to use these photographs, and the people who appear in them are happy for them to be shown privately in this museum.</span>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <label className={`btn-gold cursor-pointer ${!consent || busy || left <= 0 ? 'pointer-events-none opacity-40' : ''}`}>
              {busy ? 'Working…' : 'Choose photographs'}
              <input type="file" multiple accept={`image/jpeg,image/png,image/webp${plan.video ? ',video/mp4,video/webm' : ''}`} className="hidden" disabled={!consent || busy || left <= 0}
                onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
            </label>
            <p className="text-xs text-beige/70">{left > 0 ? `${left} of ${plan.maxPhotos} remaining.` : 'This package is full.'} JPEG, PNG or WebP up to 15 MB{plan.video ? '; MP4 or WebM video up to 50 MB' : ''}. Photographs are resized and their location data removed before upload.</p>
          </div>
        </div>
      )}

      {inRoom.length === 0 && <p className="text-sm text-beige">No memories hang in this room yet.</p>}
      <div className="grid gap-5 md:grid-cols-2">
        {inRoom.map((m, i) => (
          <MemoryCard key={m.id} memory={m} rooms={data.rooms} disabled={!canEdit || busy} first={i === 0} last={i === inRoom.length - 1}
            onSave={(patch) => run(() => updateRow('memories', { id: m.id }, patch))}
            onMove={(dir) => { const other = inRoom[i + dir]; if (other) void run(() => swapPositions('memories', m, other), 'Order changed.'); }}
            onReplace={(file) => run(() => replaceMemoryImage(data.museum.id, m, file), 'Photograph replaced.')}
            onDelete={() => { if (confirm('Delete this memory and its photograph permanently?')) void run(() => deleteMemory(m), 'Memory deleted.'); }} />
        ))}
      </div>
    </div>
  );
}

function MemoryCard({ memory, rooms, disabled, first, last, onSave, onMove, onReplace, onDelete }: {
  memory: MemoryRow; rooms: RoomRow[]; disabled: boolean; first: boolean; last: boolean;
  onSave: (patch: Record<string, unknown>) => void; onMove: (dir: -1 | 1) => void; onReplace: (f: File) => void; onDelete: () => void;
}) {
  const [f, setF] = useState({ title: memory.title, caption: memory.caption, message: memory.message, date: memory.memory_date ?? '', room: memory.room_id });
  const [err, setErr] = useState('');
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  const save = () => {
    const parsed = memorySchema.safeParse({ title: f.title, caption: f.caption, message: f.message, date: f.date || null });
    if (!parsed.success) { setErr(firstError(parsed.error)); return; }
    setErr('');
    onSave({ title: parsed.data.title, caption: parsed.data.caption, message: parsed.data.message, memory_date: parsed.data.date, room_id: f.room });
  };
  const video = memory.asset?.mime_type.startsWith('video/');
  return (
    <fieldset disabled={disabled} className="card flex gap-4 p-4 max-sm:flex-col">
      <div className="flex h-36 w-full shrink-0 items-center justify-center border-4 border-gold/70 bg-ink sm:w-36">
        {memory.url ? (video
          ? <video src={memory.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={memory.url} alt={memory.title} loading="lazy" className="h-full w-full object-cover" />
        ) : <span className="text-xs text-beige/60">No image</span>}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <input className="input" aria-label="Title" placeholder="Title" value={f.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} />
        <div className="grid grid-cols-2 gap-3">
          <input type="date" className="input" aria-label="Date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
          <select className="input" aria-label="Room" value={f.room} onChange={(e) => set({ room: e.target.value })}>
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
        </div>
        <input className="input" aria-label="Caption" placeholder="Caption" value={f.caption} maxLength={240} onChange={(e) => set({ caption: e.target.value })} />
        <textarea className="input min-h-20" aria-label="Personal message" placeholder="A personal message (optional)" value={f.message} maxLength={1200} onChange={(e) => set({ message: e.target.value })} />
        {err && <p className="text-sm text-red-300">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-small" onClick={save}>Save</button>
          <button className="btn-small" disabled={first} onClick={() => onMove(-1)} aria-label="Move earlier">↑</button>
          <button className="btn-small" disabled={last} onClick={() => onMove(1)} aria-label="Move later">↓</button>
          <label className="btn-small cursor-pointer">Replace
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) onReplace(file); }} />
          </label>
          <button className="btn-danger" onClick={onDelete}>Delete</button>
        </div>
      </div>
    </fieldset>
  );
}

/* ---------------------------------------------------------------- sharing */

function SharingTab({ data, run, busy }: Ctx) {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const partner = data.members.find((m) => m.role === 'partner');
  const state = (i: EditorData['invitations'][number]) => i.accepted_at ? 'Accepted' : i.revoked_at ? 'Revoked' : new Date(i.expires_at) < new Date() ? 'Expired' : 'Waiting';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-4">
        <h2 className="font-serif text-2xl">Invite your partner</h2>
        {partner ? (
          <>
            <p className="text-sm text-beige">Your partner has joined. Only the two of you can enter this museum.</p>
            <button className="btn-danger" disabled={busy} onClick={() => { if (confirm('Remove your partner’s access to this museum?')) void run(() => removePartner(data.museum.id), 'Partner removed.'); }}>Remove partner’s access</button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-beige">Create a private link and send it yourself. It works once, for one person, and expires after 14 days. They sign in, accept, and become the second — and only other — visitor.</p>
            <Field label="Partner’s email (optional, for your own reference)"><input type="email" className="input" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} /></Field>
            <button className="btn-gold" disabled={busy} onClick={() => run(async () => { const token = await createInvitation(data.museum.id, email.trim()); setLink(`${window.location.origin}/invite/${token}`); setCopied(false); }, 'Invitation created. Copy the link now — it is shown only once.')}>Create private link</button>
            {link && (
              <div className="space-y-2 border border-gold/40 p-3">
                <p className="break-all font-mono text-xs text-ivory">{link}</p>
                <button className="btn-small" onClick={() => { void navigator.clipboard.writeText(link).then(() => setCopied(true)); }}>{copied ? 'Copied' : 'Copy link'}</button>
              </div>
            )}
          </>
        )}
        {data.museum.status !== 'published' && <p className="text-xs text-gold">Your partner can accept now, but can only enter once the museum is published.</p>}
      </div>

      <div className="card space-y-4">
        <h2 className="font-serif text-2xl">Invitations</h2>
        {data.invitations.length === 0 && <p className="text-sm text-beige">None yet.</p>}
        <ul className="divide-y divide-gold/15">
          {data.invitations.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 truncate text-beige">{i.email || 'Private link'} · {new Date(i.created_at).toLocaleDateString('en-GB')}</span>
              <span className="flex items-center gap-3"><span className="text-xs uppercase tracking-[0.2em] text-gold">{state(i)}</span>
                {state(i) === 'Waiting' && <button className="btn-danger" disabled={busy} onClick={() => run(() => revokeInvitation(i.id), 'Invitation revoked.')}>Revoke</button>}</span>
            </li>
          ))}
        </ul>
        <label className="flex items-start gap-3 border-t border-gold/15 pt-4 text-sm text-beige">
          <input type="checkbox" className="mt-1 accent-[#C6A36B]" checked={data.settings.allow_partner_edit} disabled={busy}
            onChange={(e) => run(() => updateRow('museum_settings', { museum_id: data.museum.id }, { allow_partner_edit: e.target.checked }), 'Permission updated.')} />
          <span>Let my partner add and edit photographs, rooms and names too.</span>
        </label>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- privacy */

function PrivacyTab({ data, run, busy, isOwner, onGone }: Ctx & { onGone: () => void }) {
  const [confirmText, setConfirmText] = useState('');
  const router = useRouter();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-3 text-sm leading-relaxed text-beige">
        <h2 className="font-serif text-2xl text-ivory">How this museum is protected</h2>
        <p>Photographs are kept in private storage. They are never given a public address; each visit receives links that expire after about two hours.</p>
        <p>Only the owner and one invited partner can open the museum. The database itself refuses everyone else, whatever link they hold.</p>
        <p>Location data embedded in photographs is removed before they leave your device.</p>
        <p>Unpublish at any time from the top of this page to close the doors to your partner while you rearrange.</p>
      </div>
      <div className="card space-y-5">
        <h2 className="font-serif text-2xl">Delete</h2>
        <div className="space-y-2">
          <p className="text-sm text-beige">Delete this museum, every photograph in it, and every message. This cannot be undone.</p>
          <button className="btn-danger" disabled={busy} onClick={() => { if (confirm(`Permanently delete “${data.museum.name}” and all of its photographs?`)) void run(async () => { await deleteMuseum(data.museum.id); onGone(); }, 'Museum deleted.'); }}>Delete this museum</button>
        </div>
        {isOwner && (
          <div className="space-y-2 border-t border-gold/15 pt-5">
            <p className="text-sm text-beige">Delete your account, all museums you own and all of their photographs. Type DELETE to confirm.</p>
            <div className="flex gap-3">
              <input className="input max-w-40" aria-label="Type DELETE to confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              <button className="btn-danger" disabled={busy || confirmText !== 'DELETE'} onClick={() => run(async () => { await deleteAccount(); router.push('/'); }, 'Account deleted.')}>Delete my account</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
