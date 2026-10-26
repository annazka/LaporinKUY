// A username is only an alias for a real Supabase account, never an auth bypass.
export const ADMIN_LOGIN_EMAIL='admin@laporkuy.online';
export function operatorEmail(username){
 if(typeof username!=='string')throw Error('Masukkan username atau email operator.');
 const value=username.trim().toLowerCase();
 if(value==='admin')return ADMIN_LOGIN_EMAIL;
 if(value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return value;
 throw Error('Username atau email operator tidak valid.');
}
export function operatorSession(session){
 if(!session?.access_token||!session?.refresh_token||session.user?.app_metadata?.role!=='operator')throw Error('Akun ini tidak memiliki akses operator.');
 return session;
}
