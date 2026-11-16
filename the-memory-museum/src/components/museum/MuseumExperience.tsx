'use client';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import { buildPalaceLayout } from '@/lib/palace/layout';
import type { MuseumData, Visitor } from '@/lib/types';
import { DEFAULT_AVATAR } from '@/lib/types';
import { DEMO_AVATARS } from '@/lib/data/demo';
import { createLocalTransport, createSupabaseTransport, type Transport, type TransportHandlers } from '@/lib/net/transport';
import { getSupabase } from '@/lib/supabase/client';
import { input, peerTargets, useExperience } from '@/lib/store';
import { Palace } from './Palace';
import { LocalPlayer, RemotePlayer } from './Players';
import { Joystick, useIsTouch, useKeyboard, useLookDrag } from './Controls';
import { MemoryViewer } from './MemoryViewer';

interface Props {
  museum: MuseumData;
  visitor: Visitor;
  demo: boolean;
  onExit: () => void;
}

const PEER_TIMEOUT_MS = 4000;

export default function MuseumExperience({ museum, visitor, demo, onExit }: Props) {
  const layout = useMemo(() => buildPalaceLayout(museum), [museum]);
  // Optional ?room=2 starts the visit in that room — useful when testing a long palace.
  const spawns = useMemo(() => {
    const n = typeof window === 'undefined' ? NaN : Number(new URLSearchParams(window.location.search).get('room'));
    const r = Number.isInteger(n) ? layout.rooms[n] : undefined;
    if (!r) return layout.spawns;
    return [[-0.9, r.zFront - 5.5], [0.9, r.zFront - 5.5]] as [number, number][];
  }, [layout]);
  const wrap = useRef<HTMLDivElement>(null);
  const transport = useRef<Transport | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [help, setHelp] = useState(true);
  const [finalSeen, setFinalSeen] = useState(false);
  const touch = useIsTouch();

  const { roomIndex, nearby, open, peers, netStatus, onDais, quality, localPartner, set } = useExperience();

  useKeyboard();
  useLookDrag(wrap);

  // --- start state --------------------------------------------------------
  useEffect(() => {
    input.yaw = 0; input.pitch = 0.14;
    const weak = window.matchMedia('(pointer: coarse)').matches || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    useExperience.getState().reset();
    set({ quality: weak ? 'low' : 'high' });
    const t = setTimeout(() => setHelp(false), 9000);
    return () => clearTimeout(t);
  }, [set]);

  // --- multiplayer ----------------------------------------------------------
  useEffect(() => {
    const store = useExperience.getState();
    const handlers: TransportHandlers = {
      onState: (s) => {
        peerTargets.set(s.id, { x: s.x, y: s.y, z: s.z, ry: s.ry, moving: s.moving, lastSeen: performance.now() });
        useExperience.getState().upsertPeer(s);
      },
      onLeave: (id) => { peerTargets.delete(id); useExperience.getState().removePeer(id); },
      onStatus: (status) => store.set({ netStatus: status }),
    };
    transport.current = demo
      ? createLocalTransport(museum.id, visitor.id, handlers)
      : createSupabaseTransport(museum.id, visitor.id, handlers);

    // A partner whose connection drops simply fades out, and reappears when it returns.
    const sweep = setInterval(() => {
      const now = performance.now();
      for (const [id, t] of peerTargets) {
        if (now - t.lastSeen > PEER_TIMEOUT_MS) { peerTargets.delete(id); useExperience.getState().removePeer(id); }
      }
    }, 1000);
    return () => {
      clearInterval(sweep);
      transport.current?.close();
      transport.current = null;
      peerTargets.clear();
    };
  }, [demo, museum.id, visitor.id]);

  // --- visit log + last-seen record (database mode only) --------------------
  useEffect(() => {
    if (demo) return;
    const sb = getSupabase();
    let sessionId: string | null = null;
    void sb.from('museum_sessions').insert({ museum_id: museum.id, started_by: visitor.id }).select('id').single()
      .then(({ data }) => { sessionId = data?.id ?? null; });
    const beat = () => {
      const room = layout.rooms[useExperience.getState().roomIndex]?.room.id ?? null;
      void sb.from('player_presence').upsert(
        { museum_id: museum.id, user_id: visitor.id, room_id: room, last_seen_at: new Date().toISOString() },
        { onConflict: 'museum_id,user_id' },
      );
    };
    beat();
    const timer = setInterval(beat, 20000);
    return () => {
      clearInterval(timer);
      if (sessionId) void sb.from('museum_sessions').update({ ended_at: new Date().toISOString() }).eq('id', sessionId);
    };
  }, [demo, museum.id, visitor.id, layout]);

  // --- interaction keys -------------------------------------------------------
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const s = useExperience.getState();
      if ((e.code === 'KeyE' || e.code === 'Enter') && s.nearby && !s.open) s.set({ open: s.nearby });
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // --- music ------------------------------------------------------------------
  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    el.volume = museum.musicVolume;
    el.muted = muted;
    if (!muted) el.play().catch(() => setMuted(true));
  }, [muted, museum.musicVolume]);

  const high = quality === 'high';
  const room = layout.rooms[roomIndex]?.room;
  const peerList = Object.values(peers);
  const partner = peerList[0];
  const localVisitor: Visitor = useMemo(() => {
    const idx = demo && visitor.name === museum.partnerOne ? 1 : 0;
    return {
      id: `${visitor.id}-local`,
      name: demo ? (idx === 1 ? museum.partnerTwo : museum.partnerOne) : 'Test partner',
      avatar: demo ? DEMO_AVATARS[idx] : { ...DEFAULT_AVATAR, outfitColor: '#7A2E3A', outfit: 'dress', hairStyle: 'long' },
    };
  }, [demo, visitor, museum.partnerOne, museum.partnerTwo]);

  return (
    <div ref={wrap} className="fixed inset-0 touch-none select-none overflow-hidden bg-ink">
      <SceneBoundary onExit={onExit}>
        <Canvas
          shadows={high}
          dpr={high ? [1, 1.75] : [1, 1.15]}
          camera={{ fov: 58, near: 0.1, far: 130, position: [0, 2.4, 3] }}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: 0.92 }}
          onCreated={() => setTimeout(() => setReady(true), 350)}
        >
          <color attach="background" args={['#17130F']} />
          <fog attach="fog" args={['#241A12', 28, 100]} />
          <ambientLight intensity={0.22} color="#FFF1DC" />
          <hemisphereLight args={['#FFF4E0', '#6A4E34', 0.3]} />
          <directionalLight
            name="sun"
            castShadow={high}
            intensity={0.45}
            color="#FFE8C8"
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-13}
            shadow-camera-right={13}
            shadow-camera-top={13}
            shadow-camera-bottom={-13}
            shadow-camera-far={30}
            shadow-bias={-0.0005}
          />
          {/* A tiny generated environment gives gold and crystal something to reflect. */}
          <Environment resolution={128} frames={1} environmentIntensity={0.4}>
            <color attach="background" args={['#3a2c1e']} />
            <Lightformer intensity={5} color="#FFE2B0" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} />
            <Lightformer intensity={2.5} color="#FFF6E6" position={[-7, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
            <Lightformer intensity={2.5} color="#FFF6E6" position={[7, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
            <Lightformer intensity={1.5} color="#C6A36B" position={[0, 2, -8]} scale={[10, 4, 1]} />
          </Environment>
          <PerformanceMonitor onDecline={() => set({ quality: 'low' })} />

          <Palace
            layout={layout}
            museum={museum}
            quality={quality}
            roomIndex={roomIndex}
            nearbyId={nearby?.id ?? null}
            onOpen={(m) => set({ open: m })}
          />
          <LocalPlayer layout={layout} visitor={visitor} spawn={spawns[0]} scheme="wasd" primary transport={transport} shadows={high} />
          {localPartner && (
            <LocalPlayer layout={layout} visitor={localVisitor} spawn={spawns[1]} scheme="arrows" primary={false} shadows={high} />
          )}
          {peerList.map((p) => <RemotePlayer key={p.id} peer={p} shadows={high} />)}
        </Canvas>
      </SceneBoundary>

      {/* loading veil */}
      <div className={`pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center bg-ink transition-opacity duration-[1600ms] ${ready ? 'opacity-0' : 'opacity-100'}`}>
        <p className="eyebrow">The Memory Museum</p>
        <p className="mt-4 font-serif text-3xl text-ivory">The doors are opening…</p>
        <div className="rule mt-6" />
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-ink/70 to-transparent" />
        <div className="absolute left-4 top-4 max-w-[46vw] max-sm:hidden">
          <p className="eyebrow">The Memory Museum</p>
          <p className="truncate font-serif text-lg text-ivory/90">{museum.name}</p>
        </div>

        {room && (
          <div key={room.id} className="absolute inset-x-0 top-[16%] animate-roomTitle text-center">
            <p className="font-sans text-[10px] uppercase tracking-luxe text-gold">{room.subtitle}</p>
            <p className="mt-2 font-serif text-3xl text-ivory drop-shadow-[0_2px_12px_rgba(0,0,0,.8)] sm:text-5xl">{room.title}</p>
            <div className="rule mt-4" />
          </div>
        )}

        <div className="absolute right-4 top-4 flex flex-wrap items-center justify-end gap-2">
          <span className="hud-chip !cursor-default">
            <span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${partner ? 'bg-emerald-400' : netStatus === 'connected' ? 'bg-gold' : 'bg-red-400'}`} />
            {partner
              ? `${partner.name} · ${layout.rooms[partner.room]?.room.title ?? 'in the museum'}`
              : netStatus === 'connected' ? 'Waiting for your partner'
              : netStatus === 'connecting' ? 'Connecting…'
              : netStatus === 'reconnecting' ? 'Reconnecting…' : 'Offline — exploring alone'}
          </span>
          {museum.musicUrl && <button className="hud-chip" onClick={() => setMuted((m) => !m)}>{muted ? 'Music off' : 'Music on'}</button>}
          <button className="hud-chip" onClick={() => set({ quality: high ? 'low' : 'high' })}>{high ? 'Quality · high' : 'Quality · light'}</button>
          {!touch && (
            <button className="hud-chip" onClick={() => set({ localPartner: !localPartner })} title="Adds a second avatar on this device, moved with the arrow keys">
              {localPartner ? 'Hide test partner' : 'Test partner (arrows)'}
            </button>
          )}
          <button className="hud-chip" onClick={() => setHelp((h) => !h)}>Help</button>
          <button className="hud-chip" onClick={onExit}>Leave</button>
        </div>

        {help && (
          <div className="absolute bottom-44 left-1/2 w-[min(92vw,34rem)] -translate-x-1/2 animate-fade border border-gold/30 bg-ink/70 px-5 py-4 text-center font-sans text-xs leading-relaxed text-ivory/90 backdrop-blur-md sm:bottom-10">
            {touch
              ? 'Move with the joystick · drag the scene to look around · tap a golden frame to open a memory'
              : 'Walk with W A S D (hold Shift to stride) · drag with the mouse to look around · click a golden frame, or press E beside one'}
          </div>
        )}

        {nearby && !open && (
          <button className="pointer-events-auto absolute bottom-10 left-1/2 -translate-x-1/2 animate-fade border border-gold bg-ink/70 px-6 py-3 font-sans text-[11px] uppercase tracking-luxe text-gold backdrop-blur-md hover:bg-gold hover:text-ink max-sm:bottom-44"
            onClick={() => set({ open: nearby })}>
            View “{nearby.title || 'memory'}”{!touch && <span className="ml-3 opacity-60">E</span>}
          </button>
        )}

        {onDais && !finalSeen && museum.finalMessage && (
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 animate-fadeUp bg-gradient-to-t from-ink via-ink/90 to-transparent px-6 pb-10 pt-24 text-center">
            <p className="eyebrow">For you</p>
            <p className="mx-auto mt-4 max-w-2xl whitespace-pre-line font-serif text-2xl italic leading-snug text-ivory sm:text-4xl">“{museum.finalMessage}”</p>
            <p className="mt-4 font-serif text-lg text-gold">— {visitor.name === museum.partnerOne ? museum.partnerTwo : museum.partnerOne}</p>
            <button className="btn-ghost mt-6" onClick={() => setFinalSeen(true)}>Close</button>
          </div>
        )}

        {touch && !open && <Joystick />}
      </div>

      {open && <MemoryViewer memory={open} onClose={() => set({ open: null })} />}
      {museum.musicUrl && <audio ref={audio} src={museum.musicUrl} loop preload="auto" />}
    </div>
  );
}

/** If WebGL is unavailable or the context is lost, explain instead of showing a blank page. */
class SceneBoundary extends Component<{ children: ReactNode; onExit: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-8 text-center">
        <p className="eyebrow">The Memory Museum</p>
        <h1 className="font-serif text-3xl">The palace could not be displayed</h1>
        <p className="max-w-md text-sm text-beige">This browser or device did not provide 3D graphics (WebGL). Try an up-to-date version of Chrome, Safari, Edge or Firefox, or reload the page.</p>
        <div className="flex gap-3">
          <button className="btn-gold" onClick={() => window.location.reload()}>Reload</button>
          <button className="btn-ghost" onClick={this.props.onExit}>Go back</button>
        </div>
      </div>
    );
  }
}
