import { db, ensureSchema } from './db.js';

const WINDOW_MINUTES = 15;
const MAX_FAILURES = 10;

export function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}

function keys(req, username) {
  return [`ip:${clientIp(req)}`, `user:${String(username || '').trim().toLowerCase()}`];
}

/** True when this IP or username has too many recent failed logins. */
export async function isLockedOut(req, username) {
  await ensureSchema();
  const sql = db();
  const rows = await sql`
    SELECT key, count(*)::int AS count FROM login_attempts
    WHERE key = ANY(${keys(req, username)}::text[]) AND created_at > now() - make_interval(mins => ${WINDOW_MINUTES})
    GROUP BY key`;
  return rows.some(row => row.count >= MAX_FAILURES);
}

export async function recordFailure(req, username) {
  const sql = db();
  for (const key of keys(req, username)) await sql`INSERT INTO login_attempts (key) VALUES (${key})`;
  await sql`DELETE FROM login_attempts WHERE created_at < now() - interval '1 day'`;
}

export async function clearFailures(req, username) {
  const sql = db();
  await sql`DELETE FROM login_attempts WHERE key = ANY(${keys(req, username)}::text[])`;
}
