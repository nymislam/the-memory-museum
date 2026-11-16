'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Protected, SiteHeader } from '@/components/site/Chrome';
import { createMuseum, listMuseums } from '@/lib/data/editor';
import { PLANS, planById } from '@/lib/plans';
import { firstError, museumSchema } from '@/lib/validation';
import type { PlanId } from '@/lib/types';

type Row = Awaited<ReturnType<typeof listMuseums>>[number];

function Dashboard({ userId, fullName }: { userId: string; fullName: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [form, setForm] = useState({ name: '', one: fullName.split(' ')[0] ?? '', two: '', plan: 'premium' as PlanId });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { listMuseums().then(setRows).catch((e) => { setError(String(e.message ?? e)); setRows([]); }); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = museumSchema.safeParse({ name: form.name, partnerOne: form.one, partnerTwo: form.two });
    if (!parsed.success) { setError(firstError(parsed.error)); return; }
    setBusy(true); setError('');
    try {
      const m = await createMuseum(parsed.data.name, parsed.data.partnerOne, parsed.data.partnerTwo, form.plan);
      router.push(`/dashboard/museums/${m.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the museum.'); setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <p className="eyebrow">Your dashboard</p>
      <h1 className="mt-3 font-serif text-5xl">{fullName ? `Welcome, ${fullName.split(' ')[0]}` : 'Welcome'}</h1>

      <section className="mt-10">
        <h2 className="font-serif text-3xl">Your museums</h2>
        {rows === null && <p className="mt-4 text-sm text-beige">Loading…</p>}
        {rows?.length === 0 && <p className="mt-4 text-sm text-beige">You have no museum yet. Create your first one below.</p>}
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {rows?.map((m) => (
            <article key={m.id} className="card flex flex-col gap-4">
              <div>
                <p className="eyebrow">{planById(m.plan).name} · {m.status === 'published' ? 'Published' : 'Draft'} · {m.owner_id === userId ? 'Owner' : 'Partner'}</p>
                <h3 className="mt-2 font-serif text-3xl">{m.name}</h3>
                {m.couple && <p className="mt-1 font-serif text-lg italic text-beige">{[m.couple.partner_one_name, m.couple.partner_two_name].filter(Boolean).join(' & ')}</p>}
              </div>
              <div className="mt-auto flex flex-wrap gap-3">
                <Link className="btn-gold" href={`/museum/${m.slug}`}>Enter</Link>
                <Link className="btn-ghost" href={`/dashboard/museums/${m.id}`}>{m.owner_id === userId ? 'Edit' : 'My avatar'}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="create" className="mt-14">
        <h2 className="font-serif text-3xl">Create a museum</h2>
        <form onSubmit={create} className="card mt-6 grid gap-5 md:grid-cols-2" noValidate>
          <label className="md:col-span-2"><span className="field-label">Museum name</span>
            <input className="input" value={form.name} maxLength={80} placeholder="The Museum of Us" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label><span className="field-label">Your first name</span>
            <input className="input" value={form.one} maxLength={40} onChange={(e) => setForm({ ...form, one: e.target.value })} /></label>
          <label><span className="field-label">Your partner’s first name</span>
            <input className="input" value={form.two} maxLength={40} onChange={(e) => setForm({ ...form, two: e.target.value })} /></label>
          <fieldset className="md:col-span-2">
            <legend className="field-label">Package</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((p) => (
                <button type="button" key={p.id} aria-pressed={form.plan === p.id} onClick={() => setForm({ ...form, plan: p.id })}
                  className={`border p-4 text-left transition ${form.plan === p.id ? 'border-gold bg-gold/10' : 'border-gold/20 hover:border-gold/60'}`}>
                  <span className="block font-serif text-xl">{p.name}</span>
                  <span className="mt-1 block font-serif text-2xl text-gold">{p.price}</span>
                  <span className="mt-2 block text-xs text-beige">{p.maxRooms} rooms · {p.maxPhotos} photographs</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-beige/70">Prototype: payment is not connected yet, so choosing a package here is free. Only an administrator can change it afterwards.</p>
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-300 md:col-span-2">{error}</p>}
          <div className="md:col-span-2"><button className="btn-gold" disabled={busy}>{busy ? 'Building your palace…' : 'Create museum'}</button></div>
        </form>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <Protected>{(s) => <Dashboard userId={s.session!.user.id} fullName={s.fullName} />}</Protected>
    </>
  );
}
