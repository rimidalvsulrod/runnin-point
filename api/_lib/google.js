import { decrypt } from './crypto.js';
import { db, ensureSchema } from './db.js';

export async function googleSettings() {
  await ensureSchema();
  const sql = db();
  const [row] = await sql`SELECT * FROM integration_settings WHERE id=1`;
  return {
    clientId: decrypt(row.google_client_id),
    clientSecret: decrypt(row.google_client_secret),
    refreshToken: decrypt(row.google_refresh_token),
    folderId: row.google_folder_id,
    email: row.google_email
  };
}

export async function accessToken() {
  const settings = await googleSettings();
  if (!settings.clientId || !settings.clientSecret || !settings.refreshToken) throw Object.assign(new Error('Google Drive is not connected'), { statusCode: 503 });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret, refresh_token: settings.refreshToken, grant_type: 'refresh_token' })
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error_description || 'Google authorization needs to be reconnected'), { statusCode: 503 });
  return { token: data.access_token, ...settings };
}

export async function driveFetch(path, options = {}) {
  const { token } = await accessToken();
  return fetch(`https://www.googleapis.com${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
}
