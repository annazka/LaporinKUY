export function jakartaDate(now = new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function isOverdue(report, now = new Date()){return !!report.target_date && report.target_date < jakartaDate(now) && !['completed','rejected','awaiting_confirmation'].includes(report.status);}
export function missingDailyUpdate(report, now = new Date()){const day=jakartaDate(now);return !!report.start_date && report.start_date<=day && !['completed','rejected','awaiting_confirmation','submitted'].includes(report.status) && (!report.last_update_at || jakartaDate(new Date(report.last_update_at))!==day);}
export function validCoordinates(lat,lng){return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-6.5&&lat<=-6.05&&lng>=106.65&&lng<=107.0;}
export function safeNext(value){return typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')?value:'/dashboard';}
