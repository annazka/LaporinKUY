import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
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
