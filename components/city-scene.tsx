import {MapPin,Check,ScanLine,ArrowUpRight,Navigation} from 'lucide-react';

const heights=[44,76,112,65,142,98,74,126,62,94,48,82];
export function CityScene(){return <div className="city-scene" aria-label="Ilustrasi Jakarta malam dengan contoh pelacakan laporan">
 <div className="scene-ambience" aria-hidden="true"><div className="scene-orbit orbit-one"/><div className="scene-orbit orbit-two"/><div className="scene-moon"/></div>
 <div className="scene-caption"><span className="live-dot"/> JAKARTA, KOTA YANG KITA JAGA <span>06°12′ S · 106°50′ E</span></div>
 <div className="skyline" aria-hidden="true">{heights.map((h,i)=><div key={i} className={`building building-${i%3}`} style={{height:h,animationDelay:`${i*-.7}s`}}/>)}<div className="monas"><i className="monas-flame"/><i className="monas-shaft"/><i className="monas-platform"/><i className="monas-base"/></div></div>
 <div className="city-ground" aria-hidden="true"><div className="ground-road road-a"/><div className="ground-road road-b"/><div className="ground-route"/><div className="ground-point point-a"/><div className="ground-point point-b"/></div>
 <div className="scene-card scene-report"><div className="scene-card-icon"><MapPin size={20}/></div><div><span>LAPORAN WARGA</span><strong>Jalan berlubang</strong><small><i/> Bukti diterima operator</small></div><ArrowUpRight size={17}/></div>
 <div className="scene-card scene-ai"><ScanLine size={18}/><div><strong>Analisis foto dengan AI</strong><small>Rekomendasi untuk operator</small></div><span className="signal-bars"><i/><i/><i/><i/></span></div>
 <div className="scene-card scene-complete"><div className="complete-ring"><Check size={20}/></div><div><span>PERBAIKAN TERVERIFIKASI</span><strong>Lebih aman dilewati.</strong></div></div>
 <div className="scene-pin pin-a" aria-hidden="true"><MapPin size={22}/></div><div className="scene-pin pin-b" aria-hidden="true"><Navigation size={17}/></div>
 <div className="scene-bottom"><span><span className="live-dot"/> Visualisasi alur laporan</span><span>ILUSTRASI, BUKAN PETA AKTUAL</span></div>
 </div>;}
