import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { deriveTipoCompra, jobLlave, fmtMoney, valorCompradoUsd, valorPendienteUsdFn, jobDelayDays, lineStatus } from "@/lib/operational";
import type { Job } from "@/lib/jobs-data";
import { useMemo, useState, Fragment } from "react";
import { Ship, Package, CheckCircle2, Clock, AlertTriangle, TrendingUp, Globe2, Anchor, Search, Download, ChevronRight, ChevronLeft, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from "recharts";
import { exportJobsToExcel } from "@/lib/export-excel";
import { toast } from "sonner";

export const Route = createFileRoute("/importaciones")({
  component: () => (
    <AppShell>
      <ImportacionesModule />
    </AppShell>
  ),
});

const tooltipStyle = {
  background: "var(--popover)", border: "1px solid var(--border)",
  borderRadius: "8px", fontSize: "12px", color: "var(--popover-foreground)",
};
const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
const PAGE_SIZE = 25;
const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();

/** Normaliza modalidad: unifica mayúsculas/minúsculas y acentos */
function normModalidad(j: Job): string {
  const raw = (j.modalidadImpo || j.modo || "").trim();
  if (!raw) return "Sin definir";
  const lower = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (lower.includes("marit") || lower.includes("sea") || lower.includes("ocean")) return "Marítimo";
  if (lower.includes("aere") || lower.includes("air")) return "Aéreo";
  if (lower.includes("terr") || lower.includes("road") || lower.includes("truck") || lower.includes("land")) return "Terrestre";
  if (lower.includes("multi") || lower.includes("comb")) return "Multimodal";
  // Capitalizar primera letra
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function ImportacionesModule() {
  const allJobs = useJobsStore((s) => s.jobs);

  // Solo líneas de importación
  const impoJobs = useMemo(() => allJobs.filter((j) => deriveTipoCompra(j) === "Importación"), [allJobs]);

  // Filtros
  const [q, setQ] = useState("");
  const [fProveedor, setFProveedor] = useState("");
  const [fIncoterms, setFIncoterms] = useState("");
  const [fModalidad, setFModalidad] = useState("");
  const [fDestino, setFDestino] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [page, setPage] = useState(0);

  // Opciones de filtro
  const proveedores = useMemo(() => [...new Set(impoJobs.map(j => (j.proveedor ?? "").trim()).filter(Boolean))].sort(), [impoJobs]);
  const incotermsOpt = useMemo(() => [...new Set(impoJobs.map(j => (j.incoterms ?? "").trim()).filter(Boolean))].sort(), [impoJobs]);
  const modalidades = useMemo(() => [...new Set(impoJobs.map(j => normModalidad(j)).filter(Boolean))].sort(), [impoJobs]);
  const destinos = useMemo(() => [...new Set(impoJobs.map(j => (j.lugarLlegada || j.destino || "").trim()).filter(Boolean))].sort(), [impoJobs]);
  const estados = ["Pendiente", "Parcial", "Vencido", "Próximo a Vencer", "Entregado"];

  // Aplicar filtros
  const filtered = useMemo(() => {
    let result = impoJobs;
    if (q.trim()) {
      const t = q.toLowerCase();
      result = result.filter(j => [jobLlave(j), j.oc, j.proveedor, j.material, j.codigoSap, j.doNum, j.invoice, j.incoterms]
        .filter(Boolean).some(x => String(x).toLowerCase().includes(t)));
    }
    if (fProveedor) result = result.filter(j => (j.proveedor ?? "").trim() === fProveedor);
    if (fIncoterms) result = result.filter(j => (j.incoterms ?? "").trim() === fIncoterms);
    if (fModalidad) result = result.filter(j => normModalidad(j) === fModalidad);
    if (fDestino) result = result.filter(j => (j.lugarLlegada || j.destino || "").trim() === fDestino);
    if (fEstado) result = result.filter(j => lineStatus(j) === fEstado);
    return result;
  }, [impoJobs, q, fProveedor, fIncoterms, fModalidad, fDestino, fEstado]);

  // KPIs
  const kpis = useMemo(() => {
    const totalLineas = filtered.length;
    const totalOC = new Set(filtered.map(j => (j.oc ?? "").trim()).filter(Boolean)).size;
    const totalProveedores = new Set(filtered.map(j => (j.proveedor ?? "").trim()).filter(Boolean)).size;
    let entregadas = 0, pendientes = 0, vencidas = 0, proximas = 0;
    let qtyTotal = 0, qtyEntregada = 0;
    let usdTotal = 0, usdPendiente = 0;
    for (const j of filtered) {
      const ls = lineStatus(j);
      if (ls === "Entregado") entregadas++;
      else if (ls === "Vencido") vencidas++;
      else if (ls === "Próximo a Vencer") proximas++;
      else pendientes++;
      qtyTotal += Number(j.qty ?? 0);
      qtyEntregada += Number(j.qtyEntregada ?? 0);
      usdTotal += valorCompradoUsd(j);
      usdPendiente += valorPendienteUsdFn(j);
    }
    return { totalLineas, totalOC, totalProveedores, entregadas, pendientes, vencidas, proximas, qtyTotal, qtyEntregada, usdTotal, usdPendiente };
  }, [filtered]);

  // Datos gráficos
  const estadoChart = useMemo(() => [
    { name: "Pendientes", value: kpis.pendientes, fill: "#f59e0b" },
    { name: "Vencidas", value: kpis.vencidas, fill: "#ef4444" },
    { name: "Próximas", value: kpis.proximas, fill: "#f97316" },
    { name: "Entregadas", value: kpis.entregadas, fill: "#10b981" },
  ].filter(d => d.value > 0), [kpis]);

  const modalidadChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of filtered) { const m = normModalidad(j); map.set(m, (map.get(m) ?? 0) + 1); }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const incotermsChart = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of filtered) { const i = (j.incoterms ?? "Sin dato").trim() || "Sin dato"; map.set(i, (map.get(i) ?? 0) + 1); }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const topProveedores = useMemo(() => {
    const map = new Map<string, { lineas: number; pendientes: number }>();
    for (const j of filtered) {
      const p = (j.proveedor ?? "Sin prov.").trim() || "Sin prov.";
      const c = map.get(p) ?? { lineas: 0, pendientes: 0 };
      c.lineas++;
      if (lineStatus(j) !== "Entregado") c.pendientes++;
      map.set(p, c);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].lineas - a[1].lineas).slice(0, 6)
      .map(([name, v]) => ({ name: name.length > 20 ? name.slice(0, 20) + "…" : name, ...v }));
  }, [filtered]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const handleExport = () => {
    if (filtered.length === 0) { toast.error("No hay datos para exportar"); return; }
    exportJobsToExcel(filtered, `importaciones-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filtered.length} líneas exportadas`);
  };

  const clearFilters = () => { setQ(""); setFProveedor(""); setFIncoterms(""); setFModalidad(""); setFDestino(""); setFEstado(""); setPage(0); };
  const activeFilters = [q, fProveedor, fIncoterms, fModalidad, fDestino, fEstado].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Ship className="h-6 w-6 text-info" /> Importaciones
          </h1>
          <p className="text-sm text-muted-foreground">Seguimiento logístico de órdenes internacionales — {filtered.length} líneas</p>
        </div>
        <button onClick={handleExport} className="inline-flex items-center gap-2 px-4 h-9 rounded-md border border-border text-sm hover:bg-muted transition-colors">
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi label="Total líneas" value={kpis.totalLineas} color="#6366f1" />
        <Kpi label="Órdenes (OC)" value={kpis.totalOC} color="#0ea5e9" />
        <Kpi label="Proveedores" value={kpis.totalProveedores} color="#8b5cf6" />
        <Kpi label="Entregadas" value={kpis.entregadas} color="#10b981" />
        <Kpi label="Pendientes" value={kpis.pendientes} color="#f59e0b" />
        <Kpi label="Vencidas" value={kpis.vencidas} color="#ef4444" />
        <Kpi label="USD Pendiente" value={fmtMoney(kpis.usdPendiente, "USD")} color="#f97316" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap bg-card border border-border rounded-lg p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Buscar LLAVE, OC, proveedor, material, SAP, DO, invoice…"
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <Sel label="Proveedor" value={fProveedor} onChange={(v) => { setFProveedor(v); setPage(0); }} options={proveedores} />
        <Sel label="Incoterms" value={fIncoterms} onChange={(v) => { setFIncoterms(v); setPage(0); }} options={incotermsOpt} />
        <Sel label="Modalidad" value={fModalidad} onChange={(v) => { setFModalidad(v); setPage(0); }} options={modalidades} />
        <Sel label="Destino" value={fDestino} onChange={(v) => { setFDestino(v); setPage(0); }} options={destinos} />
        <Sel label="Estado" value={fEstado} onChange={(v) => { setFEstado(v); setPage(0); }} options={estados} />
        {activeFilters > 0 && (
          <button onClick={clearFilters} className="text-xs text-destructive hover:underline">✕ Limpiar ({activeFilters})</button>
        )}
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Estado */}
        <Card title="Estado de importaciones">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={estadoChart} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                  {estadoChart.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Modalidad */}
        <Card title="Por modalidad">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modalidadChart} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Líneas" radius={[4, 4, 0, 0]}>
                  {modalidadChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Incoterms */}
        <Card title="Por Incoterms">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incotermsChart} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={50} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Líneas" radius={[0, 4, 4, 0]} barSize={16}>
                  {incotermsChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top proveedores */}
        <Card title="Top proveedores">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProveedores} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={90} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="lineas" name="Total" fill="#6366f1" stackId="a" barSize={14} />
                <Bar dataKey="pendientes" name="Pendientes" fill="#f59e0b" stackId="b" barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tabla principal */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Líneas de importación</h3>
          <span className="text-xs text-muted-foreground">{filtered.length} líneas · pág. {safePage + 1}/{totalPages}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1400px]">
            <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground text-left sticky top-0">
              <tr className="border-b border-border">
                <th className="px-3 py-2">LLAVE</th>
                <th className="px-3 py-2">OC</th>
                <th className="px-3 py-2">Pos</th>
                <th className="px-3 py-2">Proveedor</th>
                <th className="px-3 py-2">Material</th>
                <th className="px-3 py-2">Incoterms</th>
                <th className="px-3 py-2">Modalidad</th>
                <th className="px-3 py-2 text-right">QTY</th>
                <th className="px-3 py-2 text-right">Entreg.</th>
                <th className="px-3 py-2 text-right">Pend.</th>
                <th className="px-3 py-2">F. Contractual</th>
                <th className="px-3 py-2">ETD</th>
                <th className="px-3 py-2">ETA Puerto</th>
                <th className="px-3 py-2">ETA Campo</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Destino</th>
                <th className="px-3 py-2 text-right">USD</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((j) => {
                const ls = lineStatus(j);
                const pend = Math.max(0, Number(j.qty ?? 0) - Number(j.qtyEntregada ?? 0));
                const lsColor = ls === "Entregado" ? "bg-success/15 text-success" :
                  ls === "Vencido" ? "bg-destructive/15 text-destructive" :
                  ls === "Próximo a Vencer" ? "bg-warning/15 text-warning" :
                  ls === "Parcial" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground";
                return (
                  <tr key={j.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <Link to="/operaciones/$jobId" params={{ jobId: j.id } as any}
                        className="font-mono text-[11px] font-semibold text-info hover:underline">{jobLlave(j)}</Link>
                    </td>
                    <td className="px-3 py-2 text-foreground">{j.oc || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{j.posicion || "—"}</td>
                    <td className="px-3 py-2 max-w-[140px] truncate" title={j.proveedor ?? ""}>{j.proveedor || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={j.material ?? ""}>{j.material || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{j.incoterms || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{normModalidad(j)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(j.qty ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">{Number(j.qtyEntregada ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-warning">{pend.toLocaleString()}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{j.fechaEntregaContractual || j.fechaCompromiso || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{j.etdOrigen || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{j.etaPuerto || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{j.etaCampo || "—"}</td>
                    <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${lsColor}`}>{ls}</span></td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[100px] truncate">{j.lugarLlegada || j.destino || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(valorCompradoUsd(j), "USD")}</td>
                    <td className="px-3 py-2">
                      <Link to="/operaciones/$jobId" params={{ jobId: j.id } as any}
                        className="text-[10px] text-info hover:underline">Ver</Link>
                    </td>
                  </tr>
                );
              })}
              {pageData.length === 0 && (
                <tr><td colSpan={18} className="px-4 py-12 text-center text-sm text-muted-foreground">No hay líneas de importación con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-muted-foreground">
            {filtered.length > 0 ? `${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de ${filtered.length}` : "0"} líneas
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(0)} disabled={safePage === 0}
              className="h-8 px-2 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted">‹‹</button>
            <button onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}
              className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted">
              <ChevronLeft className="h-3.5 w-3.5 inline" /> Anterior
            </button>
            <span className="text-xs font-medium px-2">{safePage + 1} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
              className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted">
              Siguiente <ChevronRight className="h-3.5 w-3.5 inline" />
            </button>
            <button onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1}
              className="h-8 px-2 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted">››</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function Kpi({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1.5 text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <h3 className="text-xs font-semibold text-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="h-9 px-2 rounded-md border border-border bg-card text-xs min-w-[110px]">
      <option value="">{label}: Todos</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
