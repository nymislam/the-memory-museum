'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { DEFAULT_AVATAR, type AvatarConfig } from '@/lib/types';
import { saveAvatar, setAvatarReference, signedUrl, type AvatarRow } from '@/lib/data/editor';

const AvatarPreview = dynamic(() => import('./AvatarPreview'), { ssr: false });

const SKIN = ['#F6D7BD', '#E9BE9A', '#D9A77F', '#C08A62', '#9B6A47', '#6E4630', '#4B2E20'];
const HAIR = ['#17130F', '#2B1D14', '#4A2F1E', '#7B4A26', '#B8864B', '#D9B77A', '#8C8C8C', '#E9E4DA', '#7A2E3A'];
const CLOTH = ['#17130F', '#1E2430', '#2F3B2A', '#4A3525', '#7A2E3A', '#8A6A3C', '#D8C9B5', '#F3EBDD', '#2B3A67'];

function Swatches({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((c) => (
          <button key={c} type="button" aria-label={`${label} ${c}`} aria-pressed={value === c} onClick={() => onChange(c)}
            className={`h-8 w-8 rounded-full border-2 transition ${value.toLowerCase() === c.toLowerCase() ? 'border-gold scale-110' : 'border-transparent hover:border-gold/50'}`} style={{ background: c }} />
        ))}
        <input type="color" aria-label={`Custom ${label}`} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 w-10 cursor-pointer border border-gold/30 bg-transparent" />
      </div>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, text]) => (
          <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
            className={`border px-3 py-1.5 text-xs transition ${value === v ? 'border-gold bg-gold text-ink' : 'border-gold/30 text-beige hover:border-gold'}`}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export function AvatarEditor({ museumId, userId, row, onSaved }: { museumId: string; userId: string; row: AvatarRow | undefined; onSaved: () => void }) {
  const [config, setConfig] = useState<AvatarConfig>({ ...DEFAULT_AVATAR, ...(row?.config ?? {}) });
  const [name, setName] = useState(row?.display_name ?? '');
  const [walking, setWalking] = useState(true);
  const [consent, setConsent] = useState(false);
  const [refUrl, setRefUrl] = useState<string | null>(null);
  const [refPath, setRefPath] = useState<string | null>(row?.reference_photo_path ?? null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const patch = (p: Partial<AvatarConfig>) => setConfig((c) => ({ ...c, ...p }));

  useEffect(() => {
    let alive = true;
    if (refPath) signedUrl(refPath).then((u) => { if (alive) setRefUrl(u); }); else setRefUrl(null);
    return () => { alive = false; };
  }, [refPath]);

  const guard = async (fn: () => Promise<void>, done: string) => {
    setBusy(true); setStatus('');
    try { await fn(); setStatus(done); onSaved(); } catch (e) { setStatus(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <div className="card flex flex-col p-0">
        <div className="h-[26rem] bg-[radial-gradient(ellipse_at_50%_30%,#4A3525,#17130F_75%)]"><AvatarPreview config={config} walking={walking} /></div>
        <button type="button" className="border-t border-gold/20 py-3 text-[10px] uppercase tracking-[0.2em] text-gold hover:bg-gold/10" onClick={() => setWalking((w) => !w)}>
          {walking ? 'Show idle pose' : 'Show walking'}
        </button>
      </div>

      <div className="space-y-6">
        <div className="card space-y-5">
          <div><label className="field-label" htmlFor="av-name">Name shown above your character</label>
            <input id="av-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
          <Swatches label="Skin tone" value={config.skin} options={SKIN} onChange={(v) => patch({ skin: v })} />
          <Choice label="Hair" value={config.hairStyle} onChange={(v) => patch({ hairStyle: v })}
            options={[['short', 'Short'], ['long', 'Long'], ['bun', 'Bun'], ['covered', 'Head covering'], ['none', 'None']]} />
          {config.hairStyle !== 'none' && config.hairStyle !== 'covered' && <Swatches label="Hair colour" value={config.hair} options={HAIR} onChange={(v) => patch({ hair: v })} />}
          <Choice label="Outfit" value={config.outfit} onChange={(v) => patch({ outfit: v })} options={[['suit', 'Suit'], ['dress', 'Gown'], ['coat', 'Long coat']]} />
          <Swatches label="Outfit colour" value={config.outfitColor} options={CLOTH} onChange={(v) => patch({ outfitColor: v })} />
          <Swatches label={config.hairStyle === 'covered' ? 'Accent and head covering' : 'Accent'} value={config.accentColor} options={['#C6A36B', '#F3EBDD', '#7A2E3A', '#2B3A67', '#17130F', '#D8C9B5']} onChange={(v) => patch({ accentColor: v })} />
          <div>
            <label className="field-label" htmlFor="av-height">Height</label>
            <input id="av-height" type="range" min={0.9} max={1.1} step={0.01} value={config.height} onChange={(e) => patch({ height: Number(e.target.value) })} className="w-full accent-[#C6A36B]" />
          </div>
          <button className="btn-gold" disabled={busy} onClick={() => guard(() => saveAvatar(museumId, userId, name.trim(), config), 'Avatar saved.')}>Save avatar</button>
          {status && <p role="status" className="text-sm text-gold">{status}</p>}
        </div>

        <div className="card space-y-4">
          <h3 className="font-serif text-2xl">Reference photograph</h3>
          <p className="text-sm leading-relaxed text-beige">
            Optionally keep a photograph of yourself beside the customiser so you can match your character to it by eye. It is stored privately,
            is shown only to you and your partner, and can be removed at any time. Automatic likeness generation is not part of this prototype.
          </p>
          {refUrl ? (
            <div className="flex items-end gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={refUrl} alt="Your reference" className="h-40 w-32 border border-gold/40 object-cover" />
              <button className="btn-danger" disabled={busy} onClick={() => guard(async () => { await setAvatarReference(museumId, userId, refPath, null); setRefPath(null); }, 'Reference photograph deleted.')}>Delete photograph</button>
            </div>
          ) : (
            <>
              <label className="flex items-start gap-3 text-xs leading-relaxed text-beige">
                <input type="checkbox" className="mt-0.5 accent-[#C6A36B]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>This is a photograph of me, and I consent to it being stored and used to personalise my character in this museum.</span>
              </label>
              <label className={`btn-small inline-block cursor-pointer ${!consent || busy || !row ? 'pointer-events-none opacity-40' : ''}`}>
                Upload reference photograph
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={!consent || busy}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void guard(async () => { setRefPath(await setAvatarReference(museumId, userId, refPath, f)); }, 'Reference photograph stored.'); }} />
              </label>
              {!row && <p className="text-xs text-beige/70">Save your avatar once before adding a reference photograph.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
