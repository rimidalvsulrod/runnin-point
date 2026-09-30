import { z } from 'zod';
import { requireDeveloper } from '../_lib/auth.js';
import { audit } from '../_lib/audit.js';
import { encrypt } from '../_lib/crypto.js';
import { db, ensureSchema } from '../_lib/db.js';
import { googleSettings } from '../_lib/google.js';
import { fail, getOrigin, json, method } from '../_lib/response.js';
const input=z.object({client_id:z.string().trim().min(10),client_secret:z.string().trim().min(6)});
export default async function handler(req,res){if(!method(req,res,['GET','POST']))return;try{const user=await requireDeveloper(req);await ensureSchema();const sql=db();if(req.method==='POST'){const body=input.parse(req.body);await sql`UPDATE integration_settings SET google_client_id=${encrypt(body.client_id)},google_client_secret=${encrypt(body.client_secret)},google_refresh_token=NULL,google_folder_id=NULL,google_email=NULL,updated_at=now() WHERE id=1`;await audit(user.username,'google.credentials_saved');return json(res,200,{ok:true})}const settings=await googleSettings();return json(res,200,{configured:!!(settings.clientId&&settings.clientSecret),connected:!!settings.refreshToken,email:settings.email,folder_id:settings.folderId,callback_url:`${getOrigin(req)}/api/google/callback`})}catch(error){return fail(res,error)}}
