'use client';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { PlacedMemory } from '@/lib/palace/layout';
import { Label } from './Label';
import { GOLD } from './materials';

interface Props {
  placed: PlacedMemory;
  /** Textures are only requested once the visitor is in or next to the room. */
  active: boolean;
  highlighted: boolean;
  onOpen: () => void;
}

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** A golden frame that hangs whatever photograph the database assigns to its slot. */
export function PhotoFrame({ placed, active, highlighted, onOpen }: Props) {
  const { memory, slot } = placed;
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(memory.width > 0 && memory.height > 0 ? memory.width / memory.height : 4 / 3);
  const [hover, setHover] = useState(false);
  const [wanted, setWanted] = useState(false);

  useEffect(() => { if (active) setWanted(true); }, [active]);

  useEffect(() => {
    if (!wanted || !memory.imageUrl) return;
    let disposed = false;
    let loaded: THREE.Texture | null = null;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      memory.imageUrl,
      (tex) => {
        if (disposed) { tex.dispose(); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        loaded = tex;
        const img = tex.image as { width: number; height: number };
        if (img?.width && img?.height) setAspect(img.width / img.height);
        setTexture(tex);
      },
      undefined,
      () => { /* keep the empty frame; the viewer explains the missing image */ },
    );
    return () => { disposed = true; loaded?.dispose(); setTexture(null); };
  }, [wanted, memory.imageUrl]);

  // Fit portrait and landscape images inside the slot without cropping.
  const [w, h] = useMemo(() => {
    let width = slot.maxW;
    let height = width / aspect;
    if (height > slot.maxH) { height = slot.maxH; width = height * aspect; }
    return [width, height];
  }, [aspect, slot.maxW, slot.maxH]);

  useEffect(() => {
    document.body.style.cursor = hover ? 'pointer' : '';
    return () => { document.body.style.cursor = ''; };
  }, [hover]);

  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // that was a camera drag, not a click
    e.stopPropagation();
    onOpen();
  };

  const glow = hover || highlighted;
  const date = formatDate(memory.date);

  return (
    <group position={slot.position} rotation={[0, slot.rotationY, 0]}>
      <group
        onClick={click}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
        {/* outer moulding */}
        <mesh position={[0, 0, 0.04]} castShadow>
          <boxGeometry args={[w + 0.34, h + 0.34, 0.08]} />
          <meshStandardMaterial color="#C6A36B" metalness={1} roughness={0.3} emissive="#C6A36B" emissiveIntensity={glow ? 0.35 : 0} />
        </mesh>
        <mesh position={[0, 0, 0.075]} material={GOLD}>
          <boxGeometry args={[w + 0.2, h + 0.2, 0.05]} />
        </mesh>
        {/* dark slip */}
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry args={[w + 0.06, h + 0.06, 0.012]} />
          <meshStandardMaterial color="#2a1d13" roughness={0.6} />
        </mesh>
        {/* corner rosettes */}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
          <mesh key={`${sx}${sy}`} position={[(sx * (w + 0.27)) / 2, (sy * (h + 0.27)) / 2, 0.09]} material={GOLD}>
            <sphereGeometry args={[0.05, 10, 10]} />
          </mesh>
        ))}
        {/* the photograph */}
        <mesh position={[0, 0, 0.108]}>
          <planeGeometry args={[w, h]} />
          {texture ? (
            <meshBasicMaterial map={texture} color="#efe9e0" toneMapped={false} />
          ) : (
            <meshStandardMaterial color={memory.kind === 'video' ? '#17130F' : '#cbbfae'} roughness={0.9} />
          )}
        </mesh>
        {memory.kind === 'video' && (
          <Label lines={[{ text: '▶', size: 220, color: '#C6A36B', font: 'sans' }, { text: 'VIDEO MEMORY', size: 44, font: 'sans', spacing: 0.3, color: '#D8C9B5' }]} width={w * 0.6} position={[0, 0, 0.115]} />
        )}
      </group>

      {/* brass plaque */}
      {(memory.title || date) && (
        <group position={[0, -h / 2 - 0.42, 0.03]}>
          <mesh>
            <boxGeometry args={[1.08, 0.3, 0.02]} />
            <meshStandardMaterial color="#D9BC84" metalness={0.35} roughness={0.5} />
          </mesh>
          <Label
            lines={[
              { text: memory.title, size: 76, color: '#2a1d13', weight: 600 },
              { text: date.toUpperCase(), size: 34, color: '#4A3525', font: 'sans', spacing: 0.18, gap: 6 },
            ]}
            width={1}
            position={[0, 0, 0.012]}
          />
        </group>
      )}
    </group>
  );
}
