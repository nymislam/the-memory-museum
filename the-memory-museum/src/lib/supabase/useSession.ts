'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './client';

export interface SessionState {
  loading: boolean;
  session: Session | null;
  role: 'customer' | 'admin' | null;
  fullName: string;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: isSupabaseConfigured, session: null, role: null, fullName: '' });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = getSupabase();
    let alive = true;
    const load = async (session: Session | null) => {
      if (!session) {
        if (alive) setState({ loading: false, session: null, role: null, fullName: '' });
        return;
      }
      const { data } = await sb.from('users').select('role, full_name').eq('id', session.user.id).maybeSingle();
      if (alive) setState({ loading: false, session, role: data?.role ?? 'customer', fullName: data?.full_name ?? '' });
    };
    sb.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => { void load(session); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
