'use client';
import Link from 'next/link';import {usePathname} from 'next/navigation';
const links=[['/dashboard','Ringkasan'],['/dashboard/reports','Laporan saya'],['/reports/new','Buat laporan'],['/#laporan','Jelajahi laporan'],['/profile','Profil saya']];
export function DashboardNav(){const path=usePathname();return <nav className="dashboard-side" aria-label="Navigasi akun">{links.map(([href,label])=><Link key={href} className={path===href?'active':''} aria-current={path===href?'page':undefined} href={href}>{label}</Link>)}</nav>;}
