'use client';
import { useEffect, useRef, useState } from 'react';
import { input } from '@/lib/store';

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

/** Keyboard state for both local control schemes (WASD and arrow keys). */
export function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (MOVE_KEYS.has(e.code)) { input.keys.add(e.code); if (e.code.startsWith('Arrow')) e.preventDefault(); }
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.code);
    const clear = () => input.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, []);
}

/**
 * Drag anywhere on the scene to look around — mouse on desktop, a finger on touch
 * screens. No pointer lock, so photographs stay clickable and the UI stays calm.
 */
export function useLookDrag(target: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = target.current;
    if (!el) return;
    let id: number | null = null;
    let lx = 0, ly = 0;
    const down = (e: PointerEvent) => {
      if (id !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      id = e.pointerId; lx = e.clientX; ly = e.clientY;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      const k = e.pointerType === 'touch' ? 0.0065 : 0.0045;
      input.yaw -= (e.clientX - lx) * k;
      input.pitch = Math.min(0.95, Math.max(-0.12, input.pitch + (e.clientY - ly) * k * 0.8));
      lx = e.clientX; ly = e.clientY;
    };
    const up = (e: PointerEvent) => { if (e.pointerId === id) id = null; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [target]);
}

export function useIsTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const set = () => setTouch(mq.matches);
    set();
    mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  }, []);
  return touch;
}

/** On-screen movement joystick for touch devices. */
export function Joystick() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef<number | null>(null);
  const R = 46;

  const update = (e: React.PointerEvent) => {
    const rect = base.current!.getBoundingClientRect();
    let x = e.clientX - (rect.left + rect.width / 2);
    let y = e.clientY - (rect.top + rect.height / 2);
    const m = Math.hypot(x, y);
    if (m > R) { x = (x / m) * R; y = (y / m) * R; }
    setKnob({ x, y });
    input.stick.x = x / R;
    input.stick.y = -y / R;
  };
  const end = (e: React.PointerEvent) => {
    if (e.pointerId !== active.current) return;
    active.current = null;
    setKnob({ x: 0, y: 0 });
    input.stick.x = 0; input.stick.y = 0;
  };
  useEffect(() => () => { input.stick.x = 0; input.stick.y = 0; }, []);

  return (
    <div
      ref={base}
      role="application"
      aria-label="Movement joystick"
      className="pointer-events-auto absolute bottom-8 left-6 h-32 w-32 touch-none select-none rounded-full border border-gold/50 bg-ink/40 backdrop-blur-sm"
      onPointerDown={(e) => { e.stopPropagation(); active.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (e.pointerId === active.current) update(e); }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border border-gold bg-gold/40 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
