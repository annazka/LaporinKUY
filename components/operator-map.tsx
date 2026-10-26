'use client';
import {useEffect,useRef,useState} from 'react';
import type {Map as LeafletMap} from 'leaflet';
import type {Report} from '@/lib/types';
import {isOverdue,missingDailyUpdate,validCoordinates} from '@/lib/rules.mjs';
export function OperatorMap({reports,onSelect}:{reports:Report[];onSelect:(id:string)=>void}){
 const canvas=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null);
 const [library,setLibrary]=useState<typeof import('leaflet')|null>(null),[error,setError]=useState('');
 useEffect(()=>{let disposed=false;import('leaflet').then(L=>{
  if(disposed||!canvas.current)return;
  map.current=L.map(canvas.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([-6.2,106.83],11);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',maxZoom:19}).on('tileerror',()=>{if(!disposed)setError('Sebagian latar peta belum dapat dimuat. Daftar laporan tetap tersedia.');}).addTo(map.current);
  setLibrary(L);
 }).catch(()=>setError('Peta belum dapat dimuat. Gunakan daftar laporan di samping.'));
 return()=>{disposed=true;map.current?.remove();map.current=null;};},[]);
 useEffect(()=>{
  if(!library||!map.current)return;
  const group=library.layerGroup().addTo(map.current);
  const located=reports.filter(r=>validCoordinates(r.latitude,r.longitude));
  for(const r of located){
   const color=isOverdue(r)?'#ff7b72':missingDailyUpdate(r)||r.status==='submitted'?'#f2cc60':r.status==='completed'?'#7ee787':'#79c0ff';
   const marker=library.marker([r.latitude,r.longitude],{title:r.title,alt:`Pilih laporan ${r.title}`,icon:library.divIcon({className:'admin-map-marker',html:`<span style="background:${color}"></span>`,iconSize:[26,26],iconAnchor:[13,13]})});
   marker.on('click',()=>onSelect(r.id)).addTo(group);
  }
  if(located.length)map.current.fitBounds(library.latLngBounds(located.map(r=>[r.latitude,r.longitude] as [number,number])),{padding:[35,35],maxZoom:14,animate:false});
  return()=>{group.remove();};
 },[reports,library,onSelect]);
 return <div className="admin-map-wrap"><div ref={canvas} className="admin-map" role="region" aria-label="Peta kendali laporan Jakarta"/>{error&&<p role="status">{error}</p>}</div>;
}
