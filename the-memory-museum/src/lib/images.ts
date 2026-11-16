import { IMAGE_TYPES, MAX_IMAGE_BYTES } from './validation';

export interface PreparedImage { blob: Blob; width: number; height: number; mime: string }

/**
 * Validates a photograph and re-encodes it in the browser before upload:
 * longest side capped at 2048 px, WebP at high quality. That keeps GPU texture
 * memory predictable in the 3D scene and strips EXIF metadata (including GPS).
 */
export async function prepareImage(file: File, maxSide = 2048): Promise<PreparedImage> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Please choose a JPEG, PNG or WebP photograph.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('That photograph is larger than 15 MB.');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the photograph on this device.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.86));
  if (!blob) throw new Error('Could not process the photograph on this device.');
  // Safari may fall back to PNG when WebP encoding is unavailable.
  return { blob, width, height, mime: blob.type || 'image/webp' };
}
