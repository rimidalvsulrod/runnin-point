import { requireAdmin } from '../_lib/auth.js';
import { json, method } from '../_lib/response.js';

export default async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    const user = await requireAdmin(req);
    return json(res, 200, { authenticated: true, username: user.username, role: user.role });
  } catch {
    return json(res, 401, { authenticated: false });
  }
}

