import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';

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
  const expectedUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!expectedUsername || !hash) throw Object.assign(new Error('Admin credentials are not configured'), { statusCode: 503 });
  return username.trim().toLowerCase() === expectedUsername && await bcrypt.compare(password, hash);
}

export async function createSession(res, username) {
  const token = await new SignJWT({ username, role: 'admin' })
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
    if (payload.role !== 'admin') throw new Error('Invalid role');
    return payload;
  } catch {
    throw Object.assign(new Error('Unauthorized'), { statusCode: 401 });
  }
}

