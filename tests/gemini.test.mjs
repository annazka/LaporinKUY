import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeImage,validateAnalysis,validImage} from '../lib/gemini.mjs';
const result={relevant:true,category:'Jalan berlubang',severity:'berat',priority:'high',summary:'Terlihat kerusakan pada permukaan jalan.',reason:'Permukaan jalan tampak berlubang. Ukuran dan kedalaman belum dapat dipastikan.'};
test('analysis rejects unsupported files and images over limit',()=>{
 assert.equal(validImage(new Uint8Array([1,2,3]),'image/jpeg'),false);
 assert.equal(validImage(new Uint8Array(4194305),'image/png'),false);
 assert.throws(()=>validateAnalysis({...result,priority:'critical'}));
 assert.throws(()=>validateAnalysis({...result,relevant:false}));
 assert.equal(validateAnalysis(result).priority,'high');
});
test('image request uses server-side key header and validated JSON response',async()=>{
 const original=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY,oldModel=process.env.GEMINI_MODEL;
 process.env.GEMINI_API_KEY='fixture-not-a-real-key';process.env.GEMINI_MODEL='gemini-3.8-flash';
 globalThis.fetch=async(url,init)=>{
  assert.equal(url.includes('fixture-not-a-real-key'),false);
  assert.equal(init.headers['x-goog-api-key'],'fixture-not-a-real-key');
  const payload=JSON.parse(init.body);assert.equal(payload.contents[0].parts[0].inline_data.mime_type,'image/png');
  assert.equal(payload.generationConfig.responseMimeType,'application/json');
  return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(result)}]}}]});
 };
 try{const actual=await analyzeImage(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png');assert.equal(actual.category,'Jalan berlubang');assert.equal(actual.model,'gemini-3.8-flash');}
 finally{globalThis.fetch=original;oldKey===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=oldKey;oldModel===undefined?delete process.env.GEMINI_MODEL:process.env.GEMINI_MODEL=oldModel;}
});
test('quota failures are actionable without exposing provider error body',async()=>{
 const original=globalThis.fetch,oldKey=process.env.GEMINI_API_KEY,oldModel=process.env.GEMINI_MODEL;
 process.env.GEMINI_API_KEY='fixture-private';process.env.GEMINI_MODEL='gemini-3.8-flash';
 globalThis.fetch=async()=>Response.json({error:{message:'fixture-private sensitive provider message'}},{status:429});
 try{await assert.rejects(()=>analyzeImage(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),e=>e.status===429&&!e.message.includes('fixture-private')&&e.code==='HTTP_429');}
 finally{globalThis.fetch=original;oldKey===undefined?delete process.env.GEMINI_API_KEY:process.env.GEMINI_API_KEY=oldKey;oldModel===undefined?delete process.env.GEMINI_MODEL:process.env.GEMINI_MODEL=oldModel;}
});
