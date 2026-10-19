import {NextResponse} from 'next/server';
import {viewer} from './backend';
export async function authorize(request:Request,operator=false){const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new Error('Asal permintaan tidak valid.');const user=await viewer();if(!user)throw new Error('Silakan masuk terlebih dahulu.');if(operator&&user.role!=='operator')throw new Error('Akses khusus operator.');return user;}
export function failure(error:unknown){return NextResponse.json({error:error instanceof Error?error.message:'Permintaan gagal.'},{status:400});}
