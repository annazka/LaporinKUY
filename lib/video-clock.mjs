/** @typedef {'night' | 'morning' | 'day' | 'evening'} Phase */
export const phases = {
 night: {src: '/media/phases/night.mp4?v=20261022-no-edge-warp1', poster: '/media/phases/night.jpg?v=20261022-no-edge-warp1'},
 morning: {src: '/media/phases/morning.mp4?v=20261022-no-edge-warp1', poster: '/media/phases/morning.jpg?v=20261022-no-edge-warp1'},
 day: {src: '/media/phases/day.mp4?v=20261022-no-edge-warp1', poster: '/media/phases/day.jpg?v=20261022-no-edge-warp1'},
 evening: {src: '/media/phases/evening.mp4?v=20261023-evening-fixed-view2', poster: '/media/phases/evening.jpg?v=20261023-evening-fixed-view2'},
};
const formatter = new Intl.DateTimeFormat('en-GB', {
 timeZone: 'Asia/Jakarta', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const smoothstep = t => t * t * (3 - 2 * t);
export function secondsInJakarta(date) {
 const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
 return Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second) + date.getUTCMilliseconds() / 1000;
}
/** WIB chooses the scene mix; each scene's motion independently plays at 1x.
 * @returns {{from: Phase, to: Phase, amount: number}}
 */
export function phaseClock(date = new Date(), transitionSeconds = 7200) {
 if (!Number.isFinite(transitionSeconds) || transitionSeconds <= 0 || transitionSeconds > 7200) throw new RangeError('Invalid transition duration');
 const seconds = secondsInJakarta(date);
 /** @type {[number, Phase, Phase][]} */
 const transitions = [[5, 'night', 'morning'], [10, 'morning', 'day'],
  [15, 'day', 'evening'], [18, 'evening', 'night']];
 for (const [hour, from, to] of transitions) {
  const start = hour * 3600 - transitionSeconds / 2, end = hour * 3600 + transitionSeconds / 2;
  if (seconds >= start && seconds < end) return {from, to, amount: smoothstep((seconds - start) / (end - start))};
 }
 const phase = seconds < 5 * 3600 || seconds >= 18 * 3600 ? 'night'
  : seconds < 10 * 3600 ? 'morning' : seconds < 15 * 3600 ? 'day' : 'evening';
 return {from: phase, to: phase, amount: 0};
}
