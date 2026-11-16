'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Protected, SiteHeader } from '@/components/site/Chrome';
import { createMuseum, deleteMuseum, updateRow } from '@/lib/data/editor';
import { MEMORY_BUCKET } from '@/lib/data/museum';
import { PLANS } from '@/lib/plans';
import { getSupabase } from '@/lib/supabase/client';
import type { PlanId } from '@/lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TABS = ['Museums', 'Users', 'Photographs', 'Rooms', 'Settings'] as const;
type Tab = (typeof TABS)[number];

interface AdminData { museums: any[]; users: any[]; assets: any[]; rooms: any[]; sessions: number }

async function loadAdmin(): Promise<AdminData> {
  const sb = getSupabase();
  const [museums, users, assets, rooms, sessions] = await Promise.all([
    sb.from('museums').select('*, couples(*), owner:users!owner_id(email, full_name), museum_members(role)').order('created_at', { ascending: false }).limit(500),
    sb.from('users').select('*').order('created_at', { ascending: false }).limit(500),
    sb.from('photo_assets').select('*, museums(name)').order('created_at', { ascending: false }).limit(60),
    sb.from('rooms').select('*, museums(name)').order('museum_id').order('position').limit(1000),
    sb.from('museum_sessions').select('id', { count: 'exact', head: true }),
  ]);
  for (const r of [museums, users, assets, rooms]) if (r.error) throw new Error(r.error.message);
  const list = assets.data ?? [];
  const images = list.filter((a) => a.mime_type.startsWith('image/'));
  if (images.length) {
    const { data } = await sb.storage.from(MEMORY_BUCKET).createSignedUrls(images.map((a) => a.storage_path), 900);
    const map = new Map((data ?? []).map((u) => [u.path, u.signedUrl]));
    list.forEach((a) => { a.url = map.get(a.storage_path) ?? null; });
  }
  return { museums: museums.data ?? [], users: users.data ?? [], assets: list, rooms: rooms.data ?? [], sessions: sessions.count ?? 0 };
}

