import {NextResponse} from 'next/server';
import {authorize,failure} from '@/lib/http';
import {rpc} from '@/lib/backend';
import {voucherInput} from '@/lib/operator-data.mjs';
export async function POST(request:Request){try{await authorize(request,true);const args=voucherInput(await request.json());const id=await rpc('operator_manage_voucher',args);return NextResponse.json({ok:true,id});}catch(error){return failure(error);}}
