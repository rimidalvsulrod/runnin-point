import { z } from 'zod';
import { requireAdmin } from './_lib/auth.js';
import { db, ensureSchema } from './_lib/db.js';
import { fail, json, method } from './_lib/response.js';
import { optionalHttpUrl } from './_lib/validate.js';

const update = z.object({
  fulfillment_status: z.enum(['unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled']),
  tracking_number: z.string().trim().max(120).nullable().optional(),
  tracking_url: optionalHttpUrl,
  notes: z.string().trim().max(2000).nullable().optional()
});

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PATCH'])) return;
  try {
    await requireAdmin(req);
    await ensureSchema();
    const sql = db();
    if (req.method === 'PATCH') {
      const id = z.string().uuid().parse(req.query?.id);
      const body = update.parse(req.body);
      await sql`UPDATE orders SET fulfillment_status=${body.fulfillment_status}, tracking_number=${body.tracking_number || null}, tracking_url=${body.tracking_url || null}, notes=${body.notes || null}, updated_at=now() WHERE id=${id}`;
    }
    const orders = await sql`
      SELECT o.*, COALESCE(json_agg(json_build_object('product_name', i.product_name, 'variant', i.variant, 'quantity', i.quantity, 'unit_amount', i.unit_amount, 'image_url', i.image_url) ORDER BY i.id) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
      FROM orders o LEFT JOIN order_items i ON i.order_id=o.id
      WHERE ${req.query?.all === '1'} OR o.payment_status IN ('paid', 'refunded', 'partially_refunded')
      GROUP BY o.id ORDER BY o.created_at DESC LIMIT 250`;
    return json(res, 200, { orders });
  } catch (error) {
    return fail(res, error);
  }
}

