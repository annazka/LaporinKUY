import {createHash} from 'node:crypto';
import {analyzeImage,GeminiError,validImage} from './gemini.mjs';

// Cache/deduplication is scoped to the signed-in user and this function instance.
// Retain results, never image bytes; shared provider calls stop when nobody waits.
export function createAnalysisService({analyze=analyzeImage,now=Date.now}={}){
 const results=new Map(),jobs=new Map(),windows=new Map();
 function waitFor(job,signal){
  job.waiters++;
  return new Promise((resolve,reject)=>{
   let finished=false;
   const finish=(callback,value)=>{if(finished)return;finished=true;signal?.removeEventListener('abort',abort);job.waiters--;callback(value);if(!job.settled&&job.waiters===0)job.controller.abort();};
   const abort=()=>finish(reject,new DOMException('Dibatalkan','AbortError'));
   if(signal?.aborted){abort();return;}
   signal?.addEventListener('abort',abort,{once:true});
   job.promise.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
 }
 async function run(userId,bytes,mimeType,{signal}={}){
  signal?.throwIfAborted();
  if(!validImage(bytes,mimeType))throw new GeminiError('Gunakan foto JPG, PNG, atau WebP yang valid, maksimal 4 MB.',400,'INVALID_IMAGE');
  const key=userId+':'+createHash('sha256').update(mimeType).update(bytes).digest('hex'),time=now();
  for(const [id,item]of results)if(time-item.at>600000)results.delete(id);
  const cached=results.get(key);if(cached)return cached.result;
  const existing=jobs.get(key);if(existing&&!existing.controller.signal.aborted)return waitFor(existing,signal);
  for(const [id,items]of windows)if(!items.some(at=>time-at<60000))windows.delete(id);
  const recent=(windows.get(userId)||[]).filter(at=>time-at<60000);
  if(recent.length>=6){const retryAfter=Math.max(1,Math.ceil((60000-(time-recent[0]))/1000));throw new GeminiError('Terlalu banyak analisis dalam satu menit. Tunggu sebentar lalu coba lagi.',429,'RATE_LIMITED',retryAfter);}
  if(jobs.size>=64)throw new GeminiError('Layanan analisis sedang sibuk. Foto tetap tersedia; coba lagi sebentar.',503,'BUSY',5);
  windows.set(userId,[...recent,time]);
  const job={controller:new AbortController(),waiters:0,settled:false,promise:null};
  job.promise=Promise.resolve().then(()=>analyze(bytes,mimeType,{signal:job.controller.signal})).then(result=>{
   if(job.controller.signal.aborted)throw new DOMException('Dibatalkan','AbortError');
   if(results.size>=64)results.delete(results.keys().next().value);
   results.set(key,{at:now(),result});return result;
  }).finally(()=>{job.settled=true;if(jobs.get(key)===job)jobs.delete(key);});
  jobs.set(key,job);
  return waitFor(job,signal);
 }
 return {run};
}
