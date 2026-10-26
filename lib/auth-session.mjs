// Persistent, rolling refresh cookie; access tokens still expire normally.
export const REFRESH_COOKIE_MAX_AGE=60*60*24*365;
/** @typedef {{access_token:string,refresh_token:string,expires_in:number}} Session */
/** @typedef {{kind:'refreshed',session:Session}|{kind:'invalid'}|{kind:'unavailable'}} RefreshResult */
const pending=new Map();
/** Only a definitive provider rejection ends a session. Network/server failures
 * must preserve the browser's refresh token so a later attempt can recover.
 * @param {string} url @param {string} key @param {string} token
 * @param {typeof fetch} fetcher @returns {Promise<RefreshResult>}
 */
export async function renewSession(url,key,token,fetcher=fetch){
 if(!url||!key)return {kind:'unavailable'};
 if(pending.has(token))return pending.get(token);
 const request=(async()=>{
  try{
   const response=await fetcher(`${url}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:token}),cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(response.status===400||response.status===401){
    const error=await response.json().catch(()=>null);
    const code=error?.error_code||error?.code;
    const invalid=['refresh_token_not_found','refresh_token_already_used','session_not_found','session_expired','user_banned'].includes(code)||error?.error==='invalid_grant'||/^invalid refresh token/i.test(error?.msg||error?.message||'');
    return {kind:invalid?'invalid':'unavailable'};
   }
   if(!response.ok)return {kind:'unavailable'};
   const session=await response.json();
   if(typeof session?.access_token!=='string'||!session.access_token||typeof session?.refresh_token!=='string'||!session.refresh_token||!Number.isFinite(session.expires_in)||session.expires_in<=0)return {kind:'unavailable'};
   return {kind:'refreshed',session};
  }catch{return {kind:'unavailable'};}
 })();
 pending.set(token,request);
 try{return await request;}finally{pending.delete(token);}
}
