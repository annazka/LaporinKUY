import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {backend} from '@/lib/backend';
import {failure} from '@/lib/http';
import {signupPath} from '@/lib/email-confirmation.mjs';
export async function POST(request:Request){try{
 if(request.headers.get('origin')!==new URL(request.url).origin)throw new Error('Permintaan tidak valid.');
 const body=await request.json();const jar=await cookies();
 if(body.action==='logout'){const token=jar.get('lk_access')?.value;if(token)await backend('/auth/v1/logout',{method:'POST'},token).catch(()=>{});jar.delete('lk_access');jar.delete('lk_refresh');return NextResponse.json({ok:true});}
 if(body.action==='refresh'){const refresh=jar.get('lk_refresh')?.value;if(!refresh)throw new Error('Sesi berakhir. Silakan masuk kembali.');const session=await backend('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:refresh})});setSession(jar,session);return NextResponse.json({ok:true});}
 if(!['login','register'].includes(body.action))throw new Error('Aksi tidak valid.');
 if(typeof body.email!=='string'||typeof body.password!=='string'||body.password.length<8)throw new Error('Masukkan email dan kata sandi minimal 8 karakter.');
 const path=body.action==='register'?signupPath():'/auth/v1/token?grant_type=password';
 const data=await backend(path,{method:'POST',body:JSON.stringify({email:body.email.trim(),password:body.password,...(body.action==='register'?{data:{full_name:String(body.name||'').slice(0,80)}}:{})})});
 if(data.access_token){setSession(jar,data);return NextResponse.json({ok:true,role:data.user?.app_metadata?.role==='operator'?'operator':'user'});}
 return NextResponse.json({ok:true,confirmEmail:true});
 }catch(e){return failure(e);}}
function setSession(jar:Awaited<ReturnType<typeof cookies>>,session:{access_token:string;refresh_token:string;expires_in:number}){const options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};jar.set('lk_access',session.access_token,{...options,maxAge:session.expires_in});jar.set('lk_refresh',session.refresh_token,{...options,maxAge:60*60*24*30});}
