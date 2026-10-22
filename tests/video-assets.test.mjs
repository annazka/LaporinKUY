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
  assert.ok(record.duration>=7,`${phase}: short repeated snippet`);
  assert.equal(record.fps,phase==='night'?30:24);
  assert.equal(record.overlapSeconds,3);
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
