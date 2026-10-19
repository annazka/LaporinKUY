export const CONFIRMATION_URL='https://laporkuy.online/auth/confirm';
export function signupPath(){return `/auth/v1/signup?redirect_to=${encodeURIComponent(CONFIRMATION_URL)}`;}
export function callbackInput(hash,search){
 const fragment=new URLSearchParams(hash.replace(/^#/,''));
 const query=new URLSearchParams(search.replace(/^\?/,''));
 if(fragment.has('error')||fragment.has('error_code')||query.has('error')||query.has('error_code'))return {kind:'invalid'};
 const type=fragment.get('type')||query.get('type');
 if(type&&!['signup','email'].includes(type))return {kind:'invalid'};
 const access=fragment.get('access_token');
 if(access&&access.length<=8192)return {kind:'session',access_token:access};
 const token=query.get('token_hash');
 if(token&&/^[a-zA-Z0-9_-]{16,512}$/.test(token))return {kind:'token',token_hash:token,type:'email'};
 return {kind:'empty'};
}
export function validConfirmationBody(body){
 if(!body||typeof body!=='object')return false;
 const hasToken=typeof body.token_hash==='string';const hasAccess=typeof body.access_token==='string';
 if(hasToken===hasAccess)return false;
 if(hasToken)return /^[a-zA-Z0-9_-]{16,512}$/.test(body.token_hash)&&body.type==='email';
 return body.access_token.length>20&&body.access_token.length<=8192&&!/\s/.test(body.access_token);
}
