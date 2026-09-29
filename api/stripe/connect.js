import { requireAdmin } from '../_lib/auth.js';
import { db, ensureSchema } from '../_lib/db.js';
import { fail, getOrigin, json, method } from '../_lib/response.js';
import { stripe } from '../_lib/stripe.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    await requireAdmin(req);
    await ensureSchema();
    const sql = db();
    const [settings] = await sql`SELECT stripe_account_id FROM store_settings WHERE id=1`;
    const client = stripe();
    let accountId = settings.stripe_account_id;
    if (!accountId) {
      const account = await client.accounts.create({
        type: 'express',
        country: 'US',
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        business_profile: { product_description: "Original art and merchandise from Runnin' Point" },
        metadata: { app: 'runnin-point' }
      });
      accountId = account.id;
      await sql`UPDATE store_settings SET stripe_account_id=${accountId}, updated_at=now() WHERE id=1`;
    }
    const origin = getOrigin(req);
    const link = await client.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/admin?stripe=refresh`,
      return_url: `${origin}/admin?stripe=return`,
      type: 'account_onboarding'
    });
    return json(res, 200, { url: link.url });
  } catch (error) {
    return fail(res, error);
  }
}

