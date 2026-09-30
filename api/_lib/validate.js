import { z } from 'zod';

// Only allow web URLs so a stored value can never be a javascript:/data: link.
export const httpUrl = z.string().url().max(2048).refine(value => /^https?:\/\//i.test(value), 'Use an http(s) URL.');
export const optionalHttpUrl = z.union([httpUrl, z.literal(''), z.null()]).optional();

// Identify an image by its magic bytes instead of trusting the Content-Type header.
export function sniffImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('latin1'))) return 'image/gif';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
