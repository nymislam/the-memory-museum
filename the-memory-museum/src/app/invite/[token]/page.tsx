'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Notice, SiteHeader } from '@/components/site/Chrome';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { useSession } from '@/lib/supabase/useSession';

interface Preview { museum_name: string; partner_one: string | null; valid: boolean }

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { loading, session } = useSession();
  const [preview, setPreview] = useState<Preview | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const wellFormed = /^[0-9a-f]{64}$/.test(token);

  useEffect(() => {
    if (!isSupabaseConfigured || !wellFormed) { setPreview(null); return; }
    getSupabase().rpc('get_invitation', { p_token: token }).then(({ data }) => setPreview((Array.isArray(data) ? data[0] : data) ?? null));
  }, [token, wellFormed]);

  const accept = async () => {
    setBusy(true); setError('');
    const { data, error } = await getSupabase().rpc('accept_invitation', { p_token: token });
    if (error) { setError(error.message); setBusy(false); return; }
    router.push(`/museum/${data as string}`);
  };

  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <>
      <SiteHeader />
      {preview === undefined || loading ? (
        <Notice title="Opening your invitation…"><p>One moment.</p></Notice>
      ) : !preview || !preview.valid ? (
        <Notice title="This invitation has closed">
          <p>The link has already been used, was withdrawn, or has expired. Ask your partner to send a new one.</p>
          <Link href="/" className="btn-ghost">Return home</Link>
        </Notice>
      ) : (
        <Notice title={preview.partner_one ? `${preview.partner_one} has built you a museum` : 'You have been invited'}>
          <p className="font-serif text-2xl italic text-ivory">{preview.museum_name}</p>
          <p>A private palace of your shared memories. Only the two of you will ever be able to enter.</p>
          {session ? (
            <button className="btn-gold" disabled={busy} onClick={accept}>{busy ? 'Opening the doors…' : 'Accept and enter'}</button>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              <Link className="btn-gold" href={`/signup?next=${next}`}>Create an account to accept</Link>
              <Link className="btn-ghost" href={`/login?next=${next}`}>I already have one</Link>
            </div>
          )}
          {error && <p role="alert" className="text-red-300">{error}</p>}
        </Notice>
      )}
    </>
  );
}
