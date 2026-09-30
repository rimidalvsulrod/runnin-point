import { neon } from '@neondatabase/serverless';

let schemaReady;

export function db() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw Object.assign(new Error('DATABASE_URL is not configured'), { statusCode: 503 });
  return neon(url);
}

export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const sql = db();
    await sql`
      CREATE TABLE IF NOT EXISTS admin_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username text NOT NULL UNIQUE,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'developer')),
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH) await sql`
      INSERT INTO admin_users (username, password_hash, role)
      VALUES (${process.env.ADMIN_USERNAME.trim().toLowerCase()}, ${process.env.ADMIN_PASSWORD_HASH}, 'admin')
      ON CONFLICT (username) DO NOTHING`;
    if (process.env.DEVELOPER_USERNAME && process.env.DEVELOPER_PASSWORD_HASH) await sql`
      INSERT INTO admin_users (username, password_hash, role)
      VALUES (${process.env.DEVELOPER_USERNAME.trim().toLowerCase()}, ${process.env.DEVELOPER_PASSWORD_HASH}, 'developer')
      ON CONFLICT (username) DO UPDATE SET role = 'developer'`;
    await sql`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id bigserial PRIMARY KEY,
        username text,
        action text NOT NULL,
        details jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS integration_settings (
        id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        google_client_id text,
        google_client_secret text,
        google_refresh_token text,
        google_folder_id text,
        google_email text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`INSERT INTO integration_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
    await sql`
      CREATE TABLE IF NOT EXISTS video_projects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title text NOT NULL,
        notes text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'waiting_for_upload' CHECK (status IN ('waiting_for_upload','uploaded','editing','review','complete')),
        original_file_id text,
        original_name text,
        original_size bigint,
        final_file_id text,
        final_name text,
        final_size bigint,
        created_by text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS store_settings (
        id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        store_name text NOT NULL DEFAULT 'Runnin'' Point Shop',
        store_description text NOT NULL DEFAULT 'Original art and limited-run merch from the Runnin'' Point crew.',
        currency text NOT NULL DEFAULT 'usd',
        shipping_cents integer NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
        stripe_account_id text,
        stripe_details_submitted boolean NOT NULL DEFAULT false,
        stripe_charges_enabled boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`INSERT INTO store_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
    await sql`
      CREATE TABLE IF NOT EXISTS product_categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`
      INSERT INTO product_categories (name) VALUES ('Art'), ('Original Art'), ('Prints'), ('Merch')
      ON CONFLICT (name) DO NOTHING`;
    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        price_cents integer NOT NULL CHECK (price_cents >= 0),
        image_url text,
        category text NOT NULL DEFAULT 'Art',
        variants jsonb NOT NULL DEFAULT '[]'::jsonb,
        inventory integer NOT NULL DEFAULT 0 CHECK (inventory >= 0),
        active boolean NOT NULL DEFAULT true,
        featured boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`
      INSERT INTO product_categories (name)
      SELECT DISTINCT p.category FROM products p
      WHERE p.category <> '' AND NOT EXISTS (
        SELECT 1 FROM product_categories c WHERE lower(c.name) = lower(p.category)
      )`;
    await sql`
      UPDATE products p SET category = c.name
      FROM product_categories c
      WHERE c.name IN ('Art', 'Original Art', 'Prints', 'Merch')
        AND lower(p.category) = lower(c.name) AND p.category <> c.name`;
    await sql`
      DELETE FROM product_categories
      WHERE name NOT IN ('Art', 'Original Art', 'Prints', 'Merch')
        AND lower(name) IN ('art', 'original art', 'prints', 'merch')`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS product_categories_name_lower_idx ON product_categories(lower(name))`;
    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        stripe_checkout_session_id text UNIQUE,
        stripe_payment_intent_id text,
        stripe_account_id text,
        customer_email text,
        customer_name text,
        shipping_address jsonb,
        amount_subtotal integer NOT NULL DEFAULT 0,
        amount_shipping integer NOT NULL DEFAULT 0,
        amount_total integer NOT NULL DEFAULT 0,
        currency text NOT NULL DEFAULT 'usd',
        payment_status text NOT NULL DEFAULT 'pending',
        fulfillment_status text NOT NULL DEFAULT 'unfulfilled',
        tracking_number text,
        tracking_url text,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    await sql`
      CREATE TABLE IF NOT EXISTS order_items (
        id bigserial PRIMARY KEY,
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id uuid REFERENCES products(id) ON DELETE SET NULL,
        product_name text NOT NULL,
        variant text,
        quantity integer NOT NULL CHECK (quantity > 0),
        unit_amount integer NOT NULL CHECK (unit_amount >= 0),
        image_url text
      )`;
    await sql`CREATE INDEX IF NOT EXISTS products_active_idx ON products(active, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC)`;
  })().catch(error => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

