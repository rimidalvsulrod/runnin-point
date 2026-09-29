import { clearSession } from '../_lib/auth.js';
import { json, method } from '../_lib/response.js';

export default function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  clearSession(res);
  return json(res, 200, { ok: true });
}

