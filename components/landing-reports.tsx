'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {ArrowUpRight,CameraOff,Clock3,LayoutGrid,MapPin,Pause,Play,Search,Rows3} from 'lucide-react';
import {formatDate,statusLabels,type Report} from '@/lib/types';
import {isOverdue} from '@/lib/rules.mjs';

function ReportPreview({report}:{report:Report}){
 const [failed,setFailed]=useState(false);
 return <div className="landing-report-photo">{failed||!report.photo_path?
  <div className="report-photo-unavailable"><CameraOff size={26}/><span>Foto belum tersedia</span></div>:
  <img src={`/api/report-preview/${report.id}`} alt={`Kondisi kerusakan: ${report.title}`} width={640} height={400} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>
 }</div>;
}

function ReportSlide({report:r,duplicate=false}:{report:Report;duplicate?:boolean}){
 const overdue=isOverdue(r);
 return <Link href={`/reports/${r.id}`} className="landing-report-card" tabIndex={duplicate?-1:undefined}>
  <div className="landing-report-visual"><ReportPreview key={r.photo_path} report={r}/><span className={`badge ${overdue?'danger':r.status==='completed'?'success':'neutral'}`}>{overdue?'Terlambat':statusLabels[r.status]||r.status}</span></div>
  <div className="landing-report-body"><span className="small-label">{r.category} · #{r.id.slice(0,6).toUpperCase()}</span><h3>{r.title}</h3><p className="address"><MapPin size={14}/>{r.address}</p><div className="progress-track"><span style={{width:`${r.progress}%`}}/></div><div className="report-meta"><span>{r.progress}% progres</span><span>{r.support_count+1} pelapor</span></div><div className="report-bottom"><span><Clock3 size={14}/>{r.target_date?`Target ${formatDate(r.target_date)}`:'Menunggu estimasi'}</span><ArrowUpRight size={18}/></div></div>
 </Link>;
}

function ReportLoop({reports,paused,onPause}:{reports:Report[];paused:boolean;onPause:()=>void}){
 const viewport=useRef<HTMLDivElement>(null),track=useRef<HTMLDivElement>(null),group=useRef<HTMLDivElement>(null);
 const position=useRef(0),active=useRef(false);
 const [copies,setCopies]=useState(1);
 useEffect(()=>{
  const box=viewport.current,first=group.current,rail=track.current;
  if(!box||!first||!rail)return;
  let width=0,visible=false,hovered=false,focused=false,touched=false,previous=0,frame=0;
  const measure=()=>{
   const card=first.querySelector<HTMLElement>('.landing-report-card');
   if(!card)return;
   const gap=20,cardWidth=card.getBoundingClientRect().width;
   // Each equal group must fill the viewport, including a single real report.
   setCopies(Math.max(1,Math.ceil((box.clientWidth+gap)/((cardWidth+gap)*reports.length))));
   width=first.getBoundingClientRect().width;
   if(width)position.current%=width;
  };
  const updateActive=()=>{active.current=visible&&!document.hidden&&!hovered&&!focused&&!touched;};
  const enter=()=>{hovered=true;updateActive();},leave=()=>{hovered=false;updateActive();};
  const focus=()=>{
   focused=true;updateActive();
   const card=document.activeElement?.closest<HTMLElement>('.landing-report-card');
   if(card&&width){
    const bounds=card.getBoundingClientRect(),view=box.getBoundingClientRect();
    if(bounds.left<view.left||bounds.right>view.right){
     const left=bounds.left-view.left+position.current+box.scrollLeft;
     position.current=Math.max(0,Math.min(left,width-box.clientWidth));
     rail.style.transform=`translate3d(${-position.current}px,0,0)`;
    }
    box.scrollLeft=0;
   }
  };
  const blur=(event:FocusEvent)=>{if(!box.contains(event.relatedTarget as Node)){focused=false;updateActive();}};
  const touch=()=>{touched=true;updateActive();},release=()=>{touched=false;updateActive();};
  const visibility=()=>{previous=0;updateActive();};
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;previous=0;updateActive();});observer.observe(box);
  const resize=new ResizeObserver(measure);resize.observe(box);resize.observe(first);measure();
  box.addEventListener('mouseenter',enter);box.addEventListener('mouseleave',leave);box.addEventListener('focusin',focus);box.addEventListener('focusout',blur);box.addEventListener('touchstart',touch,{passive:true});window.addEventListener('touchend',release);window.addEventListener('touchcancel',release);document.addEventListener('visibilitychange',visibility);
  const tick=(now:number)=>{
   const delta=previous?Math.min(now-previous,64):0;previous=now;
   if(active.current&&!paused&&width>0){position.current=(position.current+delta*.025)%width;rail.style.transform=`translate3d(${-position.current}px,0,0)`;}
   frame=requestAnimationFrame(tick);
  };frame=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();box.removeEventListener('mouseenter',enter);box.removeEventListener('mouseleave',leave);box.removeEventListener('focusin',focus);box.removeEventListener('focusout',blur);box.removeEventListener('touchstart',touch);window.removeEventListener('touchend',release);window.removeEventListener('touchcancel',release);document.removeEventListener('visibilitychange',visibility);};
 },[reports.length,paused]);
 return <div ref={viewport} className="report-loop" role="region" aria-label="Slider laporan warga" aria-roledescription="karusel" onKeyDown={event=>{if(event.key==='Escape')onPause();}}>
  <div ref={track} className="report-loop-track" style={{'--report-count':reports.length} as CSSProperties}>
   {[0,1].map(duplicate=><div ref={duplicate?undefined:group} className="report-loop-group" key={duplicate} aria-hidden={duplicate?true:undefined}>
    {Array.from({length:copies},(_,copy)=><div className="report-loop-copy" key={copy} aria-hidden={copy?true:undefined}>{reports.map(report=><ReportSlide key={report.id} report={report} duplicate={Boolean(duplicate||copy)}/>)}</div>)}
   </div>)}
  </div>
 </div>;
}

