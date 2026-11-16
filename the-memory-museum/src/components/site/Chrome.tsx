'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useSession, type SessionState } from '@/lib/supabase/useSession';

export function Wordmark() {
  return (
    <Link href="/" className="group flex flex-col leading-none">
      <span className="font-serif text-xl tracking-wide text-ivory transition group-hover:text-gold">The Memory Museum</span>
      <span className="mt-1 font-sans text-[9px] uppercase tracking-luxe text-gold/80">Laugna Digitale</span>
    </Link>
  );
}

export function SiteHeader() {
  const { session, role } = useSession();
  const router = useRouter();
  const signOut = async () => { await getSupabase().auth.signOut(); router.push('/'); };
  return (
    <header className="sticky top-0 z-20 border-b border-gold/15 bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Wordmark />
        <nav className="flex items-center gap-4 font-sans text-[10px] uppercase tracking-[0.22em] text-beige sm:gap-6">
          <Link href="/#experience" className="hidden hover:text-gold md:block">Experience</Link>
          <Link href="/#features" className="hidden hover:text-gold md:block">Features</Link>
          <Link href="/#pricing" className="hidden hover:text-gold sm:block">Pricing</Link>
          {session ? (
            <>
              {role === 'admin' && <Link href="/admin" className="hover:text-gold">Admin</Link>}
              <Link href="/dashboard" className="hover:text-gold">Dashboard</Link>
              <button onClick={signOut} className="uppercase tracking-[0.22em] hover:text-gold">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-gold">Sign in</Link>
              <Link href="/signup" className="border border-gold px-4 py-2 text-gold transition hover:bg-gold hover:text-ink">Create yours</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-gold/15 px-5 py-10 text-center">
      <p className="font-serif text-lg italic text-beige">Every love story deserves its own museum.</p>
      <p className="mt-3 font-sans text-[10px] uppercase tracking-luxe text-gold/70">The Memory Museum · Laugna Digitale</p>
    </footer>
  );
}

export function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="eyebrow">The Memory Museum</p>
      <h1 className="mt-4 font-serif text-4xl">{title}</h1>
      <div className="rule my-6" />
      <div className="space-y-4 text-sm leading-relaxed text-beige">{children}</div>
    </div>
  );
}

/**
 * Gate for signed-in pages. This is a convenience for the visitor; the real
 * protection is row-level security in the database, which the browser cannot bypass.
 */
export function Protected({ admin = false, children }: { admin?: boolean; children: (s: SessionState) => ReactNode }) {
  const state = useSession();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (isSupabaseConfigured && !state.loading && !state.session) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [state.loading, state.session, router, path]);

  if (!isSupabaseConfigured) {
    return (
      <Notice title="Connect Supabase to continue">
        <p>Accounts, private museums and uploads need a Supabase project. Add its URL and anon key to <code className="text-gold">.env.local</code> and run the SQL migration — the README walks through it.</p>
        <Link href="/museum/demo" className="btn-gold">Explore the demo museum</Link>
      </Notice>
    );
  }
  if (state.loading || !state.session) return <Notice title="One moment…"><p>Checking your invitation to the palace.</p></Notice>;
  if (admin && state.role !== 'admin') return <Notice title="Administrators only"><p>This area is reserved for the LAUGNA DIGITALE team.</p><Link href="/dashboard" className="btn-ghost">Go to your dashboard</Link></Notice>;
  return <>{children(state)}</>;
}
