'use client';
import Link from 'next/link';
import {AuthForm} from './forms';
import {Logout} from './widgets';
export function OperatorLogin({signedIn}:{signedIn:boolean}){return <div className="admin-app"><div className="admin-login"><Link className="brand" href="/">LaporKUY.</Link><h1>Masuk operator</h1><p>Gunakan akun operator untuk mengelola laporan dan penanganannya.</p>{signedIn&&<div className="admin-notice">Akun saat ini tidak memiliki akses operator. <Logout/></div>}<AuthForm next="/operator" allowRegister={false} onModeChange={()=>{}}/><Link href="https://laporkuy.online/">Kembali ke LaporKUY</Link></div></div>;}