export function LandingReports({reports}:{reports:Report[]}){
 const [query,setQuery]=useState(''),[status,setStatus]=useState('all'),[list,setList]=useState(false),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const filtered=useMemo(()=>reports.filter(r=>(status==='all'||r.status===status)&&`${r.title} ${r.address}`.toLocaleLowerCase('id-ID').includes(query.trim().toLocaleLowerCase('id-ID'))),[reports,status,query]);
 const showList=list||reduced;
 return <div className="landing-reports">
  <div className="filter-bar landing-report-filters"><label className="search"><Search size={18}/><input aria-label="Cari laporan" placeholder="Cari laporan atau lokasi..." value={query} onChange={event=>setQuery(event.target.value)}/></label><select aria-label="Filter status" value={status} onChange={event=>setStatus(event.target.value)}><option value="all">Semua status</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
  <div className="landing-report-toolbar"><p role="status">{filtered.length} laporan{query||status!=='all'?' ditemukan':''}</p><div>{!showList&&filtered.length>0&&<button className="report-view-button" type="button" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?<Play size={14}/>:<Pause size={14}/>}<span>{paused?'Putar slider':'Jeda slider'}</span></button>}{!reduced&&<button className="report-view-button" type="button" aria-pressed={list} onClick={()=>setList(!list)}>{list?<Rows3 size={15}/>:<LayoutGrid size={15}/>}<span>{list?'Tampilan slider':'Lihat semua laporan'}</span></button>}</div></div>
  {filtered.length===0?<div className="empty"><h3>{reports.length?'Tidak ada laporan yang cocok':'Mulai perubahan pertama.'}</h3><p>{reports.length?'Coba ubah pencarian atau filter status.':'Laporan warga akan tampil di sini setelah dikirim.'}</p>{reports.length>0&&<button type="button" className="text-button" onClick={()=>{setQuery('');setStatus('all');}}>Hapus filter</button>}</div>:showList?<div className="landing-report-grid">{filtered.map(report=><ReportSlide key={report.id} report={report}/>)}</div>:<ReportLoop key={filtered.map(r=>r.id).join(',')} reports={filtered} paused={paused} onPause={()=>setPaused(true)}/>}
 </div>;
}
