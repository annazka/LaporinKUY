import {NextResponse} from 'next/server';
import {authorize} from '@/lib/http';
import {analyzeImage,GeminiError} from '@/lib/gemini.mjs';
export const runtime='nodejs';
export const maxDuration=60;
// A per-instance burst guard, additional to Google provider quotas and sign-in.
const requests=new Map<string,number>();
export async function POST(request:Request){
 try {
  const user=await authorize(request);
  const now=Date.now(),last=requests.get(user.id)||0;
  if(now-last<10000)return NextResponse.json({error:'Tunggu 10 detik sebelum analisis berikutnya.'},{status:429});
  if(Number(request.headers.get('content-length')||0)>4300000)return NextResponse.json({error:'Foto maksimal 4 MB.'},{status:413});
  const form=await request.formData();const file=form.get('file');
  if(!(file instanceof File))return NextResponse.json({error:'Pilih foto untuk dianalisis.'},{status:400});
  requests.set(user.id,now);
  if(requests.size>1000)for(const [id,time]of requests)if(now-time>60000)requests.delete(id);
  const result=await analyzeImage(new Uint8Array(await file.arrayBuffer()),file.type);
  return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  if(e instanceof GeminiError)return NextResponse.json({error:e.message,code:e.code},{status:e.status});
  return NextResponse.json({error:e instanceof Error?e.message:'Analisis gagal.'},{status:400});
 }
}
