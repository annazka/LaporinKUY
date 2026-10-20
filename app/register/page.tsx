import {viewer} from '@/lib/backend';
import {redirect} from 'next/navigation';
import {safeNext} from '@/lib/rules.mjs';
import {AuthForm} from '@/components/forms';import {Eyebrow} from '@/components/ui';
export default async function Register({searchParams}:{searchParams:Promise<{next?:string}>}){const next=safeNext((await searchParams).next);if(await viewer())redirect(next);return <div className="container auth-layout"><div className="auth-copy"><Eyebrow>AMBIL BAGIAN, MULAI HARI INI</Eyebrow><h1>Kotamu.<br/>Suaramu.<br/>Kontribusimu.</h1><p>Buat akun warga dan bantu perbaikan infrastruktur di sekitarmu.</p></div><div className="panel auth-panel"><h2>Gabung jadi warga peduli.</h2><p>Pendaftaran ini membuat akun user. Akses operator diberikan secara khusus.</p><AuthForm register next={next}/></div></div>;}
