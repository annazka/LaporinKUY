'use client';
import {useEffect,useRef,useState} from 'react';
export function LandingVideo(){
 const layer=useRef<HTMLDivElement>(null),video=useRef<HTMLVideoElement>(null);
 const [paused,setPaused]=useState(true),[failed,setFailed]=useState(false);
 useEffect(()=>{let frame=0;const update=()=>{const amount=Math.min(window.scrollY/Math.max(window.innerHeight,1),1);layer.current?.style.setProperty('--video-blur',`${amount*12}px`);layer.current?.style.setProperty('--video-shade',`${.38+amount*.43}`);frame=0;};const scroll=()=>{if(!frame)frame=requestAnimationFrame(update);};update();window.addEventListener('scroll',scroll,{passive:true});return()=>{window.removeEventListener('scroll',scroll);cancelAnimationFrame(frame);};},[]);
 async function toggle(){if(!video.current)return;if(paused){try{await video.current.play();setPaused(false);}catch{setFailed(true);}}else{video.current.pause();setPaused(true);}}
 return <><div ref={layer} className="landing-film" aria-hidden="true"><video ref={video} autoPlay muted loop playsInline preload="metadata" poster="/media/bundaran-hi.jpg" onError={()=>setFailed(true)} onPlay={()=>{setPaused(false);setFailed(false);}} onPause={()=>setPaused(true)}><source src="/media/bundaran-hi.mp4" type="video/mp4"/></video><div className="film-shade"/></div><button type="button" className="film-control" onClick={toggle} aria-label={paused?'Putar video latar':'Jeda video latar'}>{failed?'Video tidak tersedia':paused?'Putar video':'Jeda video'}</button></>;
}
