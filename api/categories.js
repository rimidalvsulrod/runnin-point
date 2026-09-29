import { z } from 'zod';
import { requireAdmin } from './_lib/auth.js';
import { db, ensureSchema } from './_lib/db.js';
import { fail, json, method } from './_lib/response.js';

const categoryInput = z.object({ name: z.string().trim().min(1).max(50) });

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'DELETE'])) return;
  try {
    await requireAdmin(req);
    await ensureSchema();
    const sql = db();

    if (req.method === 'GET') {
      const categories = await sql`SELECT id, name FROM product_categories ORDER BY lower(name)`;
      return json(res, 200, { categories });
    }

    if (req.method === 'POST') {
      const { name } = categoryInput.parse(req.body);
      const existing = await sql`SELECT id FROM product_categories WHERE lower(name) = lower(${name}) LIMIT 1`;
      if (existing.length) return json(res, 409, { error: 'That category already exists.' });
      const [category] = await sql`INSERT INTO product_categories (name) VALUES (${name}) RETURNING id, name`;
      return json(res, 201, { category });
    }

    const id = z.string().uuid().parse(req.query?.id);
    const [category] = await sql`SELECT name FROM product_categories WHERE id = ${id}`;
    if (!category) return json(res, 404, { error: 'Category not found.' });
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM products WHERE lower(category) = lower(${category.name})`;
    if (count > 0) return json(res, 409, { error: 'Move or delete products in this category first.' });
    await sql`DELETE FROM product_categories WHERE id = ${id}`;
    return json(res, 200, { ok: true });
  } catch (error) {
    return fail(res, error);
  }
}
