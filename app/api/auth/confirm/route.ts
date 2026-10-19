import {NextResponse} from 'next/server';
import {backend} from '@/lib/backend';
import {validConfirmationBody} from '@/lib/email-confirmation.mjs';

export async function POST(request:Request){
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
 if(request.headers.get('origin')!==new URL(request.url).origin)return NextResponse.json({error:'Permintaan tidak valid.'},{status:403,headers});
 try{
  const body=await request.json();
  if(!validConfirmationBody(body))return NextResponse.json({error:'Tautan konfirmasi tidak valid.'},{status:400,headers});
  let user;
  if(body.token_hash){
   const result=await backend('/auth/v1/verify',{method:'POST',body:JSON.stringify({type:'email',token_hash:body.token_hash})});
   user=result.user;
  }else{
   user=await backend('/auth/v1/user',{},body.access_token);
  }
  if(!user?.email_confirmed_at)return NextResponse.json({error:'Email belum berhasil dikonfirmasi.'},{status:400,headers});
  // Confirmation does not switch the browser's signed-in account.
  // Users explicitly sign in after seeing the success screen.
  return NextResponse.json({confirmed:true},{headers});
 }catch{
  return NextResponse.json({error:'Tautan tidak berlaku, sudah digunakan, atau koneksi sedang terganggu. Jika sudah pernah mengonfirmasi email ini, coba masuk ke akunmu.'},{status:400,headers});
 }
}
