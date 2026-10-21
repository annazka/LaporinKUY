import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {phaseClock, phases, secondsInJakarta} from '../lib/video-clock.mjs';
const at = seconds => new Date(Date.parse('2026-10-20T00:00:00+07:00') + seconds * 1000);
const weights = state => {
 const result = Object.fromEntries(Object.keys(phases).map(phase => [phase, 0]));
 if (state.from === state.to) result[state.from] = 1;
 else {result[state.from] = 1 - state.amount; result[state.to] = state.amount;}
 return result;
};
test('uses actual Jakarta time regardless of host timezone, including milliseconds', () => {
 assert.equal(secondsInJakarta(new Date('2026-10-20T00:30:45.125Z')), 7 * 3600 + 30 * 60 + 45.125);
 assert.equal(secondsInJakarta(new Date('2026-10-19T17:00:00Z')), 0);
});
test('shows the pure scene at each phase peak', () => {
 for (const [hour,phase] of [[0,'night'],[7.5,'morning'],[12.5,'day'],[16.5,'evening']]) {
  assert.equal(weights(phaseClock(at(hour * 3600)))[phase], 1);
 }
});
test('blends each boundary symmetrically over two hours using smoothstep', () => {
 for (const [hour,from,to] of [[5,'night','morning'],[10,'morning','day'],[15,'day','evening'],[18,'evening','night']]) {
  assert.equal(weights(phaseClock(at((hour - 1) * 3600)))[from], 1);
  assert.deepEqual(phaseClock(at(hour * 3600)), {from,to,amount:.5});
  assert.equal(weights(phaseClock(at((hour + 1) * 3600)))[to], 1);
  assert.equal(phaseClock(at((hour - .5) * 3600)).amount, .15625);
  assert.ok(phaseClock(at(hour * 3600 + .125)).amount > .5);
 }
});
test('scene weights are continuous for the entire day, including midnight', () => {
 let previous = weights(phaseClock(at(0)));
 for (let second = 1; second <= 86400; second++) {
  const current = weights(phaseClock(at(second)));
  assert.ok(Math.abs(Object.values(current).reduce((a,b)=>a+b,0) - 1) < 1e-10);
  for (const phase of Object.keys(phases)) {
   assert.ok(current[phase] >= 0 && current[phase] <= 1);
   assert.ok(Math.abs(current[phase] - previous[phase]) < .0003);
  }
  previous = current;
 }
 assert.deepEqual(phaseClock(at(86399.999)), phaseClock(at(86400)));
});
test('each phase has its own playable MP4 and fallback poster', () => {
 assert.equal(new Set(Object.values(phases).map(phase=>phase.src)).size, 4);
 for (const {src, poster} of Object.values(phases)) {
  assert.ok(existsSync(new URL(`../public${src}`, import.meta.url)));
  assert.ok(existsSync(new URL(`../public${poster}`, import.meta.url)));
  assert.equal(readFileSync(new URL(`../public${src}`,import.meta.url)).subarray(4,8).toString(),'ftyp');
 }
});
test('interface stays monochrome while phase videos change', () => {
 const css = readFileSync(new URL('../app/time-palette.css', import.meta.url), 'utf8');
 for (const [color] of css.matchAll(/#[a-f\d]{3,8}\b|oklch\([^)]+\)/gi)) {
  if (color.startsWith('#')) assert.match(color, /^#(?:([a-f\d])\1\1|([a-f\d]{2})\2\2)$/i);
  else assert.match(color, /^oklch\([\d.]+% 0 0\)$/);
 }
});

// Measurements are produced by decoding every generated loop, not by guessing
// that a crossfade is seamless. Hashes bind those measurements to these assets.
test('loop boundary motion matches adjacent source frames, within codec tolerance', () => {
 const fixture = JSON.parse(readFileSync(new URL('./fixtures/video-loop-metrics.json', import.meta.url), 'utf8'));
 const hash = bytes => createHash('sha256').update(bytes).digest('hex');
 assert.equal(fixture.sourceSha256, hash(readFileSync(new URL('../public/media/bundaran-hi-wib.mp4', import.meta.url))));
 for (const [phase, asset] of Object.entries(phases)) {
  const metrics = fixture.phases[phase];
  assert.equal(metrics.sha256, hash(readFileSync(new URL(`../public${asset.src}`, import.meta.url))));
  assert.ok(metrics.seam <= metrics.referenceSeam * 1.25 + .15, `${phase}: seam exceeds normal motion`);
  assert.equal(metrics.fps, phase === 'night' ? 30 : 24);
  if (metrics.sourcePath) assert.equal(metrics.sourceSha256, hash(readFileSync(new URL(`../public${metrics.sourcePath}`, import.meta.url))));
  assert.ok(metrics.duration >= 8, `${phase}: avoid frequent decoder wraps`);
  assert.equal(metrics.frames % metrics.cycleFrames, 0);
 }
});

test('night retains a continuous long section instead of repeating subsecond snippets', () => {
 const {night} = JSON.parse(readFileSync(new URL('./fixtures/video-loop-metrics.json', import.meta.url), 'utf8')).phases;
 assert.equal(night.repetitions, 1);
 assert.equal(night.cycleFrames, night.frames);
 assert.ok(night.cycleFrames / night.fps >= 19);
 assert.equal(night.sourcePath, '/media/sources/bundaran-hi-night-original.mp4');
 assert.ok(night.oneSecondDifference > 1, 'decoded pictures must not return to the same frame every second');
 assert.ok((night.sourceEndFrame - night.sourceStartFrame) / night.fps >= 20);
});

test('new morning and evening uploads keep their assigned phase and a full continuous cycle', () => {
 const fixture = JSON.parse(readFileSync(new URL('./fixtures/video-loop-metrics.json', import.meta.url), 'utf8'));
 const uploads = {
  morning: '3f8228e8da06f87a41ba9f97361dad4a32f760b2bee04f117cbcefde8fc2db86',
  evening: 'd7ac124afd0ab58da6df4c0685c7873dbdeb19862268a8b68355185e684ba610',
 };
 for (const [phase, hash] of Object.entries(uploads)) {
  const metrics = fixture.phases[phase];
  assert.equal(metrics.sourceSha256, hash, `${phase}: wrong uploaded source`);
  assert.equal(metrics.repetitions, 1);
  assert.equal(metrics.cycleFrames, metrics.frames);
  assert.equal(metrics.duration, 8.5);
  assert.equal(metrics.sourceStartFrame, 0);
  assert.equal(metrics.sourceEndFrame, 240);
  assert.equal(metrics.stabilized, true);
 }
});

test('evening background remains aligned throughout the exported dissolve', () => {
 const { evening } = JSON.parse(readFileSync(new URL('./fixtures/video-loop-metrics.json', import.meta.url), 'utf8')).phases;
 assert.equal(evening.backgroundContinuity.checkedFrames, evening.frames, 'inspect every decoded frame, including the overlap');
 assert.ok(evening.backgroundContinuity.minimumMatches >= 80);
 assert.ok(evening.backgroundContinuity.maxMedianDisplacementPixels <= 2, 'background must not tilt or jump during the dissolve');
});
