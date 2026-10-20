import test from 'node:test';
import assert from 'node:assert/strict';
import {photoFingerprint,validatePhoto,sendPhotoForAnalysis} from '../lib/photo-analysis-client.mjs';
const result={relevant:true,category:'Jalan berlubang',severity:'berat',priority:'high',summary:'Fixture',reason:'Fixture',model:'fixture-model'};
const file=()=>new File([new Uint8Array([137,80,78,71])],'photo.png',{type:'image/png'});
class Request{
 upload={};readyState=1;status=200;responseText=JSON.stringify(result);aborted=false;
 open(method,url){this.method=method;this.url=url;}
 send(body){this.body=body;}
 abort(){this.aborted=true;this.onabort();}
 getResponseHeader(){return '7';}
}
test('fingerprints deduplicate image content rather than filenames and metadata',async()=>{
 const a=file(),b=new File([await a.arrayBuffer()],'renamed.png',{type:a.type}),c=new File([new Uint8Array([1,2,3,4])],a.name,{type:a.type,lastModified:a.lastModified});
 assert.equal(await photoFingerprint(a),await photoFingerprint(b));assert.notEqual(await photoFingerprint(a),await photoFingerprint(c));
 assert.equal(validatePhoto(a),null);assert.ok(validatePhoto(new File(['x'],'x.heic',{type:'image/heic'})));assert.ok(validatePhoto(new File([new Uint8Array(4194305)],'large.png',{type:'image/png'})));
});
test('upload completion changes the status to analyzing and validated results are returned',async()=>{
 const request=new Request(),phases=[];const pending=sendPhotoForAnalysis(file(),{createRequest:()=>request,onPhase:phase=>phases.push(phase)});
 assert.equal(request.method,'POST');assert.equal(request.url,'/api/analyze');assert.ok(request.body.get('file') instanceof File);
 assert.deepEqual(phases,['uploading']);request.upload.onload();assert.deepEqual(phases,['uploading','analyzing']);request.onload();assert.deepEqual(await pending,result);
 request.upload.onload();assert.deepEqual(phases,['uploading','analyzing'],'late events do not overwrite a finished request');
});
test('abort stops the previous upload and never returns an analysis result',async()=>{
 const controller=new AbortController(),request=new Request();const pending=sendPhotoForAnalysis(file(),{signal:controller.signal,createRequest:()=>request});
 const rejected=assert.rejects(pending,e=>e.name==='AbortError');controller.abort();await rejected;assert.equal(request.aborted,true);
});
test('network, quota, malformed responses, and timeout errors remain retryable without fake results',async()=>{
 for(const kind of ['network','timeout','quota','malformed','incomplete']){
  const request=new Request(),pending=sendPhotoForAnalysis(file(),{createRequest:()=>request});
  const rejected=assert.rejects(pending,e=>{assert.ok(e.message.length>0);if(kind==='quota')assert.equal(e.retryAfter,7);return true;});
  if(kind==='network')request.onerror();else if(kind==='timeout')request.ontimeout();else{if(kind==='quota'){request.status=429;request.responseText=JSON.stringify({error:'Kuota sedang penuh',code:'QUOTA'});}if(kind==='malformed')request.responseText='<html>upstream failed</html>';if(kind==='incomplete')request.responseText='{}';request.onload();}
  await rejected;
 }
});
