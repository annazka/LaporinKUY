'use client';

import {useCallback,useRef,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowUpRight,Camera,MapPin,ShieldCheck} from 'lucide-react';
import {PhotoAnalysis,type Analysis} from './photo-analysis';
import {ReportLocationPicker,type ReportLocation} from './report-location-picker';
import {validatePhoto} from '@/lib/photo-analysis-client.mjs';
import {validCoordinates} from '@/lib/rules.mjs';

const categories=['Jalan berlubang','Trotoar','Drainase','Lampu jalan','Fasilitas umum'];
type Draft={category:string;description:string};
export function ReportForm(){
 const router=useRouter(),pending=useRef(false),activePhoto=useRef<File|null>(null),locationRequest=useRef(0);
 const [busy,setBusy]=useState(false),[analysisBusy,setAnalysisBusy]=useState(false),[error,setError]=useState(''),[file,setFile]=useState<File|null>(null),[location,setLocation]=useState<ReportLocation|null>(null),[locationMessage,setLocationMessage]=useState(''),[stage,setStage]=useState('');
 const [draft,setDraft]=useState<Draft>({category:'',description:''});
 const currentDraft=useRef(draft),automatic=useRef<Draft>({category:'',description:''}),edited=useRef({category:false,description:false});
 function edit(field:keyof Draft,value:string){edited.current[field]=true;currentDraft.current={...currentDraft.current,[field]:value};setDraft(currentDraft.current);}
 function pick(next:File|null){
  const invalid=next?validatePhoto(next):null;
  if(invalid)next=null;
  activePhoto.current=next;setFile(next);setError(invalid||'');setStage('');setAnalysisBusy(Boolean(next));
  const previous=currentDraft.current;
  const preserved={category:previous.category===automatic.current.category?'':previous.category,description:previous.description===automatic.current.description?'':previous.description};
  currentDraft.current=preserved;edited.current={category:Boolean(preserved.category),description:Boolean(preserved.description)};automatic.current={category:'',description:''};setDraft(preserved);
 }
 const analyzed=useCallback((result:Analysis,photo:File)=>{
  if(activePhoto.current!==photo||!result.relevant)return;
  const next={...currentDraft.current};
  if(!edited.current.category&&categories.includes(result.category)){next.category=result.category;automatic.current.category=next.category;}
  if(!edited.current.description){next.description=result.summary.trim().slice(0,3000);automatic.current.description=next.description;}
  currentDraft.current=next;setDraft(next);
 },[]);
 const selectLocation=useCallback((point:ReportLocation)=>{locationRequest.current++;setLocation(point);setLocationMessage('Titik laporan dipilih. Periksa kembali alamat dan posisi pin.');},[]);
 function locate(){
  if(!navigator.geolocation){setLocationMessage('Perangkat tidak mendukung lokasi. Geser pin atau klik lokasi pada peta.');return;}
  const request=++locationRequest.current;setLocationMessage('Mencari lokasi...');
  navigator.geolocation.getCurrentPosition(pos=>{
   if(request!==locationRequest.current)return;
   const point={latitude:pos.coords.latitude,longitude:pos.coords.longitude};
   if(!validCoordinates(point.latitude,point.longitude)){setLocationMessage('Lokasi perangkat berada di luar cakupan Jakarta. Pilih titik laporan pada peta.');return;}
   setLocation(point);setLocationMessage('Lokasi perangkat ditandai. Geser pin jika titik kerusakan berada di tempat lain.');
  },()=>{if(request===locationRequest.current)setLocationMessage('Lokasi perangkat belum dapat diakses. Geser pin atau klik titik laporan pada peta.');},{timeout:15000,enableHighAccuracy:true});
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending.current||analysisBusy)return;
  if(!file){setError('Tambahkan foto bukti terlebih dahulu.');return;}
  if(!location||!validCoordinates(location.latitude,location.longitude)){setError('Pilih titik lokasi laporan pada peta terlebih dahulu.');return;}
  const data=Object.fromEntries(new FormData(event.currentTarget).entries());pending.current=true;setBusy(true);setError('');
  try{
   setStage('Mengunggah foto...');const form=new FormData();form.set('file',file);
   const upload=await fetch('/api/upload',{method:'POST',body:form});const photo=await upload.json();if(!upload.ok)throw Error(photo.error||'Foto belum dapat diunggah.');
   setStage('Menyimpan laporan...');const response=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,photo_path:photo.path})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Laporan belum dapat disimpan.');
   router.push(`/reports/${result.id}?submitted=${result.duplicate?'duplicate':'new'}`);router.refresh();
  }catch(cause){setError((cause as Error).message);setStage('');}finally{pending.current=false;setBusy(false);}
 }
 return <form onSubmit={submit} className="report-form">
  <div className="panel form-stack"><div className="form-section-title"><span>01</span><div><h2>Ceritakan kondisinya</h2><p>Unggah foto untuk mengisi kategori dan deskripsi dengan AI.</p></div></div>
   <label className="upload-zone"><Camera size={30}/><strong>{file?file.name:'Tambahkan foto kerusakan'}</strong><span>JPG, PNG, atau WebP. Maksimal 4 MB.</span><input aria-label="Foto kerusakan" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required disabled={busy} onChange={event=>{const selected=event.target.files?.[0]||null;pick(selected);if(selected&&validatePhoto(selected))event.target.value='';}}/></label>
   <PhotoAnalysis file={file} onResult={analyzed} onBusyChange={setAnalysisBusy}/>
   <label>Judul laporan<input name="title" minLength={8} maxLength={140} required disabled={busy} placeholder="Contoh, jalan berlubang di depan halte"/></label>
   <label>Kategori<select name="category" value={draft.category} required disabled={busy} onChange={event=>edit('category',event.target.value)}><option value="" disabled>Pilih kategori atau tunggu hasil AI</option>{categories.map(category=><option key={category}>{category}</option>)}</select></label>
   <label>Deskripsi kerusakan<textarea name="description" value={draft.description} onChange={event=>edit('description',event.target.value)} minLength={20} maxLength={3000} required disabled={busy} rows={4} placeholder="Deskripsi akan diisi dari foto. Tambahkan kondisi yang kamu ketahui."/></label>
   <p className="help-text">Periksa hasil AI sebelum dikirim. Kategori dan deskripsi tetap bisa kamu ubah.</p>
  </div>
  <div className="panel form-stack"><div className="form-section-title"><span>02</span><div><h2>Tandai lokasi</h2><p>Geser pin atau klik titik kerusakan pada peta Jakarta.</p></div></div>
   <button type="button" className="button secondary" disabled={busy} onClick={locate}><MapPin size={18}/>Gunakan lokasi saya</button>
   <ReportLocationPicker value={location} onChange={selectLocation} disabled={busy}/>
   <input type="hidden" name="latitude" value={location?.latitude.toFixed(6)||''}/><input type="hidden" name="longitude" value={location?.longitude.toFixed(6)||''}/>
   {locationMessage&&<p role="status" className="help-text">{locationMessage}</p>}
   <label>Alamat dan patokan<input name="address" minLength={8} maxLength={300} required disabled={busy} placeholder="Nama jalan, kelurahan, dan patokan terdekat"/></label>
   <div className="notice"><ShieldCheck size={20}/><p>Identitasmu disembunyikan dari publik. Hindari foto yang memperlihatkan wajah atau data pribadi.</p></div>
   <p className="help-text">Laporan kategori sama dalam radius 25 meter digabung sementara sebagai upvote. Operator akan memeriksa kesesuaiannya.</p>
   {error&&<div className="form-error" role="alert">{error}</div>}{stage&&<p role="status">{stage}</p>}
   <button className="button full" disabled={busy||analysisBusy}>{busy?'Mengirim...':analysisBusy?'Menunggu analisis foto...':'Kirim laporan'}<ArrowUpRight size={18}/></button>
  </div>
 </form>;
}
