import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { useJobsStore } from "@/lib/jobs-store";
import { exportJobsToExcel } from "@/lib/export-excel";
import { slaStatus } from "@/lib/operational";

export const Route = createFileRoute("/reportes")({
  component: () => (
    <AppShell>
      <Reportes />
    </AppShell>
  ),
});

function Reportes() {
  const jobs = useJobsStore((s) => s.jobs);

  const reportes = [
    {
      name: "Reporte operativo",
      desc: "Estado actual de todas las operaciones",
      run: () => download(jobs, "reporte-operativo"),
    },
    {
      name: "Reporte clientes",
      desc: "Actividad agrupada por cliente",
      run: () => download([...jobs].sort((a, b) => a.cliente.localeCompare(b.cliente)), "reporte-clientes"),
    },
    {
      name: "Reporte mensual",
      desc: "Operaciones del mes en curso",
      run: () => {
        const ym = new Date().toISOString().slice(0, 7);
        const filtered = jobs.filter((j) => j.fechaCreacion.startsWith(ym));
        download(filtered, `reporte-${ym}`);
      },
    },
    {
      name: "Reporte de demoras",
      desc: "Jobs con SLA vencido o en demora",
      run: () => download(jobs.filter((j) => slaStatus(j) === "Vencido" || j.status === "Demorado"), "reporte-demoras"),
    },
    {
      name: "Reporte de facturación",
      desc: "Pendientes y emitidas",
      run: () => download(jobs.filter((j) => j.factura || j.status === "Entregado"), "reporte-facturacion"),
    },
    {
      name: "Reporte de proyecciones",
      desc: "ETAs próximas sin arribo",
      run: () => {
        const today = new Date().toISOString().slice(0, 10);
        download(jobs.filter((j) => !j.ata && j.eta >= today), "reporte-proyecciones");
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground">Genera y exporta reportes operativos en Excel.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportes.map((r) => (
          <div key={r.name} className="bg-card border border-border rounded-lg p-5 hover:border-ring transition flex flex-col">
            <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center">
              <FileText className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">{r.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 flex-1">{r.desc}</p>
            <div className="mt-4">
              <button
                onClick={r.run}
                className="inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition"
              >
                <Download className="h-3.5 w-3.5" /> Exportar Excel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function download(jobs: ReturnType<typeof useJobsStore.getState>["jobs"], baseName: string) {
  if (jobs.length === 0) { toast.error("No hay datos para este reporte"); return; }
  exportJobsToExcel(jobs, `${baseName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success(`${jobs.length} registros exportados`);
}
