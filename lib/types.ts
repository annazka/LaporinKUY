export type Report = {id:string;title:string;description:string;category:string;address:string;latitude:number;longitude:number;photo_path:string;status:string;priority:string;progress:number;support_count:number;start_date:string|null;target_date:string|null;last_update_at:string|null;created_at:string};
export type Update = {id:string;report_id:string;kind:string;message:string;photo_path:string|null;progress:number;created_at:string;previous_target:string|null;new_target:string|null};
export type Viewer = {id:string;email:string;role:'user'|'operator';name:string;emailConfirmed:boolean};
export type Voucher = {id:string;name:string;description:string;cost:number;stock:number;category:string;valid_until:string};
export const statusLabels:Record<string,string>={submitted:'Menunggu verifikasi',verified:'Terverifikasi',scheduled:'Dijadwalkan',in_progress:'Dalam perbaikan',awaiting_confirmation:'Menunggu konfirmasi',completed:'Selesai',rejected:'Ditolak'};
export const priorityLabels:Record<string,string>={low:'Rendah',medium:'Sedang',high:'Tinggi',urgent:'Darurat'};
export function formatDate(date:string|null){return date?new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(date)):'Belum ditentukan';}
