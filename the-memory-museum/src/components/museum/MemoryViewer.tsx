'use client';
import { useEffect } from 'react';
import type { MemoryData } from '@/lib/types';

const longDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** The enlarged view of one memory: photograph or video, date, caption and message. */
export function MemoryViewer({ memory, onClose }: { memory: MemoryData; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={memory.title || 'Memory'}
      className="pointer-events-auto absolute inset-0 z-30 flex animate-fade items-center justify-center bg-ink/85 p-4 backdrop-blur-md sm:p-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-6xl flex-col gap-6 overflow-y-auto md:flex-row md:items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <div className="border-[10px] border-gold bg-ink p-1 shadow-[0_30px_80px_rgba(0,0,0,.6)] [border-image:linear-gradient(135deg,#E6CFA0,#C6A36B_40%,#8A6A3C_70%,#E6CFA0)_1]">
            {memory.kind === 'video' && memory.videoUrl ? (
              <video src={memory.videoUrl} controls playsInline className="max-h-[70vh] max-w-full" />
            ) : memory.imageUrl ? (
              // Signed, short-lived URL from private storage: next/image optimisation would cache it publicly.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={memory.imageUrl} alt={memory.title} className="max-h-[70vh] max-w-full object-contain" />
            ) : (
              <div className="flex h-64 w-80 items-center justify-center text-sm text-beige">This photograph could not be loaded.</div>
            )}
          </div>
        </div>
        <aside className="w-full shrink-0 text-ivory md:w-80">
          {memory.date && <p className="mb-3 font-sans text-[11px] uppercase tracking-luxe text-gold">{longDate(memory.date)}</p>}
          <h2 className="font-serif text-4xl leading-tight">{memory.title || 'Untitled memory'}</h2>
          {memory.caption && <p className="mt-4 font-serif text-xl italic text-beige">{memory.caption}</p>}
          {memory.message && (
            <p className="mt-6 whitespace-pre-line border-l border-gold/60 pl-4 font-sans text-sm leading-relaxed text-ivory/90">{memory.message}</p>
          )}
          <button onClick={onClose} className="btn-ghost mt-8">Return to the gallery</button>
        </aside>
      </div>
    </div>
  );
}
