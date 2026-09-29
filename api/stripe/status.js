import { requireAdmin } from '../_lib/auth.js';
import { db, ensureSchema } from '../_lib/db.js';
import { fail, json, method } from '../_lib/response.js';
import { stripe } from '../_lib/stripe.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    await requireAdmin(req);
    await ensureSchema();
    const sql = db();
    const [settings] = await sql`SELECT stripe_account_id FROM store_settings WHERE id=1`;
    if (!settings.stripe_account_id) return json(res, 200, { connected: false, charges_enabled: false, details_submitted: false });
    const account = await stripe().accounts.retrieve(settings.stripe_account_id);
    await sql`UPDATE store_settings SET stripe_details_submitted=${!!account.details_submitted}, stripe_charges_enabled=${!!account.charges_enabled}, updated_at=now() WHERE id=1`;
    return json(res, 200, {
      connected: true,
      charges_enabled: !!account.charges_enabled,
      details_submitted: !!account.details_submitted,
      email: account.email || null,
      account_id: account.id
    });
  } catch (error) {
    return fail(res, error);
  }
}

