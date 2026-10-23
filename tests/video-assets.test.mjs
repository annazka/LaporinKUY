import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {phases} from '../lib/video-clock.mjs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/video-loop-metrics.json',import.meta.url),'utf8'));

test('active videos match validated exports and keep long normal-speed forward cycles',()=>{
 for(const [phase,asset] of Object.entries(phases)){
  const bytes=readFileSync(new URL('../public'+asset.src.split('?')[0],import.meta.url));
  const record=manifest.phases[phase];
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,`${phase}: stale validation`);
  assert.ok(record.duration>=(phase==='evening'?5.5:7),`${phase}: short repeated snippet`);
  assert.equal(record.fps,phase==='night'?30:24);
  assert.equal(record.overlapSeconds,phase==='evening'?0.5:3);
  assert.equal(record.backgroundContinuity.checkedFrames,record.frames);
  assert.ok(record.backgroundContinuity.minimumCorrelation>=.65,`${phase}: unreliable statue tracking`);
  assert.ok(record.backgroundContinuity.maxMonumentDisplacementPixels<=.5,`${phase}: monument drift`);
  assert.ok(record.backgroundContinuity.maximumAdjacentDisplacementPixels<=.5,`${phase}: camera jump`);
  assert.ok(record.backgroundContinuity.loopJoinDisplacementPixels<=.5,`${phase}: anchor resets at seam`);
  assert.equal(record.stabilization.method,'whole-frame-similarity',`${phase}: perspective warp returned`);
  assert.ok(record.monumentAnchor.conservativeEdgeClearancePixels>=4,`${phase}: filtered source edge enters crop`);
  assert.equal(record.monumentAnchor.edgeMode,'fixed-crop-no-fill');
  assert.equal(record.backgroundContinuity.requestedTargetMet,Math.max(record.backgroundContinuity.maxMonumentDisplacementPixels,record.backgroundContinuity.maximumRegionalDisplacementPixels)<=.01);
  assert.equal(record.monumentAnchor.preservesWholeFrames,true);
  assert.equal(record.monumentAnchor.method,'whole-frame-monument-translation');
  assert.equal(record.monumentAnchor.checkedFrames,record.frames+record.fps*record.overlapSeconds);
  assert.ok(record.medianFrameDifference>.2,`${phase}: video was frozen`);
  assert.ok(record.seam<=record.referenceSeam*1.3+.25,`${phase}: cyclic seam`);
 }
});

test('evening avoids the source camera cut and keeps edge motion within the accepted night reference',()=>{
 const record=manifest.phases.evening, reference=record.peripheralReference;
 assert.equal(reference.sha256,manifest.phases.night.sha256,'night benchmark changed without rechecking evening');
 const [start,end]=record.sourceFrameRange;
 assert.ok(end-start>=record.fps*6,'insufficient original continuous motion');
 assert.equal(record.frames, end-start-record.fps*record.overlapSeconds);
 assert.ok(!record.stabilization.cameraStepFrames.some(frame=>frame>start&&frame<end),'source camera jump is inside the loop');
 assert.equal(record.peripheralMotion.checkedFrames,record.frames);
 for(const region of Object.values(record.peripheralMotion.regions)){
  assert.ok(region.minimumTracks>=30,'insufficient independent architecture observations');
  assert.ok(region.maximumMedianStepPixels<=.5,'visible peripheral camera step');
 }
 assert.ok(record.peripheralMotion.maximumEdgeDisagreementPixels<=reference.motion.maximumEdgeDisagreementPixels,'opposite edges move less coherently than night');
 assert.ok(record.peripheralMotion.p95EdgeDisagreementPixels<=reference.motion.p95EdgeDisagreementPixels,'recurring edge wobble exceeds night');
});
