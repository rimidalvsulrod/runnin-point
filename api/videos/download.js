import { Readable } from 'node:stream';
import { z } from 'zod';
import { requireAdmin } from '../_lib/auth.js';
import { audit } from '../_lib/audit.js';
import { db, ensureSchema } from '../_lib/db.js';
import { driveFetch } from '../_lib/google.js';
import { fail, json, method } from '../_lib/response.js';
export const config={api:{responseLimit:false}};
export default async function handler(req,res){if(!method(req,res,['GET']))return;try{const user=await requireAdmin(req),id=z.string().uuid().parse(req.query?.id),kind=z.enum(['original','final']).parse(req.query?.kind);await ensureSchema();const sql=db();const [project]=await sql`SELECT * FROM video_projects WHERE id=${id}`;const fileId=kind==='original'?project?.original_file_id:project?.final_file_id,name=kind==='original'?project?.original_name:project?.final_name;if(!fileId)return json(res,404,{error:'File not found.'});const headers={};if(req.headers.range)headers.Range=req.headers.range;const response=await driveFetch(`/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{headers});if(!response.ok&&!([200,206].includes(response.status)))return json(res,response.status,{error:'Drive download failed.'});res.statusCode=response.status;res.setHeader('Content-Type',response.headers.get('content-type')||'application/octet-stream');res.setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(name||'video')}`);for(const h of ['content-length','content-range','accept-ranges']){const v=response.headers.get(h);if(v)res.setHeader(h,v)}await audit(user.username,'video.downloaded',{id,kind,name});Readable.fromWeb(response.body).pipe(res)}catch(error){return fail(res,error)}}
