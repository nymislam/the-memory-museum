import type { AvatarConfig } from '../types';
import { getSupabase } from '../supabase/client';

/** One player's replicated state. Sent ~12 times a second, interpolated on arrival. */
export interface PlayerState {
  id: string;
  name: string;
  avatar: AvatarConfig;
  x: number;
  y: number;
  z: number;
  ry: number;
  moving: boolean;
  room: number;
}

export type NetStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

export interface TransportHandlers {
  onState: (state: PlayerState) => void;
  onLeave: (id: string) => void;
  onStatus: (status: NetStatus) => void;
}

export interface Transport {
  send: (state: PlayerState) => void;
  close: () => void;
}

const valid = (s: unknown): s is PlayerState => {
  const p = s as PlayerState;
  return !!p && typeof p.id === 'string' && p.id.length < 80 && [p.x, p.y, p.z, p.ry].every(Number.isFinite) && typeof p.avatar === 'object';
};

/**
 * Real multiplayer across devices: a private Supabase Realtime channel per museum.
 * Realtime Authorization (see the SQL migration) only lets museum members join.
 */
export function createSupabaseTransport(museumId: string, selfId: string, h: TransportHandlers): Transport {
  const sb = getSupabase();
  h.onStatus('connecting');
  const channel = sb.channel(`museum:${museumId}`, {
    config: { private: true, broadcast: { self: false, ack: false }, presence: { key: selfId } },
  });
  channel
    .on('broadcast', { event: 'state' }, ({ payload }) => { if (valid(payload) && payload.id !== selfId) h.onState(payload); })
    .on('presence', { event: 'leave' }, ({ key }) => { if (key !== selfId) h.onLeave(key); })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') { h.onStatus('connected'); void channel.track({ at: Date.now() }); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') h.onStatus('reconnecting');
      else if (status === 'CLOSED') h.onStatus('offline');
    });
  return {
    send: (state) => { void channel.send({ type: 'broadcast', event: 'state', payload: state }); },
    close: () => { void sb.removeChannel(channel); },
  };
}

/**
 * Demo transport: links tabs of the same browser with BroadcastChannel, so the
 * two-visitor experience can be tried before a backend is connected.
 */
export function createLocalTransport(museumId: string, selfId: string, h: TransportHandlers): Transport {
  if (typeof BroadcastChannel === 'undefined') { h.onStatus('offline'); return { send: () => {}, close: () => {} }; }
  const bc = new BroadcastChannel(`memory-museum:${museumId}`);
  bc.onmessage = (e) => {
    const msg = e.data as { type: string; state?: PlayerState; id?: string };
    if (msg.type === 'state' && valid(msg.state) && msg.state.id !== selfId) h.onState(msg.state);
    if (msg.type === 'leave' && msg.id && msg.id !== selfId) h.onLeave(msg.id);
  };
  const leave = () => bc.postMessage({ type: 'leave', id: selfId });
  window.addEventListener('pagehide', leave);
  h.onStatus('connected');
  return {
    send: (state) => bc.postMessage({ type: 'state', state }),
    close: () => { leave(); window.removeEventListener('pagehide', leave); bc.close(); },
  };
}
