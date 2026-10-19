import {NextResponse} from 'next/server';
import {authorize,failure} from '@/lib/http';
import {rpc} from '@/lib/backend';
import {validCoordinates} from '@/lib/rules.mjs';
export async function POST(request:Request){try{const user=await authorize(request);const b=await request.json();if(b.action==='confirm'||b.action==='reopen'){await rpc('confirm_report',{p_report_id:b.id,p_accept:b.action==='confirm',p_message:String(b.message||'')});return NextResponse.json({ok:true});}
 const lat=Number(b.latitude),lng=Number(b.longitude);if(!validCoordinates(lat,lng))throw new Error('Lokasi harus berada di wilayah Jakarta daratan.');
 if(!String(b.photo_path||'').startsWith(user.id+'/'))throw new Error('Unggah foto bukti terlebih dahulu.');
 const data=await rpc('submit_report',{p_title:String(b.title||''),p_description:String(b.description||''),p_category:String(b.category||'Jalan berlubang'),p_address:String(b.address||''),p_latitude:lat,p_longitude:lng,p_photo_path:b.photo_path});return NextResponse.json(data);
 }catch(e){return failure(e);}}
