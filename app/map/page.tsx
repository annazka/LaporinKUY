import {PageTitle} from '@/components/ui';import {ReportExplorer} from '@/components/widgets';import {reports} from '@/lib/backend';
export const dynamic='force-dynamic';
export default async function MapPage(){return <div className="container page"><PageTitle eyebrow="PETA LAPORAN" title="Lihat kondisi di sekitarmu." description="Pilih laporan untuk melihat titik lokasinya pada peta Jakarta."/><ReportExplorer reports={await reports()} map/></div>;}
