'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {phaseClock, phases} from '@/lib/video-clock.mjs';

type Phase = keyof typeof phases;
type Status = {ready: boolean; failed: boolean; blocked: boolean};
type Report = (phase: Phase, update: Partial<Status>) => void;

function PhaseVideo({phase, opacity, paused, attempt, report}: {
 phase: Phase; opacity: number | string; paused: boolean; attempt: number; report: Report;
}) {
 const video = useRef<HTMLVideoElement>(null);
 const [ready, setReady] = useState(false);
 useEffect(() => {
  const film = video.current;
  if (!film) return;
  let disposed = false;
  const loaded = () => {
   if (film.readyState >= 2 && !film.error) {
    setReady(true);
    report(phase, {ready: true, failed: false});
   }
  };
  const failure = () => {
   setReady(false);
   report(phase, {ready: false, failed: true, blocked: false});
  };
  const playing = () => { loaded(); report(phase, {blocked: false}); };
  const play = () => {
   // Preloads can fail before hydration attaches their error listeners.
   if (film.error || film.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) { failure(); return; }
   if (paused || document.hidden) { film.pause(); return; }
   film.play().catch(error => {
    if (disposed || error.name === 'AbortError') return;
    if (error.name === 'NotAllowedError') report(phase, {blocked: true});
    else failure();
   });
  };
  const source = film.querySelector('source');
  film.addEventListener('loadeddata', loaded);
  film.addEventListener('playing', playing);
  film.addEventListener('error', failure);
  source?.addEventListener('error', failure);
  document.addEventListener('visibilitychange', play);
  window.addEventListener('pageshow', play);
  loaded(); play();
  return () => {
   disposed = true;
   film.removeEventListener('loadeddata', loaded);
   film.removeEventListener('playing', playing);
   film.removeEventListener('error', failure);
   source?.removeEventListener('error', failure);
   document.removeEventListener('visibilitychange', play);
   window.removeEventListener('pageshow', play);
   film.pause();
  };
 }, [phase, paused, attempt, report]);

 return <div className={`film-phase${ready ? ' is-ready' : ''}`} data-phase={phase} style={{opacity}}>
  <img src={phases[phase].poster} alt=""/>
  <video ref={video} autoPlay={!paused} muted loop playsInline preload="auto" disablePictureInPicture poster={phases[phase].poster}>
   <source src={phases[phase].src} type="video/mp4"/>
  </video>
 </div>;
}

export function LandingVideo() {
 const layer = useRef<HTMLDivElement>(null);
 const [clock, setClock] = useState<ReturnType<typeof phaseClock> | null>(null);
 const [paused, setPaused] = useState(false);
 const [attempt, setAttempt] = useState(0);
 const [statuses, setStatuses] = useState<Partial<Record<Phase, Status>>>({});
 const report = useCallback<Report>((phase, update) => {
  setStatuses(previous => {
   const status = {...{ready: false, failed: false, blocked: false}, ...previous[phase], ...update};
   if (previous[phase] && Object.entries(status).every(([key, value]) => previous[phase]?.[key as keyof Status] === value)) return previous;
   return {...previous, [phase]: status};
  });
 }, []);

 useEffect(() => {
  let frame = 0, clockFrame = 0, lastTick = -Infinity, pair = '';
  const update = () => {
   if (document.hidden) return;
   const next = phaseClock(new Date(), 12);
   // Sample actual WIB at display cadence. Only change React's layer set when
   // the phase pair changes, so the playing decoders keep their current frame.
   layer.current?.style.setProperty('--phase-mix', String(next.amount));
   const nextPair = `${next.from}:${next.to}`;
   if (nextPair !== pair) { pair = nextPair; setClock(next); }
  };
  const tick = (timestamp: number) => {
   clockFrame = 0;
   if (document.hidden) return;
   if (timestamp - lastTick >= 1000 / 30) { update(); lastTick = timestamp; }
   clockFrame = requestAnimationFrame(tick);
  };
  const resume = () => {
   if (document.hidden) { cancelAnimationFrame(clockFrame); clockFrame = 0; return; }
   update();
   if (!clockFrame) clockFrame = requestAnimationFrame(tick);
  };
  const scroll = () => {
   if (frame) return;
   frame = requestAnimationFrame(() => {
    const amount = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
    layer.current?.style.setProperty('--video-blur', `${amount * 12}px`);
    layer.current?.style.setProperty('--video-shade', `${.48 + amount * .22}`);
    frame = 0;
   });
  };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => setPaused(motion.matches);
  reduce(); resume(); scroll();
  motion.addEventListener('change', reduce);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('scroll', scroll, {passive: true});
  return () => {
   cancelAnimationFrame(clockFrame); cancelAnimationFrame(frame);
   motion.removeEventListener('change', reduce);
   document.removeEventListener('visibilitychange', resume);
   window.removeEventListener('focus', resume);
   window.removeEventListener('pageshow', resume);
   window.removeEventListener('scroll', scroll);
  };
 }, []);

 const active = clock ? clock.from === clock.to ? [clock.from] : [clock.from, clock.to] : [];
 const ready = active.some(phase => statuses[phase]?.ready);
 const failed = active.length > 0 && active.every(phase => statuses[phase]?.failed);
 const blocked = active.some(phase => statuses[phase]?.blocked);
 function toggle() {
  if (paused || blocked) { setPaused(false); setAttempt(value => value + 1); }
  else setPaused(true);
 }
 return <>
  <div ref={layer} className="landing-film" aria-hidden="true">
   {active.map((phase, index) => <PhaseVideo key={phase} phase={phase}
    opacity={index === 0 ? 1 : 'var(--phase-mix,0)'} paused={paused} attempt={attempt} report={report}/>)}
   <div className="film-shade"/>
  </div>
  <button type="button" className="film-control" onClick={toggle} disabled={failed || !ready} aria-pressed={paused}>
   {failed ? 'Video tidak tersedia' : !ready ? 'Menyiapkan latar…' : paused || blocked ? 'Putar video' : 'Jeda video'}
  </button>
 </>;
}
