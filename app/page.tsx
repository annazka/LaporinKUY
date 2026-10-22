import Link from 'next/link';
import {ArrowUpRight,ArrowRight,ChevronDown} from 'lucide-react';
import {Empty} from '@/components/ui';
import {AuthLink,AuthEntry} from '@/components/auth-modal';
import {safeNext} from '@/lib/rules.mjs';
import {configured} from '@/lib/backend';
import {ReportJourney} from '@/components/report-journey';
import {reports,backend,viewer,accessToken} from '@/lib/backend';
import type {Voucher} from '@/lib/types';
import {LandingMap} from '@/components/landing-map';
import {LandingVouchers} from '@/components/landing-vouchers';
import {LandingReports} from '@/components/landing-reports';

export const dynamic='force-dynamic';
const faqs=[
 ['Siapa yang bisa mengirim laporan?','Warga yang memiliki akun LaporKUY dapat mengirim foto, deskripsi, dan lokasi kerusakan. Cakupan awal berfokus pada jalan berlubang di Jakarta daratan.'],
 ['Kalau kerusakannya sudah dilaporkan orang lain?','Laporan serupa digabung ke satu kasus dan dihitung sebagai upvote. Satu akun dihitung satu kali untuk kasus yang sama. Bukti tambahan dari akun yang sama tidak menambah upvote.'],
 ['Apakah AI menentukan kapan perbaikan selesai?','AI membantu menilai foto dan merekomendasikan prioritas. Operator tetap memverifikasi laporan serta menentukan tanggal mulai dan target selesai.'],
 ['Bagaimana jika perbaikan melewati target?','Laporan mendapat penanda terlambat. Operator perlu menjelaskan kendala dan target baru. Jadwal sebelumnya tetap tersedia dalam riwayat progres.'],
];
export default async function Home({searchParams}:{searchParams:Promise<{auth?:string;next?:string}>}){
 const query=await searchParams;
 let list:Awaited<ReturnType<typeof reports>>=[];let loadFailed=!configured();
 try{list=await reports();}catch{loadFailed=true;}
 const user=await viewer(),token=user?await accessToken():undefined;
 const [offers,account]=await Promise.allSettled([backend('/rest/v1/vouchers?select=*&order=cost.asc'),user?Promise.all([backend(`/rest/v1/point_ledger?select=amount&user_id=eq.${user.id}`,{},token),backend(`/rest/v1/redemptions?select=id,code,voucher_id,created_at&user_id=eq.${user.id}&order=created_at.desc`,{},token)]):Promise.resolve([[],[]])]);
 const vouchers:Voucher[]=offers.status==='fulfilled'?offers.value:[];
 const [ledger,redemptions]=account.status==='fulfilled'?account.value:[[],[]];
 const balance=ledger.reduce((sum:number,row:{amount:number})=>sum+row.amount,0);
 const completed=list.filter(r=>r.status==='completed').length;
 return <div className="landing plain-landing">{(query.auth==="login"||query.auth==="register")&&<AuthEntry mode={query.auth} next={safeNext(query.next)}/>}
 <section className="night-hero"><div className="container hero-intro">
 <h1>Kota yang lebih baik,<br/>dimulai dari <span>suaramu.</span></h1>
 <p>LaporKUY. Laporkan kerusakan infrastruktur. Pantau sampai tuntas.<br className="desktop-break"/>Satu langkah kecilmu, berarti untuk perjalanan banyak orang.</p>
 <div className="hero-actions"><AuthLink className="button" next="/reports/new">Buat laporan <ArrowUpRight size={18}/></AuthLink><AuthLink className="button secondary">Masuk <ArrowRight size={17}/></AuthLink></div>
 </div></section>
 <section id="fitur" className="container section feature-section"><div className="section-heading"><div><h2>Informasi yang bisa<br/><span>kamu pantau.</span></h2></div></div>
 <div className="landing-feature-list"><article><h3>Jadwal dan progres perbaikan</h3><div><p>Lihat target selesai, pembaruan pekerjaan, dan alasan jika jadwal berubah. Riwayat penanganan tetap tercatat.</p><Link className="text-button" href="#laporan">Lihat laporan <ArrowUpRight size={16}/></Link></div></article>
 <article><h3>Penilaian foto kerusakan</h3><p>Gemini membantu mengenali jenis dan tingkat kerusakan dari foto. Operator memverifikasi hasilnya sebelum menentukan penanganan.</p></article>
 <article><h3>Laporan di lokasi yang sama</h3><p>Laporan untuk kerusakan yang sama digabung menjadi satu kasus. Dukungan warga ikut tercatat tanpa memecah proses penanganan.</p></article></div></section>
 <section id="cara-kerja" className="container section journey-section"><div className="section-heading"><div><h2>Dari laporan<br/><span>sampai perbaikan.</span></h2></div><p>Pilih tahap untuk melihat alur pelaporan.</p></div><ReportJourney/></section>
 <section id="laporan" className="container section latest" aria-labelledby="landing-reports-title"><div className="section-heading"><div><h2 id="landing-reports-title">Laporan jalan rusak<br/><span>di Jakarta.</span></h2></div><AuthLink className="button secondary" next="/reports/new">Buat laporan <ArrowUpRight size={17}/></AuthLink></div>{loadFailed?<Empty title="Laporan belum dapat dimuat." text="Muat ulang halaman untuk mencoba kembali." action={false}/>:<LandingReports reports={list}/>}</section>
 <LandingMap reports={list} failed={loadFailed}/>
 <section id="dampak" className="community-section"><div className="container"><div className="section-heading"><div><h2>Laporan masuk.<br/><span>Perbaikan selesai.</span></h2></div></div>{loadFailed?<p>Data sedang belum tersedia. Muat ulang halaman untuk mencoba kembali.</p>:<div className="community-stats"><div><strong>{list.length.toLocaleString('id-ID')}</strong><p>Laporan masuk</p></div><div><strong>{completed.toLocaleString('id-ID')}</strong><p>Perbaikan terkonfirmasi</p></div><div><strong>{list.reduce((a,r)=>a+r.support_count+1,0).toLocaleString('id-ID')}</strong><p>Kontribusi pelapor</p></div></div>}<small>Angka mengikuti data laporan yang dimuat. Cakupan awal Jakarta.</small></div></section>
 <LandingVouchers vouchers={vouchers} balance={balance} signedIn={Boolean(user)} failed={offers.status==='rejected'} accountFailed={account.status==='rejected'} redemptions={redemptions}/>
 <section id="faq" className="container section faq-section"><div><h2>Pertanyaan umum</h2></div><div className="faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}<ChevronDown size={17}/></summary><p>{a}</p></details>)}</div></section>
 <section className="container join-banner"><div><h2>Ada jalan rusak<br/>di sekitarmu?</h2><p>Siapkan foto dan lokasi untuk membuat laporan.</p></div><AuthLink className="button" next="/reports/new">Buat laporan <ArrowUpRight size={19}/></AuthLink></section>
 </div>;
}
