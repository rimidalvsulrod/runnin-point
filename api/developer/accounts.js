import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireDeveloper } from '../_lib/auth.js';
import { audit } from '../_lib/audit.js';
import { db, ensureSchema } from '../_lib/db.js';
import { fail, json, method } from '../_lib/response.js';

const input = z.object({ username: z.string().trim().min(2).max(80).regex(/^[a-zA-Z0-9_-]+$/), password: z.string().min(4).max(200), role: z.enum(['admin', 'developer']).default('admin') });

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
  try {
    const actor = await requireDeveloper(req); await ensureSchema(); const sql = db();
    if (req.method === 'GET') return json(res, 200, { accounts: await sql`SELECT id,username,role,active,created_at FROM admin_users ORDER BY created_at` });
    if (req.method === 'POST') {
      const body=input.parse(req.body), hash=await bcrypt.hash(body.password,12);
      const [account]=await sql`INSERT INTO admin_users(username,password_hash,role) VALUES(${body.username.toLowerCase()},${hash},${body.role}) RETURNING id,username,role,active,created_at`;
      await audit(actor.username,'account.created',{username:account.username,role:account.role}); return json(res,201,{account});
    }
    const id=z.string().uuid().parse(req.query?.id);
    if(req.method==='DELETE'){
      const [target]=await sql`SELECT username FROM admin_users WHERE id=${id}`;
      if(!target)return json(res,404,{error:'Account not found.'});
      if(target.username===actor.username)return json(res,400,{error:'You cannot delete your current account.'});
      await sql`DELETE FROM admin_users WHERE id=${id}`;await audit(actor.username,'account.deleted',{username:target.username});return json(res,200,{ok:true});
    }
    const body=z.object({active:z.boolean()}).parse(req.body);const [account]=await sql`UPDATE admin_users SET active=${body.active},updated_at=now() WHERE id=${id} RETURNING id,username,role,active,created_at`;
    await audit(actor.username,'account.updated',{username:account?.username,active:body.active});return json(res,200,{account});
  } catch(error){return fail(res,error)}
}
