import { z } from 'zod';

/** Input validation shared by forms. The database repeats these limits as CHECK constraints. */
export const museumSchema = z.object({
  name: z.string().trim().min(2, 'Give the museum a name').max(80),
  partnerOne: z.string().trim().min(1, 'Your name is required').max(40),
  partnerTwo: z.string().trim().max(40),
});

export const memorySchema = z.object({
  title: z.string().trim().max(80),
  caption: z.string().trim().max(240),
  message: z.string().trim().max(1200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export const roomSchema = z.object({
  title: z.string().trim().min(1).max(60),
  subtitle: z.string().trim().max(80),
  width: z.number().min(8).max(30),
  depth: z.number().min(8).max(60),
  height: z.number().min(4.5).max(12),
  wallColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const credentialsSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters').max(72),
});

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/ogg'];
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Please check the form';
}
