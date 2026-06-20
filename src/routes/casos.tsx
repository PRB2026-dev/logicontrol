import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { priorityColors, type Priority, type JobStatus, statusColors } from "@/lib/jobs-data";
import { computeAging, slaStatus, slaColors, isCritico, jobLlave } from "@/lib/operational";
import { useMemo, useState } from "react";
import { Search, Filter, ChevronRight, Flame, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/casos")({
  component: () => (
    <AppShell>
      <Casos />
    </AppShell>
  ),
});

const prioridades: (Priority | "Todas")[] = ["Todas", "Crítica", "Alta", "Media", "Baja"];
const slaFilters = ["Todos", "Cumplido", "En riesgo", "Vencido"] as const;

function Casos() {
  const jobs = useJobsStore((s) => s.jobs);
  const [q, setQ] = useState("");
  const [prio, setPrio] = useState<(Priority | "Todas")>("Todas");
  const [sla, setSla] = useState<(typeof slaFilters)[number]>("Todos");
  const [responsable, setResponsable] = useState("Todos");
  const [onlyCriticos, setOnlyCriticos] = useState(false);

  const responsables = useMemo(
    () => ["Todos", ...Array.from(new Set(jobs.map((j) => j.responsable))).sort()],
    [jobs],
  );

  const enriched = useMemo(
    () =>
      jobs.map((j) => ({
        job: j,
        aging: computeAging(j),
        sla: slaStatus(j),
        critico: isCritico(j),
      })),
    [jobs],
  );

  const filtered = enriched.filter(({ job, sla: s, critico }) => {
    const term = q.toLowerCase();
    const matchQ = !term || [jobLlave(job), job.oc, job.bdpJob, job.proveedor, job.cliente, job.responsable, job.material].filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
    const matchP = prio === "Todas" || job.prioridad === prio;
    const matchS = sla === "Todos" || s === sla;
    const matchR = responsable === "Todos" || job.responsable === responsable;
    const matchC = !onlyCriticos || critico;
    return matchQ && matchP && matchS && matchR && matchC;
  });

  const stats = {
    criticos: enriched.filter((e) => e.critico).length,
    vencidos: enriched.filter((e) => e.sla === "Vencido").length,
    riesgo: enriched.filter((e) => e.sla === "En riesgo").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Casos operativos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} de {jobs.length} casos · SLA, aging y escalamientos.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Pill color="destructive" label="Críticos" value={stats.criticos} />
          <Pill color="warning" label="En riesgo" value={stats.riesgo} />
          <Pill color="destructive" label="SLA vencido" value={stats.vencidos} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar caso, cliente o responsable..."
              className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/60 border border-transparent text-sm focus:outline-none focus:border-ring focus:bg-background"
            />
          </div>
          <select
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className="h-9 px-3 rounded-md bg-card border border-border text-sm"
          >
            {responsables.map((r) => <option key={r}>{r}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Prioridad:</span>
            {prioridades.map((p) => (
              <Chip key={p} active={prio === p} onClick={() => setPrio(p)}>{p}</Chip>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">SLA:</span>
            {slaFilters.map((s) => (
              <Chip key={s} active={sla === s} onClick={() => setSla(s)}>{s}</Chip>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={onlyCriticos} onChange={(e) => setOnlyCriticos(e.target.checked)} />
            <Flame className="h-3.5 w-3.5 text-destructive" /> Solo críticos
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="text-left">
                <Th>LLAVE</Th>
                <Th>OC</Th>
                <Th>Proveedor</Th>
                <Th>Responsable</Th>
                <Th>Centro</Th>
                <Th>Estado</Th>
                <Th>Prioridad</Th>
                <Th>SLA</Th>
                <Th className="text-right">Aging</Th>
                <Th>Creación</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ job: j, aging, sla: s, critico }) => (
                <tr key={j.id} className="border-t border-border hover:bg-muted/30 transition">
                  <Td className="font-mono text-xs text-info">
                    <div className="flex items-center gap-1.5">
                      {critico && <Flame className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      {jobLlave(j)}
                      {j.escalado && <ArrowUpRight className="h-3.5 w-3.5 text-warning" />}
                    </div>
                  </Td>
                  <Td className="font-medium text-foreground">{j.oc || j.bdpJob}</Td>
                  <Td className="text-muted-foreground"><div className="truncate max-w-[200px]" title={j.proveedor ?? j.cliente}>{j.proveedor || j.cliente}</div></Td>
                  <Td className="text-muted-foreground">{j.responsable}</Td>
                  <Td className="text-muted-foreground text-xs">{j.centro}</Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[j.status as JobStatus]}`}>
                      {j.status}
                    </span>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[j.prioridad]}`}>
                      {j.prioridad}
                    </span>
                  </Td>
                  <Td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${slaColors[s]}`}>
                      ● {s}
                    </span>
                  </Td>
                  <Td className="text-right tabular-nums">
                    <span className={aging > 10 ? "text-destructive font-semibold" : aging > 5 ? "text-warning" : "text-foreground"}>
                      {aging}d
                    </span>
                  </Td>
                  <Td className="text-muted-foreground text-xs">{j.fechaCreacion}</Td>
                  <Td>
                    <Link to="/operaciones/$jobId" params={{ jobId: j.id } as any} className="inline-flex items-center text-xs text-info hover:underline">
                      Detalle <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Sin casos con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 h-7 rounded-md text-xs font-medium border transition ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Pill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 bg-${color}/10 border border-${color}/20`}>
      <span className={`font-semibold text-${color}`}>{value}</span>
      <span className="text-muted-foreground text-[11px] uppercase tracking-wide">{label}</span>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wide ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}
