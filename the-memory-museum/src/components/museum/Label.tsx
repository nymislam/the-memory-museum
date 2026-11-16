'use client';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { drawLabel, type LabelLine } from './textures';

interface Props {
  lines: LabelLine[];
  /** World width in metres. Height follows the text. */
  width: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  background?: string;
  /** Unlit labels stay readable in dark rooms. */
  emissive?: boolean;
}

/** Text rendered to a canvas texture: names, plaques and wayfinding signs. */
export function Label({ lines, width, position, rotation, background, emissive = true }: Props) {
  const key = JSON.stringify(lines) + (background ?? '');
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    let alive = true;
    // Redraw once the web fonts have loaded, otherwise the canvas uses a fallback face.
    Promise.all([
      document.fonts.load('500 64px "Cormorant Garamond"'),
      document.fonts.load('italic 500 64px "Cormorant Garamond"'),
      document.fonts.load('500 32px Inter'),
    ]).finally(() => { if (alive) setFontsReady(true); });
    return () => { alive = false; };
  }, []);

  const { texture, aspect } = useMemo(() => {
    const { canvas, aspect } = drawLabel(lines, background);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return { texture, aspect };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fontsReady]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, width / aspect]} />
      {emissive ? (
        <meshBasicMaterial map={texture} transparent={!background} toneMapped={false} depthWrite={Boolean(background)} />
      ) : (
        <meshStandardMaterial map={texture} transparent={!background} roughness={0.6} />
      )}
    </mesh>
  );
}
