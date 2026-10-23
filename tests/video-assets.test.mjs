import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {phases} from '../lib/video-clock.mjs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/video-loop-metrics.json',import.meta.url),'utf8'));

test('active videos match validated exports and use the accepted night cycle length',()=>{
 for(const [phase,asset] of Object.entries(phases)){
  const bytes=readFileSync(new URL('../public'+asset.src.split('?')[0],import.meta.url));
  const record=manifest.phases[phase];
  assert.equal(createHash('sha256').update(bytes).digest('hex'),record.sha256,`${phase}: stale validation`);
  assert.equal(record.duration,manifest.phases.night.duration,`${phase}: cycle differs from the night reference`);
  assert.equal(record.fps,30);
  assert.equal(record.overlapSeconds,3);
  assert.equal(record.backgroundContinuity.checkedFrames,record.frames);
  assert.ok(record.backgroundContinuity.minimumCorrelation>=.65,`${phase}: unreliable statue tracking`);
  // The user approved the day global-fit preview with its measured broader framing.
  const driftLimit=phase==='day'?record.reviewedRefinement.referenceContinuity.maxMonumentDisplacementPixels:.5;
  assert.ok(record.backgroundContinuity.maxMonumentDisplacementPixels<=driftLimit,`${phase}: monument drift exceeds the accepted reference`);
  assert.ok(record.backgroundContinuity.maximumAdjacentDisplacementPixels<=.5,`${phase}: camera jump`);
  assert.ok(record.backgroundContinuity.loopJoinDisplacementPixels<=.5,`${phase}: anchor resets at seam`);
  assert.equal(record.stabilization.method,'whole-frame-similarity',`${phase}: perspective warp returned`);
  assert.ok(record.monumentAnchor.conservativeEdgeClearancePixels>=4,`${phase}: filtered source edge enters crop`);
  assert.equal(record.monumentAnchor.edgeMode,'fixed-crop-no-fill');
  assert.equal(record.backgroundContinuity.requestedTargetMet,Math.max(record.backgroundContinuity.maxMonumentDisplacementPixels,record.backgroundContinuity.maximumRegionalDisplacementPixels)<=.01);
  assert.equal(record.monumentAnchor.preservesWholeFrames,true);
  assert.equal(record.monumentAnchor.method,'whole-frame-monument-translation');
  const retiming=record.retiming;
  if(phase==='night'){
   assert.equal(retiming,undefined,'accepted night footage must remain at native speed');
   assert.equal(record.monumentAnchor.checkedFrames,record.frames+record.fps*record.overlapSeconds);
   assert.ok(record.medianFrameDifference>.2,`${phase}: video was frozen`);
  }else{
   assert.equal(retiming.method,phase==='evening'?'motion-compensated-interpolation':'frame-blend-interpolation');
   assert.equal(retiming.interpolateBeforeDissolve,true,'flow must not distort the blended seam');
   assert.equal(retiming.sourceFps,24);
   assert.equal(retiming.outputFps,30);
   assert.equal(retiming.sourceFrames,record.monumentAnchor.checkedFrames);
   assert.equal(retiming.sourceFrames,record.sourceFrameRange[1]-record.sourceFrameRange[0]);
   assert.equal(retiming.interpolatedFrames,record.frames+record.fps*record.overlapSeconds);
   assert.ok(retiming.speed>0&&retiming.speed<1,'slow motion was explicitly requested');
   assert.ok(Math.abs(retiming.speed-(retiming.sourceFrames/retiming.sourceFps)/(retiming.interpolatedFrames/retiming.outputFps))<1e-10);
   const sourceFrameStep=retiming.speed*retiming.sourceFps/retiming.outputFps;
   assert.ok(record.medianFrameDifference/sourceFrameStep>.2,`${phase}: motion was frozen rather than interpolated`);
  }
  const seamLimit=phase==='day'?record.reviewedRefinement.referenceSeam*1.05+.01:record.referenceSeam*1.3+.25;
  assert.ok(record.seam<=seamLimit,`${phase}: cyclic seam exceeds the accepted reference`);
 }
});

