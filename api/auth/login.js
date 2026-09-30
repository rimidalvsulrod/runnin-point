import { z } from 'zod';
import { createSession, verifyCredentials } from '../_lib/auth.js';
import { fail, json, method } from '../_lib/response.js';

const input = z.object({ username: z.string().trim().min(1).max(80), password: z.string().min(1).max(200) });

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    const body = input.parse(req.body);
    const user = await verifyCredentials(body.username, body.password);
    if (!user) return json(res, 401, { error: 'Incorrect username or password.' });
    await createSession(res, user);
    return json(res, 200, { ok: true, user });
  } catch (error) {
    return fail(res, error);
  }
}

