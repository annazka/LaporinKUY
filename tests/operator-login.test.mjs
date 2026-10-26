import test from 'node:test';
import assert from 'node:assert/strict';
import {operatorEmail,operatorSession,ADMIN_LOGIN_EMAIL} from '../lib/operator-login.mjs';
test('admin username resolves on the server while operator email logins still work',()=>{
 for(const value of ['admin','ADMIN',' admin '])assert.equal(operatorEmail(value),ADMIN_LOGIN_EMAIL);
 assert.equal(operatorEmail(' Operator@Example.test '),'operator@example.test');
 for(const value of ['',null,'operator','admin@','admin\n@example.test',{},'a'.repeat(260)+'@x.test'])assert.throws(()=>operatorEmail(value));
});
test('successful credentials grant admin cookies only for an operator session',()=>{
 const session={access_token:'fixture-access',refresh_token:'fixture-refresh',user:{app_metadata:{role:'operator'}}};
 assert.equal(operatorSession(session),session);
 for(const value of [null,{...session,user:{app_metadata:{role:'user'}}},{...session,user:{user_metadata:{role:'operator'}}},{...session,access_token:''},{...session,refresh_token:''}])assert.throws(()=>operatorSession(value));
});
