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
  assert.ok(record.backgroundContinuity.maxMedianDisplacementPixels<=3,`${phase}: camera drift`);
  assert.equal(record.anchorLock.checkedFrames,record.frames);
  assert.ok(record.anchorLock.maxMonumentDisplacementPixels<=.05,`${phase}: monument shakes`);
  assert.ok(record.anchorLock.maxMonumentMeanPixelChange<=.1,`${phase}: unstable monument plate`);
  assert.ok(record.anchorLock.medianTrafficFrameDifference>.2,`${phase}: traffic was frozen`);
  assert.ok(record.anchorLock.liveAreaFraction>.15,`${phase}: insufficient live footage`);
  assert.ok(record.seam<=record.referenceSeam*1.3+.25,`${phase}: cyclic seam`);
 }
});
