'use client';

import {useEffect} from 'react';
import {usePathname} from 'next/navigation';

export function VisualEffects(){
 const pathname=usePathname();
 useEffect(()=>{
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  if(media.matches)return;
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
  },{threshold:0.08,rootMargin:'0px 0px -20px 0px'});
  const targets=document.querySelectorAll('.landing .reveal');
  targets.forEach(el=>{const box=el.getBoundingClientRect();if(box.top>window.innerHeight){el.classList.add('reveal-ready');observer.observe(el);}else{el.classList.add('is-visible');}});
  let frame=0;
  const move=(event:PointerEvent)=>{
   if(event.pointerType!=='mouse'||frame)return;
   const x=event.clientX,y=event.clientY,target=event.target;
   frame=requestAnimationFrame(()=>{
    frame=0;
    if(!(target instanceof Element))return;
    const card=target.closest<HTMLElement>('.report-card,.panel,.feature-card,.stat-card,.demo-stage,.voucher-card,.step-choice');
    if(card&&!card.closest('.plain-landing')){const b=card.getBoundingClientRect();card.style.setProperty('--mouse-x',`${x-b.left}px`);card.style.setProperty('--mouse-y',`${y-b.top}px`);}
    const stage=target.closest<HTMLElement>('.city-scene');
    if(stage){const b=stage.getBoundingClientRect();stage.style.setProperty('--tilt-x',`${((y-b.top)/b.height-.5)*-5}deg`);stage.style.setProperty('--tilt-y',`${((x-b.left)/b.width-.5)*5}deg`);}
   });
  };
  document.addEventListener('pointermove',move,{passive:true});
  return()=>{observer.disconnect();cancelAnimationFrame(frame);document.removeEventListener('pointermove',move);targets.forEach(el=>el.classList.remove('reveal-ready'));};
 },[pathname]);
 return null;
}
