import { put } from '@vercel/blob';
import { requireAdmin } from './_lib/auth.js';
import { fail, json, method } from './_lib/response.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    await requireAdmin(req);
    const type = req.headers['content-type'] || '';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return json(res, 415, { error: 'Upload a JPG, PNG, WebP, or GIF image.' });
    const length = Number(req.headers['content-length'] || 0);
    if (length > 8 * 1024 * 1024) return json(res, 413, { error: 'Images must be smaller than 8 MB.' });
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (!body.length || body.length > 8 * 1024 * 1024) return json(res, 413, { error: 'Invalid image size.' });
    const ext = type.split('/')[1].replace('jpeg', 'jpg');
    const blob = await put(`products/${crypto.randomUUID()}.${ext}`, body, { access: 'public', contentType: type, addRandomSuffix: false });
    return json(res, 201, { url: blob.url });
  } catch (error) {
    return fail(res, error);
  }
}

