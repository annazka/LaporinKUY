import {backend,accessToken,configured} from '@/lib/backend';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return new Response(null,{status:400});
 if(!configured())return new Response(null,{status:503});
 try{
  const rows=await backend(`/rest/v1/reports?id=eq.${id}&select=photo_path&limit=1`);
  const path=rows[0]?.photo_path;
  if(typeof path!=='string'||!/^[a-f0-9-]+\/[a-f0-9-]+\.(jpg|png|webp)$/.test(path))return new Response(null,{status:404});
  // Resolve by public report ID; never accept arbitrary private storage paths.
  // Storage RLS allows anon only for an initial photo attached to a report.
  const token=await accessToken();
  const response=await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/authenticated/report-photos/${path}`,{
   cache:'no-store',headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY!,...(token?{Authorization:`Bearer ${token}`}:{})},signal:AbortSignal.timeout(15000),
  });
  if(!response.ok)return new Response(null,{status:response.status>=500?502:404});
  const type=response.headers.get('Content-Type')?.split(';')[0];
  if(!type||!['image/jpeg','image/png','image/webp'].includes(type))return new Response(null,{status:502});
  return new Response(response.body,{headers:{'Content-Type':type,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response(null,{status:502});}
}
