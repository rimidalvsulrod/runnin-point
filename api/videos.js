import { z } from 'zod';
import { requireAdmin } from './_lib/auth.js';
import { audit } from './_lib/audit.js';
import { db, ensureSchema } from './_lib/db.js';
import { fail, json, method } from './_lib/response.js';
const createInput=z.object({title:z.string().trim().min(2).max(160),notes:z.string().trim().max(4000).default('')});
const updateInput=z.object({status:z.enum(['waiting_for_upload','uploaded','editing','review','complete'])});
export default async function handler(req,res){if(!method(req,res,['GET','POST','PATCH']))return;try{const user=await requireAdmin(req);await ensureSchema();const sql=db();if(req.method==='POST'){const b=createInput.parse(req.body);const [project]=await sql`INSERT INTO video_projects(title,notes,created_by) VALUES(${b.title},${b.notes},${user.username}) RETURNING *`;await audit(user.username,'video.created',{id:project.id,title:project.title});return json(res,201,{project})}if(req.method==='PATCH'){const id=z.string().uuid().parse(req.query?.id),b=updateInput.parse(req.body);const [project]=await sql`UPDATE video_projects SET status=${b.status},updated_at=now() WHERE id=${id} RETURNING *`;await audit(user.username,'video.status_changed',{id,status:b.status});return json(res,200,{project})}return json(res,200,{projects:await sql`SELECT * FROM video_projects ORDER BY created_at DESC LIMIT 250`})}catch(error){return fail(res,error)}}
