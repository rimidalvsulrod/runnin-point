import { z } from 'zod';
import { db, ensureSchema } from './_lib/db.js';
import { fail, getOrigin, json, method } from './_lib/response.js';
import { clientIp } from './_lib/throttle.js';
import { stripe } from './_lib/stripe.js';

const input = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
    variant: z.string().trim().max(60).optional().default('')
  })).min(1).max(30)
});

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    await ensureSchema();
    const cart = input.parse(req.body);
    const sql = db();
    // Each attempt inserts a pending order, so cap how many one client can create.
    const [{ recent }] = await sql`SELECT count(*)::int AS recent FROM checkout_attempts WHERE ip=${clientIp(req)} AND created_at > now() - interval '10 minutes'`;
    if (recent >= 20) return json(res, 429, { error: 'Too many checkout attempts. Please try again shortly.' });
    await sql`INSERT INTO checkout_attempts (ip) VALUES (${clientIp(req)})`;
    await sql`DELETE FROM checkout_attempts WHERE created_at < now() - interval '1 day'`;
    const [settings] = await sql`SELECT * FROM store_settings WHERE id=1`;
    if (!settings.stripe_account_id || !settings.stripe_charges_enabled) return json(res, 503, { error: 'Checkout is not open yet.' });

    const ids = cart.items.map(item => item.product_id);
    const products = await sql`SELECT * FROM products WHERE id = ANY(${ids}::uuid[]) AND active=true`;
    const productMap = new Map(products.map(product => [product.id, product]));
    // Merge repeated product+option lines so the inventory check sees the real total per product.
    const merged = new Map();
    for (const item of cart.items) {
      const key = `${item.product_id}|${item.variant}`;
      const existing = merged.get(key);
      if (existing) existing.quantity += item.quantity;
      else merged.set(key, { ...item });
    }
    const requested = new Map();
    let subtotal = 0;
    const normalized = [...merged.values()].map(item => {
      const product = productMap.get(item.product_id);
      if (!product) throw Object.assign(new Error('A product is no longer available'), { statusCode: 409 });
      const total = (requested.get(product.id) || 0) + item.quantity;
      requested.set(product.id, total);
      if (product.inventory < total) throw Object.assign(new Error(`Not enough inventory for ${product.name}`), { statusCode: 409 });
      if (product.variants.length ? !product.variants.includes(item.variant) : item.variant) throw Object.assign(new Error(`Choose a valid option for ${product.name}`), { statusCode: 400 });
      subtotal += product.price_cents * item.quantity;
      return { ...item, product };
    });
    if (subtotal <= 0) throw Object.assign(new Error('Your cart total must be more than $0.'), { statusCode: 400 });

    const shipping = settings.shipping_cents;
    const [order] = await sql`
      INSERT INTO orders (stripe_account_id, amount_subtotal, amount_shipping, amount_total, currency)
      VALUES (${settings.stripe_account_id}, ${subtotal}, ${shipping}, ${subtotal + shipping}, ${settings.currency}) RETURNING *`;
    for (const item of normalized) {
      await sql`INSERT INTO order_items (order_id, product_id, product_name, variant, quantity, unit_amount, image_url)
        VALUES (${order.id}, ${item.product.id}, ${item.product.name}, ${item.variant || null}, ${item.quantity}, ${item.product.price_cents}, ${item.product.image_url})`;
    }

    const lineItems = normalized.map(({ product, quantity, variant }) => ({
      quantity,
      price_data: {
        currency: settings.currency,
        unit_amount: product.price_cents,
        product_data: { name: variant ? `${product.name} — ${variant}` : product.name, images: product.image_url ? [product.image_url] : [], metadata: { product_id: product.id } }
      }
    }));
    if (shipping) lineItems.push({ quantity: 1, price_data: { currency: settings.currency, unit_amount: shipping, product_data: { name: 'Shipping' } } });

    const origin = getOrigin(req);
    let session;
    try {
      session = await stripe().checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${origin}/shop?checkout=success&order=${order.id}`,
      cancel_url: `${origin}/shop?checkout=cancelled`,
      customer_creation: 'always',
      billing_address_collection: 'auto',
      shipping_address_collection: { allowed_countries: ['US'] },
      phone_number_collection: { enabled: true },
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id } }
    }, { stripeAccount: settings.stripe_account_id });
    } catch (error) {
      await sql`UPDATE orders SET payment_status='failed', updated_at=now() WHERE id=${order.id}`;
      throw error;
    }
    await sql`UPDATE orders SET stripe_checkout_session_id=${session.id}, updated_at=now() WHERE id=${order.id}`;
    return json(res, 200, { url: session.url });
  } catch (error) {
    return fail(res, error);
  }
}

