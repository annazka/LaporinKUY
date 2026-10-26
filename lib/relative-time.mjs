/** Compact elapsed time; months use 30 days and years use 365 days. */
export function relativeTime(createdAt, now = Date.now()) {
 const created = Date.parse(createdAt);
 if (!Number.isFinite(created) || !Number.isFinite(now)) return 'Waktu belum tersedia';
 const elapsed = Math.max(0, now - created);
 for (const [duration, suffix] of [[365*86400000,'y'],[30*86400000,'M'],[86400000,'d'],[3600000,'h'],[60000,'m']]) {
  if (elapsed >= duration) return `${Math.floor(elapsed / duration)}${suffix} ago`;
 }
 return '0m ago';
}
