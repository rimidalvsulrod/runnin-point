import { z } from 'zod';
import { requireAdmin } from './_lib/auth.js';
import { db, ensureSchema } from './_lib/db.js';
import { fail, json, method } from './_lib/response.js';

const input = z.object({
  store_name: z.string().trim().min(2).max(100),
  store_description: z.string().trim().max(500),
  shipping_cents: z.number().int().min(0).max(100000)
});

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PATCH'])) return;
  try {
    await ensureSchema();
    const sql = db();
    if (req.method === 'PATCH') {
      await requireAdmin(req);
      const s = input.parse(req.body);
      await sql`UPDATE store_settings SET store_name=${s.store_name}, store_description=${s.store_description}, shipping_cents=${s.shipping_cents}, updated_at=now() WHERE id=1`;
    }
    const [settings] = await sql`SELECT store_name, store_description, currency, shipping_cents, stripe_details_submitted, stripe_charges_enabled FROM store_settings WHERE id=1`;
    return json(res, 200, { settings });
  } catch (error) {
    return fail(res, error);
  }
}

