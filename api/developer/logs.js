import { requireDeveloper } from '../_lib/auth.js';
import { db, ensureSchema } from '../_lib/db.js';
import { fail, json, method } from '../_lib/response.js';
export default async function handler(req,res){if(!method(req,res,['GET']))return;try{await requireDeveloper(req);await ensureSchema();const sql=db();return json(res,200,{logs:await sql`SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 250`})}catch(error){return fail(res,error)}}
