import { db, ensureSchema } from './db.js';

export async function audit(username, action, details = {}) {
  try {
    await ensureSchema();
    const sql = db();
    await sql`INSERT INTO activity_logs (username, action, details) VALUES (${username || null}, ${action}, ${JSON.stringify(details)}::jsonb)`;
  } catch (error) {
    console.error('Audit log failed', error);
  }
}
