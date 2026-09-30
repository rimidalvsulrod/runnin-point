import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { db, ensureSchema } from './db.js';

const COOKIE = 'rp_admin';

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw Object.assign(new Error('SESSION_SECRET is not configured'), { statusCode: 503 });
  return new TextEncoder().encode(value);
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=').map(decodeURIComponent)).filter(v => v.length === 2));
}

export async function verifyCredentials(username, password) {
  await ensureSchema();
  const sql = db();
  const [user] = await sql`SELECT username, password_hash, role FROM admin_users WHERE lower(username)=lower(${username.trim()}) AND active=true LIMIT 1`;
  if (!user || !await bcrypt.compare(password, user.password_hash)) return null;
  return { username: user.username, role: user.role };
}

export async function createSession(res, user) {
  const token = await new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(secret());
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`);
}

export async function requireAdmin(req) {
  try {
    const token = cookies(req)[COOKIE];
    if (!token) throw new Error('Missing session');
    const { payload } = await jwtVerify(token, secret());
    if (!['admin', 'developer'].includes(payload.role)) throw new Error('Invalid role');
    return payload;
  } catch {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
}

export async function requireDeveloper(req) {
  const user = await requireAdmin(req);
  if (user.role !== 'developer') throw Object.assign(new Error('Developer access required'), { statusCode: 403 });
  return user;
}

export async function createOAuthState(user) {
  return new SignJWT({ username: user.username, purpose: 'google-drive' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(secret());
}

export async function verifyOAuthState(token) {
  const { payload } = await jwtVerify(token, secret());
  if (payload.purpose !== 'google-drive') throw new Error('Invalid OAuth state');
  return payload;
}