test('morning and day reduce visible edge deformation without optical-flow warps',()=>{
 const previous={morning:'26c5126cb14af4afd701c8c4646e4a375343af061573654af15044004e9c1233',day:'6618ce22952fbf3af8f01cf2ae571bf63397a5a7d75553a53cc1ac6e1bceb5bd'};
 for(const phase of ['morning','day']){
  const record=manifest.phases[phase],shape=record.edgeShape,baseline=record.edgeReference;
  assert.equal(record.retiming.method,'frame-blend-interpolation','geometric motion fields returned at the frame borders');
  assert.ok(record.monumentAnchor.fixedCrop[0]>=103,'unstable source border was reintroduced');
  assert.equal(record.retiming.sourceFrames,96,'the large source viewpoint changes returned');
  assert.equal(shape.decodedFrames,record.frames);
  assert.ok(shape.sampledFrames>=116,'insufficient edge samples');
  assert.equal(baseline.sha256,previous[phase],'edge comparison no longer uses the previous published clip');
  assert.ok(shape.worstRegionP95Pixels<baseline.shape.worstRegionP95Pixels,`${phase}: worst edge deformation did not improve`);
  assert.ok(shape.meanRegionP95Pixels<baseline.shape.meanRegionP95Pixels,`${phase}: average edge deformation did not improve`);
  for(const region of Object.values(shape.regions))assert.ok(region.minimumTracks>=20,'unreliable edge measurements');
 }
});

test('evening avoids the source camera cut and keeps edge motion within the accepted night reference',()=>{
 const record=manifest.phases.evening, reference=record.peripheralReference;
 assert.equal(reference.sha256,manifest.phases.night.sha256,'night benchmark changed without rechecking evening');
 const [start,end]=record.sourceFrameRange;
 assert.ok(end-start>=record.retiming.sourceFps*3.5,'insufficient original continuous motion');
 assert.equal(start,record.stabilization.cameraStepFrames.at(-1),'the opening backward dolly returned');
 assert.equal(end,record.originalSourceFrames,'camera-hold take was unnecessarily truncated');
 assert.equal(record.frames,record.retiming.interpolatedFrames-record.fps*record.overlapSeconds);
 assert.ok(!record.stabilization.cameraStepFrames.some(frame=>frame>start&&frame<end),'source camera jump is inside the loop');
 assert.equal(record.peripheralMotion.checkedFrames,record.frames);
 for(const region of Object.values(record.peripheralMotion.regions)){
  assert.ok(region.minimumTracks>=30,'insufficient independent architecture observations');
  assert.ok(region.maximumMedianStepPixels<=.5,'visible peripheral camera step');
 }
 assert.ok(record.peripheralMotion.maximumEdgeDisagreementPixels<=reference.motion.maximumEdgeDisagreementPixels,'opposite edges move less coherently than night');
 assert.ok(record.peripheralMotion.p95EdgeDisagreementPixels<=reference.motion.p95EdgeDisagreementPixels,'recurring edge wobble exceeds night');
 assert.equal(record.fixedView.checkedFrames,record.frames);
 for(const [name,region] of Object.entries(record.fixedView.regions)){
  assert.ok(region.minimumTracks>=40,`${name}: insufficient fixed-reference observations`);
  const limit=name.endsWith('Foreground')?5:.75;
  assert.equal(region.limitPixels,limit,`${name}: accumulated-drift guard was changed`);
  assert.ok(region.maximumMedianDriftPixels<=limit,`${name}: slow camera pullback returned`);
  assert.ok(region.loopJoinMedianDisplacementPixels<=.5,`${name}: scenery jumps at loop restart`);
 }
});

// This deploy must install exactly the reviewed file; do not silently re-render it.
test('day uses the approved preview and reduces the measured shake around second 12',()=>{
 const record=manifest.phases.day, refinement=record.reviewedRefinement;
 const preview=readFileSync(new URL('../public/media/previews/day-smooth12.mp4',import.meta.url));
 assert.equal(record.sha256,'32074e5587a01693dc9927a194f43614b52bdf6b96a23784cc0f247d9c13a00c');
 assert.equal(record.sha256,createHash('sha256').update(preview).digest('hex'));
 assert.equal(refinement.inputSha256,'eaa0f834277a42a14b2e9d0b32a779ff62d9726c15ecf6320e5d418a4f790430');
 assert.equal(refinement.referenceSha256,'10bdf92d2c5414539b83bf971311af82f38054fdcd7a7eed83b90e0733172d61');
 assert.equal(refinement.method,'whole-frame-similarity');
 assert.deepEqual(refinement.fixedCrop,[11,6,1258,708]);
 assert.deepEqual(refinement.localMotion.intervalSeconds,[11.5,12.5]);
 for(const name of ['left','monument']){
  const {candidate,fixed}=refinement.localMotion.regions[name];
  assert.ok(fixed.maximumStepPixels<candidate.maximumStepPixels*.5,`${name}: local shake returned`);
  assert.ok(fixed.maximumStepChangePixels<candidate.maximumStepChangePixels*.5,`${name}: correction jerk returned`);
 }
 for(const region of Object.values(refinement.localMotion.regions)){
  assert.ok(region.fixed.maximumStepPixels<.06,'visible local jump');
  assert.ok(region.fixed.loopJoinStepPixels<.1,'new loop join jump');
 }
});
