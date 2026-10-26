import {tokenNeedsRefresh} from './lib/rules.mjs';
import {renewSession,REFRESH_COOKIE_MAX_AGE} from './lib/auth-session.mjs';
import {NextRequest,NextResponse} from 'next/server';
export async function proxy(request:NextRequest){
 const refresh=request.cookies.get('lk_refresh')?.value;
 if(!tokenNeedsRefresh(request.cookies.get('lk_access')?.value)||!refresh)return NextResponse.next();
 const result=await renewSession(process.env.SUPABASE_URL||'',process.env.SUPABASE_PUBLISHABLE_KEY||'',refresh);
 if(result.kind==='unavailable')return NextResponse.next();
 if(result.kind==='refreshed'){
  request.cookies.set('lk_access',result.session.access_token);
  request.cookies.set('lk_refresh',result.session.refresh_token);
 }else{
  request.cookies.delete('lk_access');request.cookies.delete('lk_refresh');
 }
 // Forward renewed cookies into this render, not only the next navigation.
 const headers=new Headers(request.headers);headers.set('cookie',request.cookies.toString());
 const response=NextResponse.next({request:{headers}});
 if(result.kind==='refreshed'){
  const options={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/'};
  response.cookies.set('lk_access',result.session.access_token,{...options,maxAge:result.session.expires_in});
  response.cookies.set('lk_refresh',result.session.refresh_token,{...options,maxAge:REFRESH_COOKIE_MAX_AGE});
 }else{response.cookies.delete('lk_access');response.cookies.delete('lk_refresh');}
 return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|media/|api/auth).*)']};
