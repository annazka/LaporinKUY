import {requireViewer} from '@/lib/backend';
import {PageTitle} from '@/components/ui';
import {ProfileForm} from '@/components/profile-form';
import {DashboardNav} from '@/components/dashboard-nav';
export default async function Profile(){const user=await requireViewer(false,'/profile');return <div className="container page dashboard-shell"><DashboardNav/><div className="dashboard-content"><PageTitle eyebrow="AKUN SAYA" title="Profil kamu." description="Kelola identitas yang digunakan untuk kontribusimu."/><div className="profile-grid"><section className="panel"><h2>Informasi akun</h2><dl><dt>Email</dt><dd>{user.email}</dd><dt>Peran</dt><dd>{user.role==='operator'?'Operator':'Warga'}</dd><dt>Status email</dt><dd>{user.emailConfirmed?'Email terkonfirmasi':'Email belum terkonfirmasi'}</dd></dl></section><section className="panel"><h2>Nama tampilan</h2><ProfileForm name={user.name}/></section></div></div></div>;}