function Admin({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>('Museums');
  const [data, setData] = useState<AdminData | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', one: '', two: '', plan: 'premium' as PlanId });

  const reload = useCallback(() => loadAdmin().then(setData).catch((e) => setNote(String(e.message ?? e))), []);
  useEffect(() => { void reload(); }, [reload]);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true); setNote('');
    try { await fn(); setNote(done); await reload(); } catch (e) { setNote(e instanceof Error ? e.message : 'Failed.'); } finally { setBusy(false); }
  };
  const th = 'px-3 py-2 text-left font-sans text-[10px] uppercase tracking-[0.2em] text-beige/70';
  const td = 'px-3 py-3 align-middle text-sm';

  return (
    <main className="mx-auto max-w-7xl px-5 py-12">
      <p className="eyebrow">Laugna Digitale</p>
      <h1 className="mt-3 font-serif text-5xl">Administration</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {[['Museums', data?.museums.length], ['Published', data?.museums.filter((m) => m.status === 'published').length], ['Customers', data?.users.length], ['Visits', data?.sessions]].map(([k, v]) => (
          <div key={k as string} className="card py-4"><p className="eyebrow">{k}</p><p className="mt-2 font-serif text-4xl">{v ?? '—'}</p></div>
        ))}
      </div>

      <div role="tablist" className="mt-10 flex gap-1 overflow-x-auto border-b border-gold/20">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`whitespace-nowrap px-4 py-3 font-sans text-[11px] uppercase tracking-[0.22em] ${tab === t ? 'border-b-2 border-gold text-gold' : 'text-beige hover:text-ivory'}`}>{t}</button>
        ))}
      </div>
      {note && <p role="status" className="mt-5 border border-gold/40 px-4 py-3 text-sm text-gold">{note}</p>}
      {!data && <p className="mt-8 text-sm text-beige">Loading…</p>}

      {data && tab === 'Museums' && (
        <section className="mt-8 space-y-8">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse">
              <thead><tr className="border-b border-gold/20"><th className={th}>Museum</th><th className={th}>Owner</th><th className={th}>Partner</th><th className={th}>Package</th><th className={th}>Status</th><th className={th}>Private link</th><th className={th} /></tr></thead>
              <tbody>
                {data.museums.map((m) => (
                  <tr key={m.id} className="border-b border-gold/10">
                    <td className={td}><span className="font-serif text-xl">{m.name}</span></td>
                    <td className={`${td} text-beige`}>{m.owner?.email ?? '—'}</td>
                    <td className={`${td} text-beige`}>{m.museum_members?.some((x: any) => x.role === 'partner') ? 'Joined' : 'Not yet'}</td>
                    <td className={td}>
                      <select className="input py-1.5" value={m.plan} disabled={busy} onChange={(e) => run(() => updateRow('museums', { id: m.id }, { plan: e.target.value }), 'Package changed.')}>
                        {PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </td>
                    <td className={td}>
                      <button className="btn-small" disabled={busy} onClick={() => run(() => updateRow('museums', { id: m.id }, { status: m.status === 'published' ? 'draft' : 'published' }), 'Publication status changed.')}>
                        {m.status === 'published' ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className={`${td} font-mono text-xs text-beige`}>/museum/{m.slug}</td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      <Link href={`/dashboard/museums/${m.id}`} className="btn-small mr-2">Manage</Link>
                      <button className="btn-danger" disabled={busy} onClick={() => { if (confirm(`Permanently delete “${m.name}” and all its photographs?`)) void run(() => deleteMuseum(m.id), 'Museum deleted.'); }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form className="card grid gap-4 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); if (form.name.trim() && form.one.trim()) void run(async () => { await createMuseum(form.name.trim(), form.one.trim(), form.two.trim(), form.plan); setForm({ name: '', one: '', two: '', plan: 'premium' }); }, 'Museum created. Open “Manage” to fill it and invite the couple.'); }}>
            <h2 className="font-serif text-2xl md:col-span-5">Create a museum for a couple</h2>
            <input className="input md:col-span-2" placeholder="Museum name" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="First partner" maxLength={40} value={form.one} onChange={(e) => setForm({ ...form, one: e.target.value })} />
            <input className="input" placeholder="Second partner" maxLength={40} value={form.two} onChange={(e) => setForm({ ...form, two: e.target.value })} />
            <select className="input" value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value as PlanId })}>{PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <div className="md:col-span-5"><button className="btn-gold" disabled={busy}>Create museum</button></div>
          </form>
        </section>
      )}

      {data && tab === 'Users' && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse">
            <thead><tr className="border-b border-gold/20"><th className={th}>Name</th><th className={th}>Email</th><th className={th}>Joined</th><th className={th}>Role</th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-gold/10">
                  <td className={td}>{u.full_name || '—'}</td>
                  <td className={`${td} text-beige`}>{u.email}</td>
                  <td className={`${td} text-beige`}>{new Date(u.created_at).toLocaleDateString('en-GB')}</td>
                  <td className={td}>
                    <select className="input max-w-40 py-1.5" value={u.role} disabled={busy || u.id === userId} title={u.id === userId ? 'You cannot change your own role' : undefined}
                      onChange={(e) => { if (confirm(`Make ${u.email} ${e.target.value === 'admin' ? 'an administrator' : 'a customer'}?`)) void run(() => updateRow('users', { id: u.id }, { role: e.target.value }), 'Role changed.'); }}>
                      <option value="customer">Customer</option><option value="admin">Administrator</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && tab === 'Photographs' && (
        <section className="mt-8">
          <p className="text-sm text-beige">The 60 most recent uploads across all museums. To caption, reorder or replace, open the museum under “Museums → Manage → Memories”.</p>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {data.assets.map((a) => (
              <figure key={a.id} className="card p-2">
                <div className="flex aspect-square items-center justify-center bg-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.url ? <img src={a.url} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="text-xs text-beige/60">{a.mime_type}</span>}
                </div>
                <figcaption className="mt-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-beige">{a.museums?.name}</span>
                  <button className="btn-danger" disabled={busy} onClick={() => { if (confirm('Delete this photograph permanently?')) void run(async () => { const sb = getSupabase(); await sb.storage.from(MEMORY_BUCKET).remove([a.storage_path]); await sb.from('memories').delete().eq('asset_id', a.id); const { error } = await sb.from('photo_assets').delete().eq('id', a.id); if (error) throw new Error(error.message); }, 'Photograph deleted.'); }}>Delete</button>
                </figcaption>
              </figure>
            ))}
          </div>
          {data.assets.length === 0 && <p className="mt-6 text-sm text-beige">No photographs have been uploaded yet.</p>}
        </section>
      )}

      {data && tab === 'Rooms' && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse">
            <thead><tr className="border-b border-gold/20"><th className={th}>Museum</th><th className={th}>#</th><th className={th}>Room</th><th className={th}>Type</th><th className={th}>Size (m)</th><th className={th} /></tr></thead>
            <tbody>
              {data.rooms.map((r) => (
                <tr key={r.id} className="border-b border-gold/10">
                  <td className={`${td} text-beige`}>{r.museums?.name}</td>
                  <td className={td}>{r.position + 1}</td>
                  <td className={td}><span className="mr-2 inline-block h-3 w-3 border border-gold/40 align-middle" style={{ background: r.wall_color }} />{r.title}</td>
                  <td className={`${td} text-beige`}>{String(r.kind).replace('_', ' ')}</td>
                  <td className={`${td} text-beige`}>{Number(r.width)} × {Number(r.depth)} × {Number(r.height)}</td>
                  <td className={`${td} text-right`}><Link href={`/dashboard/museums/${r.museum_id}`} className="btn-small">Edit rooms</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && tab === 'Settings' && (
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card">
            <h2 className="font-serif text-2xl">Packages</h2>
            <table className="mt-4 w-full border-collapse">
              <thead><tr className="border-b border-gold/20"><th className={th}>Package</th><th className={th}>Price</th><th className={th}>Rooms</th><th className={th}>Photographs</th><th className={th}>Video</th></tr></thead>
              <tbody>{PLANS.map((p) => <tr key={p.id} className="border-b border-gold/10"><td className={td}>{p.name}</td><td className={`${td} text-gold`}>{p.price}</td><td className={td}>{p.maxRooms}</td><td className={td}>{p.maxPhotos}</td><td className={td}>{p.video ? 'Yes' : '—'}</td></tr>)}</tbody>
            </table>
            <p className="mt-4 text-xs leading-relaxed text-beige/70">Limits are enforced in the database (function <code>plan_limit</code>) and mirrored in <code>src/lib/plans.ts</code>. Change both together. Prices are proposals to validate before launch.</p>
          </div>
          <div className="card space-y-3 text-sm leading-relaxed text-beige">
            <h2 className="font-serif text-2xl text-ivory">Operating notes</h2>
            <p>Every museum’s names, messages, rooms, photographs, music, avatars, private links and publication status are managed from “Museums → Manage”. No source code changes are needed.</p>
            <p>Administrators can open any museum to support a couple. Use that access only when asked — the photographs are personal.</p>
            <p>Payments are not connected in this prototype; assign a package here once a customer has paid.</p>
          </div>
        </section>
      )}
    </main>
  );
}

export default function AdminPage() {
  return (
    <>
      <SiteHeader />
      <Protected admin>{(s) => <Admin userId={s.session!.user.id} />}</Protected>
    </>
  );
}
