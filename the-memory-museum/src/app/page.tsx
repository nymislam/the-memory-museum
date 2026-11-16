import Link from 'next/link';
import { SiteFooter, SiteHeader } from '@/components/site/Chrome';
import { PLANS } from '@/lib/plans';

const ROOMS = [
  ['I', 'The Grand Entrance', 'Your names above the first arch, and a welcome written by one of you for the other.'],
  ['II', 'The First Memories Gallery', 'The first photographs, the first meeting, the dates that started everything.'],
  ['III', 'The Love Gallery', 'Anniversaries and ordinary Sundays, each in its own golden frame with a message behind it.'],
  ['IV', 'The Journey Gallery', 'Everywhere you have been together: travels, occasions, the videos you keep rewatching.'],
  ['V', 'The Final Memory Room', 'A dais, one last frame, and the words you most want them to read.'],
];

const FEATURES = [
  ['Two visitors, one palace', 'Each of you enters from your own phone or computer and sees the other walking beside you, in real time.'],
  ['Your photographs, framed', 'Upload from any device. Portrait or landscape, every picture is hung, lit and captioned automatically.'],
  ['Characters that look like you', 'Choose skin tone, hair, outfit and colours, and watch your figure turn in a live preview.'],
  ['Private by construction', 'Only the two of you can open the doors. Photographs are never given a public address.'],
  ['Yours to rearrange', 'Rename rooms, repaint walls, reorder memories and rewrite messages whenever you like — no code, no waiting.'],
  ['Phone, tablet, desktop', 'Walk with the keyboard or a touch joystick. The palace adapts its detail to the device.'],
];

/** Decorative arch motif for the hero, drawn in CSS so the landing page stays light. */
function Arches() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
      {[34, 26, 19, 13].map((w, i) => (
        <div key={w} className="absolute bottom-0 rounded-t-full border border-b-0 border-gold"
          style={{ width: `${w}rem`, height: `${w * 1.15}rem`, opacity: 0.16 + i * 0.12, boxShadow: 'inset 0 0 60px rgba(198,163,107,.12)' }} />
      ))}
      <div className="absolute bottom-0 h-40 w-[13rem] rounded-t-full bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,226,168,.55),transparent_70%)]" />
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* hero */}
        <section className="relative flex min-h-[92vh] flex-col items-center overflow-hidden px-5 pt-24 text-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(198,163,107,.2),transparent_55%)]" />
          <p className="eyebrow animate-fade">Laugna Digitale presents</p>
          <h1 className="mt-6 animate-fadeUp font-serif text-6xl leading-[0.95] sm:text-8xl">The Memory<br /><span className="italic text-gold">Museum</span></h1>
          <div className="rule mt-8" />
          <p className="mt-8 max-w-xl animate-fadeUp font-serif text-2xl italic text-beige [animation-delay:.2s]">Every love story deserves its own museum.</p>
          <p className="mt-4 max-w-lg animate-fadeUp text-sm leading-relaxed text-beige/80 [animation-delay:.3s]">
            A private royal palace, built from your photographs. Walk its marble galleries together — each from your own device — and stop at every memory.
          </p>
          <div className="relative z-10 mt-10 flex animate-fadeUp flex-wrap justify-center gap-4 [animation-delay:.45s]">
            <Link href="/museum/demo" className="btn-gold">Walk through the demo</Link>
            <Link href="/signup" className="btn-ghost">Create your museum</Link>
          </div>
          <Arches />
        </section>

        {/* product explanation */}
        <section id="experience" className="border-t border-gold/15 px-5 py-24">
          <div className="mx-auto max-w-5xl">
            <p className="eyebrow text-center">The experience</p>
            <h2 className="mt-4 text-center font-serif text-4xl sm:text-5xl">Five rooms. One story. Two visitors.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-beige">
              It is not a slideshow and it is not a game. It is a place: columns, chandeliers, long corridors, and your own pictures on the walls.
              You arrive at the entrance, find each other, and walk.
            </p>
            <ol className="mt-14 divide-y divide-gold/15 border-y border-gold/15">
              {ROOMS.map(([n, title, text]) => (
                <li key={n} className="grid gap-2 py-7 sm:grid-cols-[5rem_18rem_1fr] sm:items-baseline">
                  <span className="font-serif text-3xl italic text-gold">{n}</span>
                  <h3 className="font-serif text-2xl">{title}</h3>
                  <p className="text-sm leading-relaxed text-beige">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* features */}
        <section id="features" className="border-t border-gold/15 bg-[#1B1510] px-5 py-24">
          <div className="mx-auto max-w-6xl">
            <p className="eyebrow text-center">Features</p>
            <h2 className="mt-4 text-center font-serif text-4xl sm:text-5xl">Made with care, down to the cornice</h2>
            <div className="mt-14 grid gap-px bg-gold/15 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(([title, text]) => (
                <div key={title} className="bg-[#1B1510] p-8">
                  <h3 className="font-serif text-2xl text-ivory">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-beige">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* pricing */}
        <section id="pricing" className="border-t border-gold/15 px-5 py-24">
          <div className="mx-auto max-w-6xl">
            <p className="eyebrow text-center">Pricing</p>
            <h2 className="mt-4 text-center font-serif text-4xl sm:text-5xl">One payment. Yours to keep.</h2>
            <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((p) => (
                <article key={p.id} className={`flex flex-col border p-7 ${p.id === 'premium' ? 'border-gold bg-gold/[0.07]' : 'border-gold/20'}`}>
                  <p className="eyebrow">{p.id === 'premium' ? 'Most chosen' : p.tagline}</p>
                  <h3 className="mt-3 font-serif text-3xl">{p.name}</h3>
                  <p className="mt-2 font-serif text-5xl text-gold">{p.price}</p>
                  <ul className="mt-6 flex-1 space-y-3 text-sm text-beige">
                    {p.features.map((f) => <li key={f} className="flex gap-3"><span className="text-gold">◆</span>{f}</li>)}
                  </ul>
                  <Link href="/signup" className={`mt-8 ${p.id === 'premium' ? 'btn-gold' : 'btn-ghost'}`}>{p.id === 'custom' ? 'Enquire' : 'Begin'}</Link>
                </article>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-beige/60">Introductory prices. Payment is arranged directly with LAUGNA DIGITALE while the platform is in preview.</p>
          </div>
        </section>

        <section className="border-t border-gold/15 px-5 py-24 text-center">
          <h2 className="mx-auto max-w-3xl font-serif text-4xl italic leading-tight sm:text-6xl">“Take your time, and take my hand.”</h2>
          <div className="rule mt-8" />
          <Link href="/museum/demo" className="btn-gold mt-10">Enter the demo museum</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
