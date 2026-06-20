import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { slaStatus, computeAging, jobLlave } from "@/lib/operational";
import { AlertTriangle, Clock, FileWarning, ShieldAlert, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/alertas")({
  component: () => (
    <AppShell>
      <Alertas />
    </AppShell>
  ),
});

function Alertas() {
  const jobs = useJobsStore((s) => s.jobs);
  const today = new Date().toISOString().slice(0, 10);
  const alerts = [
    ...jobs.filter((j) => slaStatus(j) === "Vencido").map((j) => ({
      type: "SLA vencido", icon: ShieldAlert, color: "destructive",
      title: `${jobLlave(j)} fuera de SLA (${computeAging(j)}d)`,
      desc: `${j.cliente} · prioridad ${j.prioridad} · resp. ${j.responsable}`,
    })),
    ...jobs.filter((j) => j.escalado).map((j) => ({
      type: "Escalado", icon: ArrowUpRight, color: "warning",
      title: `${jobLlave(j)} escalado a nivel gerencial`,
      desc: `${j.cliente} · ${j.responsable}`,
    })),
    ...jobs.filter((j) => j.status === "Demorado").map((j) => ({
      type: "Demora", icon: AlertTriangle, color: "destructive",
      title: `${jobLlave(j)} reportado como demorado`,
      desc: `${j.cliente} · ${j.carrier} · ${j.origen} → ${j.destino}`,
    })),
    ...jobs.filter((j) => !j.ata && j.eta < today).slice(0, 10).map((j) => ({
      type: "ETA vencida", icon: Clock, color: "warning",
      title: `${jobLlave(j)} con ETA vencida`,
      desc: `ETA: ${j.eta} · sin arribo registrado`,
    })),
    ...jobs.filter((j) => j.ata && !j.aduana).slice(0, 6).map((j) => ({
      type: "Aduana pendiente", icon: FileWarning, color: "info",
      title: `${jobLlave(j)} pendiente de liberación aduanera`,
      desc: `Arribó ${j.ata} · ${j.cliente}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Alertas y notificaciones</h1>
        <p className="text-sm text-muted-foreground">{alerts.length} alertas activas requieren atención.</p>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {alerts.map((a, i) => {
          const Icon = a.icon;
          return (
            <div key={i} className="p-4 flex gap-4 hover:bg-muted/30 transition">
              <div className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 bg-${a.color}/15`}>
                <Icon className={`h-5 w-5 text-${a.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-${a.color}/15 text-${a.color}`}>{a.type}</span>
                </div>
                <div className="text-sm font-medium text-foreground mt-1">{a.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
              </div>
            </div>
          );
        })}
        {alerts.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">No hay alertas activas.</div>
        )}
      </div>
    </div>
  );
}
