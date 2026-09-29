import { z } from 'zod';
import { requireAdmin } from './_lib/auth.js';
import { db, ensureSchema } from './_lib/db.js';
import { fail, json, method } from './_lib/response.js';

const productInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).default(''),
  price_cents: z.number().int().min(0).max(100000000),
  image_url: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  category: z.string().trim().min(1).max(50).default('Art'),
  variants: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  inventory: z.number().int().min(0).max(1000000).default(0),
  active: z.boolean().default(true),
  featured: z.boolean().default(false)
});

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  try {
    await ensureSchema();
    const sql = db();
    if (req.method === 'GET') {
      const isAdmin = req.query?.admin === '1';
      if (isAdmin) await requireAdmin(req);
      const rows = isAdmin
        ? await sql`SELECT * FROM products ORDER BY featured DESC, created_at DESC`
        : await sql`SELECT * FROM products WHERE active = true AND inventory > 0 ORDER BY featured DESC, created_at DESC`;
      return json(res, 200, { products: rows });
    }

    await requireAdmin(req);
    if (req.method === 'POST') {
      const p = productInput.parse(req.body);
      const category = await sql`SELECT id FROM product_categories WHERE lower(name) = lower(${p.category}) LIMIT 1`;
      if (!category.length) return json(res, 400, { error: 'Select a valid category.' });
      const [created] = await sql`
        INSERT INTO products (name, description, price_cents, image_url, category, variants, inventory, active, featured)
        VALUES (${p.name}, ${p.description}, ${p.price_cents}, ${p.image_url || null}, ${p.category}, ${JSON.stringify(p.variants)}::jsonb, ${p.inventory}, ${p.active}, ${p.featured})
        RETURNING *`;
      return json(res, 201, { product: created });
    }

    const id = z.string().uuid().parse(req.query?.id);
    if (req.method === 'DELETE') {
      const rows = await sql`DELETE FROM products WHERE id = ${id} RETURNING id`;
      return rows.length ? json(res, 200, { ok: true }) : json(res, 404, { error: 'Product not found.' });
    }

    const p = productInput.parse(req.body);
    const category = await sql`SELECT id FROM product_categories WHERE lower(name) = lower(${p.category}) LIMIT 1`;
    if (!category.length) return json(res, 400, { error: 'Select a valid category.' });
    const [updated] = await sql`
      UPDATE products SET name=${p.name}, description=${p.description}, price_cents=${p.price_cents},
        image_url=${p.image_url || null}, category=${p.category}, variants=${JSON.stringify(p.variants)}::jsonb,
        inventory=${p.inventory}, active=${p.active}, featured=${p.featured}, updated_at=now()
      WHERE id=${id} RETURNING *`;
    return updated ? json(res, 200, { product: updated }) : json(res, 404, { error: 'Product not found.' });
  } catch (error) {
    return fail(res, error);
  }
}

