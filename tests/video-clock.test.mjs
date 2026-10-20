import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {anchors, videoClock, secondsInJakarta} from '../lib/video-clock.mjs';
const at = seconds => new Date(Date.parse('2026-10-20T00:00:00+07:00') + seconds * 1000);

test('uses Jakarta time, including fractional seconds, regardless of host timezone', () => {
 assert.equal(secondsInJakarta(new Date('2026-10-20T00:30:45.125Z')), 7 * 3600 + 30 * 60 + 45.125);
 assert.equal(secondsInJakarta(new Date('2026-10-19T17:00:00Z')), 0);
});
test('honors every supplied clock/video anchor and fills equal-value gaps without jumps', () => {
 for (const [seconds, expected] of anchors.slice(0, -1)) assert.equal(videoClock(at(seconds)).position, expected);
 for (const [hour, expected] of [[4.5,2],[9.5,6],[15.5,9]]) assert.equal(videoClock(at(hour * 3600)).position, expected);
});
test('is monotonic and continuous at every boundary, with no end-of-stream seek', () => {
 let previous = 0;
 for (let second = 0; second < 86400; second++) {
  const state = videoClock(at(second));
  assert.ok(state.position >= previous);
  assert.ok(state.position - previous < .002);
  assert.ok(state.time >= 0 && state.time <= 10 - 1 / 24);
  previous = state.position;
 }
 for (const [second] of anchors.slice(1, -1)) {
  assert.ok(Math.abs(videoClock(at(second + .001)).position - videoClock(at(second - .001)).position) < .000001);
 }
});
test('honors seconds during interpolation and scales safely to the actual stream duration', () => {
 assert.ok(videoClock(at(7 * 3600 + 1)).time > videoClock(at(7 * 3600)).time);
 assert.equal(videoClock(at(7 * 3600), 20).time, 8);
 assert.equal(videoClock(at(7 * 3600), NaN).time, 4);
});
test('midnight blends completely to the first frame before resetting the clock', () => {
 assert.equal(videoClock(at(86340)).midnightBlend, 0);
 assert.equal(videoClock(at(86370)).midnightBlend, .5);
 assert.ok(videoClock(at(86399.999)).midnightBlend > .99999999);
 assert.equal(videoClock(at(86400)).time, 0);
 assert.equal(videoClock(at(86400)).midnightBlend, 0);
});
test('interface tokens remain monochrome without a clock-driven palette script', () => {
 const css = readFileSync(new URL('../app/time-palette.css', import.meta.url), 'utf8');
 const colors = [...css.matchAll(/#[a-f\d]{3,8}\b|oklch\([^)]+\)/gi)].map(x => x[0]);
 for (const color of colors) {
  if (color.startsWith('#')) assert.match(color, /^#(?:([a-f\d])\1\1|([a-f\d]{2})\2\2)$/i);
  else assert.match(color, /^oklch\([\d.]+% 0 0\)$/);
 }
 const layout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
 assert.ok(!layout.includes('timePaletteBootstrap'));
});
