import { db, ensureSchema } from '../_lib/db.js';
import { json, method } from '../_lib/response.js';
import { stripe } from '../_lib/stripe.js';

export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  let event;
  try {
    event = stripe().webhooks.constructEvent(await rawBody(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return json(res, 400, { error: `Webhook signature failed: ${error.message}` });
  }

  try {
    await ensureSchema();
    const sql = db();
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        await sql`
          UPDATE orders SET stripe_payment_intent_id=${String(session.payment_intent || '')}, customer_email=${session.customer_details?.email || null},
            customer_name=${session.customer_details?.name || null}, shipping_address=${JSON.stringify(session.shipping_details?.address || session.customer_details?.address || null)}::jsonb,
            amount_total=${session.amount_total || 0}, payment_status='paid', updated_at=now()
          WHERE id=${orderId}`;
        const items = await sql`SELECT product_id, quantity FROM order_items WHERE order_id=${orderId}`;
        for (const item of items) if (item.product_id) await sql`UPDATE products SET inventory=GREATEST(0, inventory-${item.quantity}), updated_at=now() WHERE id=${item.product_id}`;
      }
    }
    if (event.type === 'charge.refunded') {
      const charge = event.data.object;
      await sql`UPDATE orders SET payment_status='refunded', updated_at=now() WHERE stripe_payment_intent_id=${String(charge.payment_intent || '')}`;
    }
    if (event.type === 'account.updated') {
      const account = event.data.object;
      await sql`UPDATE store_settings SET stripe_details_submitted=${!!account.details_submitted}, stripe_charges_enabled=${!!account.charges_enabled}, updated_at=now() WHERE stripe_account_id=${account.id}`;
    }
    return json(res, 200, { received: true });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'Webhook processing failed.' });
  }
}

