import Stripe from 'stripe';

export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw Object.assign(new Error('Stripe is not configured'), { statusCode: 503 });
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

