'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap,TileLayer} from 'leaflet';
import type {Report} from '@/lib/types';
import {isOverdue,missingDailyUpdate,validCoordinates} from '@/lib/rules.mjs';
const source={url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',className:'admin-map-osm',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'};
export function OperatorMap(props:{reports:Report[];onSelect:(id:string)=>void}){
 const [attempt,setAttempt]=useState(0);
 return <MapCanvas key={attempt} {...props} onRetry={()=>setAttempt(value=>value+1)}/>;
}
function MapCanvas({reports,onSelect,onRetry}:{reports:Report[];onSelect:(id:string)=>void;onRetry:()=>void}){
 const canvas=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null);
 const [library,setLibrary]=useState<typeof import('leaflet')|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  let disposed=false,observer:ResizeObserver|undefined;
  import('leaflet').then(L=>{
   if(disposed||!canvas.current)return;
   const instance=L.map(canvas.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([-6.2,106.83],11);
   map.current=instance;
   observer=new ResizeObserver(()=>{if(!disposed)instance.invalidateSize({animate:false});});observer.observe(canvas.current);
   setLibrary(L);
  }).catch(()=>{if(!disposed){setLoading(false);setError('Peta belum dapat dimuat. Daftar laporan tetap tersedia.');}});
  return()=>{disposed=true;observer?.disconnect();map.current?.stop();map.current?.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  if(!library||!map.current)return;
  const group=library.layerGroup().addTo(map.current);
  const located=reports.filter(r=>validCoordinates(r.latitude,r.longitude));
  for(const r of located){
   const color=isOverdue(r)?'#d89d9d':missingDailyUpdate(r)||r.status==='submitted'?'#dcc68f':r.status==='completed'?'#a9c8b3':'#aec5d7';
   const marker=library.marker([r.latitude,r.longitude],{title:r.title,alt:`Pilih laporan ${r.title}`,icon:library.divIcon({className:'admin-map-marker',html:`<span style="background:${color}"></span>`,iconSize:[26,26],iconAnchor:[13,13]})});
   marker.on('click',()=>onSelect(r.id)).addTo(group);
  }
  if(located.length)map.current.fitBounds(library.latLngBounds(located.map(r=>[r.latitude,r.longitude] as [number,number])),{padding:[35,35],maxZoom:14,animate:false});
  return()=>{group.remove();};
 },[reports,library,onSelect]);
 useEffect(()=>{
  if(!library||!map.current)return;
  let disposed=false,layer:TileLayer|undefined,deadline:ReturnType<typeof setTimeout>|undefined;
  const clearTimers=()=>{clearTimeout(deadline);};
  const start=()=>{
   if(disposed||!map.current)return;
   clearTimers();const previous=layer;layer=undefined;previous?.remove();previous?.off();setError('');setLoading(true);
   const current=library.tileLayer(source.url,{...source,maxZoom:19});layer=current;
   let successes=0,failures=0;
   const active=()=>!disposed&&layer===current;
   const fail=()=>{
    if(!active())return;
    setLoading(false);setError(successes?'Sebagian peta belum termuat. Coba lagi.':'Peta belum dapat dimuat. Daftar laporan tetap tersedia.');
   };
   const watch=()=>{clearTimeout(deadline);deadline=setTimeout(fail,12000);};
   current.on('loading',()=>{if(active()){successes=0;failures=0;setLoading(true);watch();}});
   current.on('tileload',()=>{if(active()){successes++;setLoading(false);setError('');}});
   current.on('tileerror',()=>{if(active())failures++;});
   current.on('load',()=>{
    if(!active())return;clearTimeout(deadline);
    if(failures||!successes)fail();else{setLoading(false);setError('');}
   });
   watch();current.addTo(map.current);
  };
  start();
  return()=>{disposed=true;clearTimers();layer?.remove();layer?.off();};
 },[library]);
 const center=map.current?.getCenter();
 const external=`https://www.openstreetmap.org/#map=${map.current?.getZoom()||11}/${center?.lat||-6.2}/${center?.lng||106.83}`;
 return <div className="admin-map-wrap"><div ref={canvas} className="admin-map" role="region" aria-label="Peta kendali laporan Jakarta"/>
 {loading&&!error&&<p className="admin-map-message" role="status">Memuat peta…</p>}
 {error&&<div className="admin-map-message" role="alert"><p>{error}</p><button className="btn-secondary btn-sm" onClick={onRetry}>Coba lagi</button><a href={external} target="_blank" rel="noreferrer">Buka OpenStreetMap</a></div>}
 </div>;
}
