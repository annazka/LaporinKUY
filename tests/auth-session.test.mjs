import test from 'node:test';
import assert from 'node:assert/strict';
import {renewSession,REFRESH_COOKIE_MAX_AGE} from '../lib/auth-session.mjs';
const session={access_token:'new-access',refresh_token:'new-refresh',expires_in:3600};
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
test('temporary failures and API configuration errors preserve the refresh credential',async()=>{
 for(const fetcher of [async()=>{throw Error('offline');},async()=>response(503,{}),async()=>response(429,{}),async()=>response(401,{message:'Invalid API key'}),async()=>response(400,{message:'Bad gateway'}),async()=>response(200,{access_token:'incomplete'})]){
  assert.deepEqual(await renewSession('https://fixture.invalid','public-key','refresh',fetcher),{kind:'unavailable'});
 }
});
test('only a definitive expired or revoked refresh token invalidates the session',async()=>{
 for(const body of [{error_code:'refresh_token_not_found'},{error_code:'refresh_token_already_used'},{error:'invalid_grant'},{msg:'Invalid Refresh Token: Refresh Token Not Found'}]){
  assert.deepEqual(await renewSession('https://fixture.invalid','public-key','refresh',async()=>response(400,body)),{kind:'invalid'});
 }
});
test('concurrent refreshes share token rotation and failures can be retried',async()=>{
 let calls=0,finish;
 const fetcher=async(url,init)=>{
  calls++;assert.equal(url,'https://fixture.invalid/auth/v1/token?grant_type=refresh_token');
  assert.equal(JSON.parse(init.body).refresh_token,'rotating-token');
  return new Promise(resolve=>{finish=resolve;});
 };
 const a=renewSession('https://fixture.invalid','public-key','rotating-token',fetcher),b=renewSession('https://fixture.invalid','public-key','rotating-token',fetcher);
 assert.equal(calls,1);finish(response(200,session));
 assert.deepEqual(await a,{kind:'refreshed',session});assert.deepEqual(await b,{kind:'refreshed',session});
 assert.deepEqual(await renewSession('https://fixture.invalid','public-key','rotating-token',async()=>response(503,{})),{kind:'unavailable'});
 assert.deepEqual(await renewSession('https://fixture.invalid','public-key','rotating-token',async()=>response(200,session)),{kind:'refreshed',session});
 assert.equal(REFRESH_COOKIE_MAX_AGE,365*24*60*60);
});
