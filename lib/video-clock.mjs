const formatter = new Intl.DateTimeFormat('en-GB', {
 timeZone: 'Asia/Jakarta', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const smoothstep = t => t * t * (3 - 2 * t);
export const DAY_SECONDS = 86400;
// Equal timestamps hold the frame across reference gaps. Smoothstep gives zero
// velocity on both sides of every join, including the end and start of the day.
export const anchors = [
 [0, 0], [4 * 3600, 2], [5 * 3600, 2], [9 * 3600, 6],
 [10 * 3600, 6], [15 * 3600, 9], [16 * 3600, 9], [DAY_SECONDS - 60, 10], [DAY_SECONDS, 10],
];
export function secondsInJakarta(date) {
 const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
 return Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second) + date.getUTCMilliseconds() / 1000;
}
export function videoClock(date = new Date(), duration = 10) {
 const seconds = secondsInJakarta(date);
 const index = anchors.findIndex((point, i) => i > 0 && seconds < point[0]);
 const [start, from] = anchors[index - 1];
 const [end, to] = anchors[index];
 const position = from + (to - from) * smoothstep((seconds - start) / (end - start));
 const length = Number.isFinite(duration) && duration > 0 ? duration : 10;
 // The last encoded frame is at 9.958s, before the end-of-stream timestamp.
 const time = Math.min(position / 10 * length, Math.max(0, length - 1 / 24));
 // Blend the final minute into the first frame; midnight then seeks beneath an
 // identical image rather than showing a cut between the two endpoint frames.
 const midnightBlend = seconds >= DAY_SECONDS - 60 ? smoothstep((seconds - (DAY_SECONDS - 60)) / 60) : 0;
 return {time, position, midnightBlend};
}
