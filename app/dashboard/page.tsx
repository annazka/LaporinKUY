import Link from "next/link";
import { ArrowUpRight, Activity } from "lucide-react";
import { PageTitle, Stats, Empty } from "@/components/ui";
import { ReportExplorer } from "@/components/widgets";
import { DashboardNav } from "@/components/dashboard-nav";
import { requireViewer, backend, accessToken } from "@/lib/backend";
import type { Report, Update } from "@/lib/types";
import { formatDate, statusLabels } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const u = await requireViewer(),
    token = await accessToken();
  const [submissions, ledger] = await Promise.all([
    backend(
      `/rest/v1/submissions?select=report_id&user_id=eq.${u.id}`,
      {},
      token,
    ),
    backend(
      `/rest/v1/point_ledger?select=amount&user_id=eq.${u.id}`,
      {},
      token,
    ),
  ]);
  const ids = [
    ...new Set<string>(
      submissions.map((s: { report_id: string }) => s.report_id),
    ),
  ];
  const mine: Report[] = ids.length
    ? await backend(
        `/rest/v1/reports?select=*&id=in.(${ids.join(",")})&order=created_at.desc`,
        {},
        token,
      )
    : [];
  const updates: Update[] = ids.length
    ? await backend(
        `/rest/v1/report_updates?select=*&report_id=in.(${ids.join(",")})&order=created_at.desc&limit=6`,
        {},
        token,
      )
    : [];
  const active = mine.filter(
      (r) => !["completed", "rejected"].includes(r.status),
    ).length,
    balance = ledger.reduce(
      (a: number, r: { amount: number }) => a + r.amount,
      0,
    );
  return (
    <div className="container page dashboard-shell">
      <DashboardNav compact />
      <div className="dashboard-content">
        <PageTitle
          eyebrow="DASHBOARD WARGA"
          title={`Halo, ${u.name}.`}
          description="Semua kontribusi dan kabar perbaikanmu, di satu tempat."
          action={
            <Link className="button" href="/reports/new">
              Buat laporan <ArrowUpRight size={18} />
            </Link>
          }
        />
        <Stats
          items={[
            {
              label: "Laporan aktif",
              value: `${active}/10`,
              note: "Laporan yang masih ditangani",
            },
            {
              label: "Laporan selesai",
              value: mine.filter((r) => r.status === "completed").length,
              note: "Perbaikan telah terkonfirmasi",
            },
            {
              label: "Poin kamu",
              value: balance,
              note: "Poin simulasi dari kontribusimu",
            },
          ]}
        />
        <div className="status-list">
          {["submitted", "in_progress", "awaiting_confirmation"].map(
            (status) => (
              <span key={status}>
                {statusLabels[status]}{" "}
                <b>{mine.filter((r) => r.status === status).length}</b>
              </span>
            ),
          )}
        </div>
        <div className="section-heading">
          <h2>Laporan saya</h2>
          <Link className="text-button" href="/#laporan">
            Jelajahi laporan <ArrowUpRight size={17} />
          </Link>
        </div>
        {mine.length ? (
          <ReportExplorer reports={mine} />
        ) : (
          <Empty title="Mulai kontribusi pertamamu." />
        )}
        <section className="panel dashboard-activity">
          <h2>
            <Activity size={19} /> Aktivitas terbaru
          </h2>
          {updates.length ? (
            updates.map((update) => (
              <article className="activity-row" key={update.id}>
                <div>
                  <Link href={`/reports/${update.report_id}`}>
                    {mine.find((r) => r.id === update.report_id)?.title ||
                      "Detail laporan"}
                  </Link>
                  <p>{update.message}</p>
                  <small>
                    {formatDate(update.created_at)} · {update.progress}% progres
                  </small>
                </div>
              </article>
            ))
          ) : (
            <p>Belum ada aktivitas. Pembaruan laporanmu akan muncul di sini.</p>
          )}
        </section>
      </div>
    </div>
  );
}
