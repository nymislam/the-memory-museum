'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { credentialsSchema, firstError } from '@/lib/validation';

/** Only same-site paths are accepted as a post-login destination (no open redirects). */
const safeNext = (v: string | null) => (v && v.startsWith('/') && !v.startsWith('//') ? v : '/dashboard');

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const signup = mode === 'signup';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setInfo('');
    if (!isSupabaseConfigured) { setError('Accounts are not available until Supabase is connected (see the README).'); return; }
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) { setError(firstError(parsed.error)); return; }
    if (signup && !name.trim()) { setError('Please tell us your name.'); return; }
    if (signup && !terms) { setError('Please confirm the privacy terms to create an account.'); return; }
    setBusy(true);
    const sb = getSupabase();
    try {
      if (signup) {
        const { data, error } = await sb.auth.signUp({
          email: parsed.data.email, password: parsed.data.password,
          options: { data: { full_name: name.trim().slice(0, 80), accepted_terms: 'true' }, emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        if (data.session) router.push(next);
        else setInfo('Almost there — open the confirmation link we just emailed you.');
      } else {
        const { error } = await sb.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        router.push(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card mx-auto w-full max-w-md space-y-5" noValidate>
      <div className="text-center">
        <p className="eyebrow">{signup ? 'Begin your museum' : 'Welcome back'}</p>
        <h1 className="mt-3 font-serif text-4xl">{signup ? 'Create an account' : 'Sign in'}</h1>
      </div>
      {signup && (
        <div><label className="field-label" htmlFor="name">Your name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" /></div>
      )}
      <div><label className="field-label" htmlFor="email">Email</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
      <div><label className="field-label" htmlFor="password">Password</label>
        <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} /></div>
      {signup && (
        <label className="flex items-start gap-3 text-xs leading-relaxed text-beige">
          <input type="checkbox" className="mt-0.5 accent-[#C6A36B]" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>I agree that my photographs are stored privately to build my museum, and I understand I can delete them and my account at any time.</span>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {info && <p role="status" className="text-sm text-gold">{info}</p>}
      <button className="btn-gold w-full" disabled={busy}>{busy ? 'One moment…' : signup ? 'Create account' : 'Sign in'}</button>
      <p className="text-center text-xs text-beige">
        {signup ? 'Already have an account? ' : 'New here? '}
        <Link className="text-gold underline-offset-4 hover:underline" href={`${signup ? '/login' : '/signup'}?next=${encodeURIComponent(next)}`}>{signup ? 'Sign in' : 'Create an account'}</Link>
      </p>
    </form>
  );
}
