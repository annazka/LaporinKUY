'use client';
import {useEffect, useRef, useState} from 'react';
import {videoClock} from '@/lib/video-clock.mjs';

export function LandingVideo() {
 const layer = useRef<HTMLDivElement>(null);
 const video = useRef<HTMLVideoElement>(null);
 const frozen = useRef(false);
 const sync = useRef<() => void>(() => {});
 const [paused, setPaused] = useState(false);
 const [ready, setReady] = useState(false);
 const [failed, setFailed] = useState(false);

 useEffect(() => {
  const film = video.current;
  if (!film) return;
  let scrollFrame = 0;
  let decoded = false;
  let requestedFrame = -1;
  const reveal = () => { decoded = true; setReady(true); setFailed(false); };
  const update = () => {
   // A preload can fail before hydration attaches the source's error listener.
   if (film.error || film.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
    setFailed(true);
    return;
   }
   if (frozen.current || document.hidden || film.readyState < 1 || film.seeking) return;
   const {time, midnightBlend} = videoClock(new Date(), film.duration);
   // Sample the actual clock. Never accumulate elapsed time or call play().
   // Seek only when a different encoded frame is needed.
   // Browsers round currentTime to microseconds. Remember the requested frame
   // instead of comparing rounded timestamps, which can trigger endless seeks.
   const nextFrame = Math.floor(time * 24);
   if (requestedFrame !== nextFrame) {
    requestedFrame = nextFrame;
    film.currentTime = time;
   }
   else if (film.readyState >= 2 && !decoded) reveal();
   // Keep the midnight bridge visible until the seek to frame zero finishes.
   if (!film.seeking) layer.current?.style.setProperty('--midnight-blend', String(midnightBlend));
  };
  sync.current = update;
  const seeked = () => {
   update();
   if (!film.seeking && film.readyState >= 2) reveal();
  };
  const scroll = () => {
   if (scrollFrame) return;
   scrollFrame = requestAnimationFrame(() => {
    const amount = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1);
    layer.current?.style.setProperty('--video-blur', `${amount * 12}px`);
    layer.current?.style.setProperty('--video-shade', `${.68 + amount * .20}`);
    scrollFrame = 0;
   });
  };
  const resume = () => { if (!document.hidden) update(); };
  film.addEventListener('loadedmetadata', update);
  film.addEventListener('loadeddata', update);
  film.addEventListener('seeked', seeked);
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('scroll', scroll, {passive: true});
  const timer = window.setInterval(update, 1000);
  update(); scroll();
  return () => {
   window.clearInterval(timer); cancelAnimationFrame(scrollFrame);
   film.removeEventListener('loadedmetadata', update);
   film.removeEventListener('loadeddata', update);
   film.removeEventListener('seeked', seeked);
   document.removeEventListener('visibilitychange', resume);
   window.removeEventListener('focus', resume);
   window.removeEventListener('pageshow', resume);
   window.removeEventListener('scroll', scroll);
   sync.current = () => {};
  };
 }, []);

 function toggle() {
  frozen.current = !frozen.current;
  setPaused(frozen.current);
  if (!frozen.current) sync.current();
 }

 return <>
  <div ref={layer} className={`landing-film${ready && !failed ? ' is-ready' : ''}`} aria-hidden="true">
   <video ref={video} muted playsInline preload="auto" onError={() => setFailed(true)}>
    <source src="/media/bundaran-hi-wib.mp4" type="video/mp4" onError={() => setFailed(true)}/>
   </video>
   {/* Matching first frame bridges the midnight wrap without normal playback. */}
   {ready && !failed && <img className="film-midnight" src="/media/bundaran-hi-midnight.png" alt=""/>}
   <div className="film-shade"/>
  </div>
  <button type="button" className="film-control" onClick={toggle} disabled={failed || !ready}
   aria-pressed={paused}>
   {failed ? 'Video tidak tersedia' : !ready ? 'Menyiapkan latar…' : paused ? 'Ikuti waktu WIB' : 'Bekukan latar'}
  </button>
 </>;
}
