'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { loadMuseum, type LoadResult } from '@/lib/data/museum';
import { DEMO_AVATARS } from '@/lib/data/demo';
import type { Visitor } from '@/lib/types';

// The 3D engine is only downloaded once a visitor actually enters.
const MuseumExperience = dynamic(() => import('@/components/museum/MuseumExperience'), {
  ssr: false,
  loading: () => <Veil title="Preparing the palace…" />,
});

function Veil({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <p className="eyebrow">The Memory Museum</p>
      <h1 className="font-serif text-3xl sm:text-4xl">{title}</h1>
      <div className="rule" />
      {children}
    </main>
  );
}

export default function MuseumPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [result, setResult] = useState<LoadResult | null>(null);
  const [visitor, setVisitor] = useState<Visitor | null>(null);
  const [entered, setEntered] = useState(false);
  const [who, setWho] = useState(0);

  useEffect(() => {
    let alive = true;
    loadMuseum(slug).then((r) => { if (alive) setResult(r); }).catch((e) => { if (alive) setResult({ ok: false, reason: 'error', message: String(e) }); });
    return () => { alive = false; };
  }, [slug]);

  if (!result) return <Veil title="Opening your museum…" />;

  if (!result.ok) {
    const next = encodeURIComponent(`/museum/${slug}`);
    if (result.reason === 'sign-in') {
      return <Veil title="This museum is private"><p className="max-w-md text-sm text-beige">Sign in with the account that owns this museum, or the one that was invited to it.</p><Link className="btn-gold" href={`/login?next=${next}`}>Sign in</Link></Veil>;
    }
    if (result.reason === 'unpublished') {
      return <Veil title="Not yet open"><p className="max-w-md text-sm text-beige">Your partner is still arranging the galleries. You will be able to enter as soon as the museum is published.</p></Veil>;
    }
    if (result.reason === 'not-configured') {
      return <Veil title="Backend not connected"><p className="max-w-md text-sm text-beige">Private museums need a Supabase project. Until one is configured, the demonstration museum is available.</p><Link className="btn-gold" href="/museum/demo">Enter the demo</Link></Veil>;
    }
    return <Veil title="Museum not found"><p className="max-w-md text-sm text-beige">{result.message ?? 'This address does not match a museum you have access to.'}</p><Link className="btn-ghost" href="/">Return home</Link></Veil>;
  }

  const { museum, demo } = result;

  if (entered && visitor) {
    return <MuseumExperience museum={museum} visitor={visitor} demo={demo} onExit={() => (demo ? setEntered(false) : router.push('/dashboard'))} />;
  }

  const enter = () => {
    if (demo) {
      const name = who === 0 ? museum.partnerOne : museum.partnerTwo;
      setVisitor({ id: `demo-${Math.random().toString(36).slice(2, 10)}`, name, avatar: DEMO_AVATARS[who] });
    } else {
      setVisitor(result.visitor);
    }
    setEntered(true);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(198,163,107,.22),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-6 border border-gold/20" />
      <p className="eyebrow animate-fade">A private museum</p>
      <h1 className="mt-6 animate-fadeUp font-serif text-5xl leading-none sm:text-7xl">
        {museum.partnerOne}
        {museum.partnerTwo && <><span className="mx-4 font-light italic text-gold">&amp;</span>{museum.partnerTwo}</>}
      </h1>
      <div className="rule mt-8" />
      {museum.welcomeMessage && (
        <p className="mt-8 max-w-xl animate-fadeUp whitespace-pre-line font-serif text-xl italic text-beige [animation-delay:.25s] sm:text-2xl">“{museum.welcomeMessage}”</p>
      )}

      {demo && (
        <div className="mt-10 animate-fadeUp [animation-delay:.4s]">
          <p className="field-label">Who is visiting?</p>
          <div className="flex gap-3">
            {[museum.partnerOne, museum.partnerTwo].map((n, i) => (
              <button key={n} onClick={() => setWho(i)} className={`border px-6 py-2 font-serif text-xl transition ${who === i ? 'border-gold bg-gold text-ink' : 'border-gold/40 text-ivory hover:border-gold'}`}>{n}</button>
            ))}
          </div>
        </div>
      )}

      <button onClick={enter} className="btn-gold mt-10 animate-fadeUp [animation-delay:.55s]">Enter the museum</button>
      {demo ? (
        <p className="mt-6 max-w-md text-xs leading-relaxed text-beige/70">
          Demonstration museum with placeholder artwork. To try two visitors, open this page in a second tab of the same browser and enter as the other person.
        </p>
      ) : (
        <p className="mt-6 text-xs text-beige/70">{result.visitor ? `You are entering as ${result.visitor.name}.` : ''} Only you and your partner can see these rooms.</p>
      )}
    </main>
  );
}
