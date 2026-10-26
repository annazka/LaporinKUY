import { PageTitle } from "@/components/ui";
import { ReportForm } from "@/components/forms";
import { DashboardNav } from "@/components/dashboard-nav";
import { requireViewer } from "@/lib/backend";
export default async function NewReport() {
  await requireViewer(false, "/reports/new");
  return (
    <div className="container page dashboard-shell">
      <DashboardNav />
      <div className="dashboard-content">
        <PageTitle
          eyebrow="BUAT LAPORAN"
          title="Ada yang perlu diperbaiki?"
          description="Kirim bukti dan lokasi. Kami bantu meneruskannya ke operator."
        />
        <ReportForm />
      </div>
    </div>
  );
}
