import * as THREE from 'three';

/**
 * Procedural textures drawn once on a canvas. They stand in for baked Blender
 * materials so the prototype ships with zero binary assets; swap them for
 * compressed KTX2 maps when the modelled palace arrives.
 */
const cache = new Map<string, THREE.CanvasTexture>();

function make(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, srgb = true) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

// Deterministic pseudo-random so the marble looks the same on both partners' devices.
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function marbleTexture() {
  return make('marble', 1024, (ctx, s) => {
    const r = rng(7);
    const half = s / 2;
    const tiles = ['#F3EBDD', '#E9DDC9'];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      ctx.fillStyle = tiles[(i + j) % 2];
      ctx.fillRect(i * half, j * half, half, half);
    }
    // veins
    for (let v = 0; v < 46; v++) {
      ctx.beginPath();
      let x = r() * s, y = r() * s;
      ctx.moveTo(x, y);
      const steps = 5 + Math.floor(r() * 6);
      for (let k = 0; k < steps; k++) {
        x += (r() - 0.5) * 220; y += (r() - 0.3) * 160;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${150 + r() * 40},${125 + r() * 30},${95 + r() * 30},${0.05 + r() * 0.1})`;
      ctx.lineWidth = 0.6 + r() * 2.4;
      ctx.stroke();
    }
    // soft clouds
    for (let c = 0; c < 26; c++) {
      const x = r() * s, y = r() * s, rad = 60 + r() * 160;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(255,250,240,${0.1 + r() * 0.12})`);
      g.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // bronze inlay between tiles and gold cabochons at the crossings
    ctx.strokeStyle = 'rgba(120,88,52,0.55)';
    ctx.lineWidth = 5;
    for (const p of [0, half, s]) {
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke();
    }
    ctx.fillStyle = '#B08A52';
    for (const x of [0, half, s]) for (const y of [0, half, s]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-26, -26, 52, 52); ctx.restore();
    }
  });
}

/** White panelled wall; multiplied by each room's wall colour. */
export function panelTexture() {
  return make('panel', 512, (ctx, s) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    const line = (x: number, y: number, w: number, h: number) => {
      ctx.strokeStyle = 'rgba(40,25,10,0.22)'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(40,25,10,0.08)'; ctx.lineWidth = 9; ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
    };
    // canvas y grows downward: wainscot at the bottom, tall panel above
    line(34, 60, s - 68, s * 0.62);
    line(34, s * 0.78, s - 68, s * 0.17);
    ctx.fillStyle = 'rgba(40,25,10,0.16)';
    ctx.fillRect(0, s * 0.74, s, 5);
  });
}

export function ceilingTexture() {
  return make('ceiling', 512, (ctx, s) => {
    ctx.fillStyle = '#F6EFE2';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#C6A36B'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, s - 10, s - 10);
    ctx.strokeStyle = 'rgba(74,53,37,0.25)'; ctx.lineWidth = 4; ctx.strokeRect(46, 46, s - 92, s - 92);
    const g = ctx.createRadialGradient(s / 2, s / 2, 10, s / 2, s / 2, s * 0.36);
    g.addColorStop(0, 'rgba(198,163,107,0.55)'); g.addColorStop(1, 'rgba(198,163,107,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = 'rgba(160,125,70,0.8)'; ctx.lineWidth = 3;
    for (let p = 0; p < 12; p++) {
      const a = (p / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(s / 2 + Math.cos(a) * 46, s / 2 + Math.sin(a) * 46, 44, 16, a, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
}

export interface LabelLine {
  text: string;
  size?: number;
  color?: string;
  font?: 'serif' | 'sans';
  weight?: number;
  italic?: boolean;
  spacing?: number;
  gap?: number;
}

const FONTS = { serif: '"Cormorant Garamond", Georgia, serif', sans: 'Inter, system-ui, sans-serif' };

/** Draws text lines onto a canvas. Any script the device can render works here. */
export function drawLabel(lines: LabelLine[], background?: string): { canvas: HTMLCanvasElement; aspect: number } {
  const W = 1024;
  const pad = 28;
  const measure = document.createElement('canvas').getContext('2d')!;
  const laid = lines.filter((l) => l.text).map((l) => {
    let size = l.size ?? 64;
    const font = (sz: number) => `${l.italic ? 'italic ' : ''}${l.weight ?? 500} ${sz}px ${FONTS[l.font ?? 'serif']}`;
    const spacing = l.spacing ?? 0;
    const width = (sz: number) => { measure.font = font(sz); return measure.measureText(l.text).width + spacing * sz * l.text.length; };
    while (size > 14 && width(size) > W - pad * 2) size -= 2;
    return { ...l, size, fontStr: font(size), spacingPx: spacing * size };
  });
  const H = Math.max(32, Math.ceil(laid.reduce((h, l) => h + l.size * 1.25 + (l.gap ?? 0), pad * 2)));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, W, H); }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = pad;
  for (const l of laid) {
    y += l.gap ?? 0;
    ctx.font = l.fontStr;
    ctx.fillStyle = l.color ?? '#C6A36B';
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${l.spacingPx}px`;
    ctx.fillText(l.text, W / 2 + l.spacingPx / 2, y + l.size * 0.62);
    y += l.size * 1.25;
  }
  return { canvas, aspect: W / H };
}
