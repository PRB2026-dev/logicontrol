import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { jobLlave, fmtMoney, valorPendienteUsdFn, lineStatus, jobDelayDays } from "@/lib/operational";
import type { Job } from "@/lib/jobs-data";
import { CalendarClock, TrendingUp, AlertOctagon, CheckCircle2, Package, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from "recharts";

export const Route = createFileRoute("/proyecciones")({
  component: () => (
    <AppShell>
      <Proyecciones />
    </AppShell>
  ),
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
};

const DAY = 86400000;
const PAGE_SIZE = 25;

function daysUntil(date: string | null | undefined): number {
  if (!date) return 9999;
  const d = new Date(date);
  if (isNaN(d.getTime())) return 9999;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / DAY);
}

function weekLabel(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes
  const monday = new Date(d.setDate(diff));
  const dd = monday.getDate().toString().padStart(2, "0");
  const mm = (monday.getMonth() + 1).toString().padStart(2, "0");
  return `${dd}/${mm}`;
}

/** Fecha de entrega esperada: usa fecha compromiso > ETA campo > ETA puerto > ETA */
function fechaEntregaEsperada(j: Job): string | null {
  return j.fechaCompromiso || j.fechaEntregaContractual || j.etaCampo || j.etaPuerto || j.eta || null;
}

function Proyecciones() {
  const jobs = useJobsStore((s) => s.jobs);
  const [fProveedor, setFProveedor] = useState("");
  const [fSemana, setFSemana] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  // Líneas pendientes de entrega (no entregadas completamente)
  const lineasPendientes = useMemo(() => {
    return jobs.filter((j) => {
      const ls = lineStatus(j);
      return ls !== "Entregado";
    });
  }, [jobs]);

  // Proveedores disponibles
  const proveedores = useMemo(() =>
    [...new Set(lineasPendientes.map((j) => (j.proveedor ?? "").trim()).filter(Boolean))].sort(),
  [lineasPendientes]);

  // Filtrar por proveedor y búsqueda
  const filteredLines = useMemo(() => {
    let result = lineasPendientes;
    if (fProveedor) result = result.filter((j) => (j.proveedor ?? "").trim() === fProveedor);
    if (q.trim()) {
      const t = q.toLowerCase();
      result = result.filter((j) =>
        [jobLlave(j), j.oc, j.proveedor, j.material, j.gerencia, j.campo, j.responsable]
          .filter(Boolean).some((x) => String(x).toLowerCase().includes(t))
      );
    }
    return result;
  }, [lineasPendientes, fProveedor, q]);

  // KPIs
  const kpis = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    let en7 = 0, en14 = 0, en30 = 0, vencidas = 0, usdPendiente = 0;
    for (const j of filteredLines) {
      const fecha = fechaEntregaEsperada(j);
      const dias = daysUntil(fecha);
      if (dias < 0) vencidas++;
      else if (dias <= 7) en7++;
      if (dias >= 0 && dias <= 14) en14++;
      if (dias >= 0 && dias <= 30) en30++;
      usdPendiente += valorPendienteUsdFn(j);
    }
    return { total: filteredLines.length, en7, en14, en30, vencidas, usdPendiente };
  }, [filteredLines]);

  // Forecast semanal (próximas 8 semanas)
  const weeklyForecast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weeks: { label: string; start: Date; end: Date; lineas: number; usd: number }[] = [];
    for (let w = 0; w < 8; w++) {
      const start = new Date(today.getTime() + w * 7 * DAY);
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      const end = new Date(start.getTime() + 6 * DAY);
      const label = `S${w + 1} (${start.getDate().toString().padStart(2, "0")}/${(start.getMonth() + 1).toString().padStart(2, "0")})`;
      let lineas = 0, usd = 0;
      for (const j of filteredLines) {
        const fecha = fechaEntregaEsperada(j);
        if (!fecha) continue;
        const d = new Date(fecha);
        if (isNaN(d.getTime())) continue;
        d.setHours(0, 0, 0, 0);
        if (d >= start && d <= end) {
          lineas++;
          usd += valorPendienteUsdFn(j);
        }
      }
      weeks.push({ label, start, end, lineas, usd });
    }
    return weeks;
  }, [filteredLines]);

  // Top proveedores con más líneas pendientes
  const topProveedores = useMemo(() => {
    const map = new Map<string, { lineas: number; usd: number }>();
    for (const j of filteredLines) {
      const prov = (j.proveedor ?? "").trim() || "Sin proveedor";
      const curr = map.get(prov) ?? { lineas: 0, usd: 0 };
      curr.lineas++;
      curr.usd += valorPendienteUsdFn(j);
      map.set(prov, curr);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, fullName: name, ...v }))
      .sort((a, b) => b.lineas - a.lineas)
      .slice(0, 10);
  }, [filteredLines]);

  // Tabla paginada de líneas pendientes ordenadas por fecha más próxima
  const sortedLines = useMemo(() => {
    let lines = [...filteredLines];
    if (fSemana) {
      // filtrar por semana seleccionada
      const weekData = weeklyForecast.find((w) => w.label === fSemana);
      if (weekData) {
        lines = lines.filter((j) => {
          const fecha = fechaEntregaEsperada(j);
          if (!fecha) return false;
          const d = new Date(fecha);
          if (isNaN(d.getTime())) return false;
          d.setHours(0, 0, 0, 0);
          return d >= weekData.start && d <= weekData.end;
        });
      }
    }
    return lines.sort((a, b) => {
      const da = daysUntil(fechaEntregaEsperada(a));
      const db = daysUntil(fechaEntregaEsperada(b));
      return da - db;
    });
  }, [filteredLines, fSemana, weeklyForecast]);

  const totalPages = Math.max(1, Math.ceil(sortedLines.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageLines = sortedLines.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6b7280"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Proyecciones de Entrega</h1>
        <p className="text-sm text-muted-foreground">
          Líneas pendientes por semana, proveedor y fecha compromiso — {filteredLines.length} líneas activas
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Package} label="Total pendientes" value={kpis.total} color="#6366f1" />
        <Kpi icon={CalendarClock} label="Llegan en 7 días" value={kpis.en7} color="#0ea5e9" />
        <Kpi icon={TrendingUp} label="Llegan en 14 días" value={kpis.en14} color="#10b981" />
        <Kpi icon={TrendingUp} label="Llegan en 30 días" value={kpis.en30} color="#8b5cf6" />
        <Kpi icon={AlertOctagon} label="Fecha vencida" value={kpis.vencidas} color="#ef4444" />
        <Kpi icon={CheckCircle2} label="USD Pendiente" value={fmtMoney(kpis.usdPendiente, "USD")} color="#f59e0b" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Buscar LLAVE, OC, proveedor, material, gerencia…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={fProveedor} onChange={(e) => { setFProveedor(e.target.value); setPage(0); }}
          className="h-9 px-3 rounded-md border border-border bg-card text-sm min-w-[180px]">
          <option value="">Proveedor: Todos</option>
          {proveedores.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fSemana} onChange={(e) => { setFSemana(e.target.value); setPage(0); }}
          className="h-9 px-3 rounded-md border border-border bg-card text-sm">
          <option value="">Semana: Todas</option>
          {weeklyForecast.map((w) => <option key={w.label} value={w.label}>{w.label} ({w.lineas} líneas)</option>)}
        </select>
        {(fProveedor || fSemana || q) && (
          <button onClick={() => { setFProveedor(""); setFSemana(""); setQ(""); setPage(0); }}
            className="text-xs text-destructive hover:underline">✕ Limpiar</button>
        )}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Forecast semanal */}
        <Card className="lg:col-span-2">
          <CardHeader title="Líneas por semana · próximas 8 semanas"
            subtitle="Líneas que deben llegar según fecha compromiso / ETA" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyForecast} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}
                onClick={(e) => {
                  if (e?.activePayload?.[0]) {
                    const label = (e.activePayload[0].payload as { label: string }).label;
                    setFSemana((prev) => prev === label ? "" : label);
                    setPage(0);
                  }
                }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }}
                  formatter={(v: number, name: string) => [v, name === "lineas" ? "Líneas" : "USD"]} />
                <Bar dataKey="lineas" name="Líneas" radius={[4, 4, 0, 0]} barSize={32}>
                  {weeklyForecast.map((w, i) => (
                    <Cell key={i} fill={fSemana === w.label ? "#6366f1" : "#6366f180"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top proveedores */}
        <Card>
          <CardHeader title="Top proveedores · líneas pendientes" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProveedores} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={10} width={100} />
                <Tooltip contentStyle={tooltipStyle}
                  formatter={(v: number) => [v, "Líneas"]} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="lineas" radius={[0, 4, 4, 0]} barSize={18}>
                  {topProveedores.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {topProveedores.length === 0 && (
              <div className="text-xs text-muted-foreground text-center mt-8">Sin datos.</div>
            )}
          </div>
        </Card>
      </div>

      {/* Tabla de líneas pendientes */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Líneas pendientes de entrega</h3>
            <p className="text-xs text-muted-foreground">
              Ordenadas por fecha más próxima · {sortedLines.length} líneas
              {fSemana && <span className="ml-1 text-info font-medium">· Filtro: {fSemana}</span>}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead className="bg-muted/30 text-muted-foreground text-[11px] uppercase tracking-wide text-left sticky top-0">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5">LLAVE</th>
                <th className="px-4 py-2.5">OC</th>
                <th className="px-4 py-2.5">Proveedor</th>
                <th className="px-4 py-2.5">Material</th>
                <th className="px-4 py-2.5 text-right">QTY Pend.</th>
                <th className="px-4 py-2.5">F. Compromiso</th>
                <th className="px-4 py-2.5 text-right">Días</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Gerencia</th>
                <th className="px-4 py-2.5">Campo</th>
                <th className="px-4 py-2.5 text-right">USD Pend.</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {pageLines.map((j) => {
                const fecha = fechaEntregaEsperada(j);
                const dias = daysUntil(fecha);
                const ls = lineStatus(j);
                const pend = Math.max(0, Number(j.qty ?? 0) - Number(j.qtyEntregada ?? 0));
                const diasColor = dias < 0 ? "text-destructive font-semibold" :
                  dias <= 3 ? "text-destructive" :
                  dias <= 7 ? "text-warning font-medium" :
                  dias <= 14 ? "text-warning" : "text-muted-foreground";
                const lsColor = ls === "Vencido" ? "bg-destructive/15 text-destructive" :
                  ls === "Próximo a Vencer" ? "bg-warning/15 text-warning" :
                  ls === "Parcial" ? "bg-info/15 text-info" :
                  "bg-muted text-muted-foreground";
                return (
                  <tr key={j.id} className="border-t border-border/50 hover:bg-muted/20 transition">
                    <td className="px-4 py-2.5">
                      <Link to="/operaciones/$jobId" params={{ jobId: j.id } as any}
                        className="font-mono text-xs font-semibold text-info hover:underline">
                        {jobLlave(j)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground">{j.oc || j.bdpJob || "—"}</td>
                    <td className="px-4 py-2.5 text-xs max-w-[160px] truncate" title={j.proveedor ?? ""}>
                      {j.proveedor || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate" title={j.material ?? ""}>
                      {j.material || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                      {pend.toLocaleString("es-CO")} <span className="text-muted-foreground">{j.um ?? ""}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">{fecha || "Sin fecha"}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${diasColor}`}>
                      {dias === 9999 ? "—" : dias === 0 ? "Hoy" : dias > 0 ? `${dias}d` : `${dias}d`}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${lsColor}`}>{ls}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{j.gerencia || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{j.campo || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium">
                      {fmtMoney(valorPendienteUsdFn(j), "USD")}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link to="/operaciones/$jobId" params={{ jobId: j.id } as any}
                        className="text-[11px] text-info hover:underline">Ver</Link>
                    </td>
                  </tr>
                );
              })}
              {pageLines.length === 0 && (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No hay líneas pendientes con esos filtros.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-muted-foreground">
            Mostrando {sortedLines.length === 0 ? 0 : safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sortedLines.length)} de {sortedLines.length} líneas
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(0)} disabled={safePage === 0}
              className="h-8 px-2 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
              ‹‹
            </button>
            <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}
              className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
              <ChevronLeft className="h-3.5 w-3.5 inline" /> Anterior
            </button>
            <span className="text-xs text-foreground font-medium px-2">{safePage + 1} / {totalPages}</span>
            <button type="button" onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
              className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
              Siguiente <ChevronRight className="h-3.5 w-3.5 inline" />
            </button>
            <button type="button" onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1}
              className="h-8 px-2 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
              ››
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function Kpi({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string | number; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div className="mt-2 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-lg p-5 ${className}`}>{children}</div>;
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
