import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { fmtMoney, valorCompradoUsd, valorPendienteUsdFn, jobLlave } from "@/lib/operational";
import type { Job } from "@/lib/jobs-data";
import { useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight, Package, Wallet, PackageMinus, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/casos")({
  component: () => (
    <AppShell>
      <OrdenesCompra />
    </AppShell>
  ),
});

// ─── helpers ──────────────────────────────────────────────────────────────────
const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();

type EstadoLinea = "Entregado" | "Entregado Parcial" | "Sin entrega" | "Borrado";
function estadoLinea(j: Job): EstadoLinea {
  const s = norm(j.estadoEntrega);
  if (s) {
    if (s === "borrado" || s.startsWith("borr") || s === "baja" || s === "anulado") return "Borrado";
    if (s.includes("parcial") || s === "incompleto") return "Entregado Parcial";
    if (s === "entregado" || s === "delivered" || s === "completo") {
      const q = Number(j.qty ?? 0); const e = Number(j.qtyEntregada ?? 0);
      if (q > 0 && e > 0 && e < q) return "Entregado Parcial";
      return "Entregado";
    }
    if (s.includes("entregado") && !s.includes("parcial")) return "Entregado";
  }
  const aa = norm(j.estadoAdicional);
  if (aa === "b") return "Borrado";
  return "Sin entrega";
}

type OcSummary = {
  oc: string;
  proveedor: string;
  gerencia: string;
  campo: string;
  lineas: Job[];
  totalLineas: number;
  entregadas: number;
  pendientes: number;
  usdComprado: number;
  usdPendiente: number;
  diasMaxIncumpl: number;
};

function buildOcSummary(jobs: Job[]): OcSummary[] {
  const map = new Map<string, Job[]>();
  for (const j of jobs) {
    const key = (j.oc ?? "").trim() || `SIN-OC-${j.id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(j);
  }
  return Array.from(map.entries()).map(([oc, lineas]) => {
    const entregadas = lineas.filter((j) => estadoLinea(j) === "Entregado").length;
    const usdComprado = lineas.reduce((s, j) => s + valorCompradoUsd(j), 0);
    const usdPendiente = lineas.reduce((s, j) => s + valorPendienteUsdFn(j), 0);
    const diasMax = Math.max(0, ...lineas.map((j) => j.diasIncumplimiento ?? 0));
    return {
      oc,
      proveedor: lineas[0]?.proveedor ?? "—",
      gerencia: lineas[0]?.gerencia ?? "—",
      campo: lineas[0]?.campo ?? "—",
      lineas,
      totalLineas: lineas.length,
      entregadas,
      pendientes: lineas.length - entregadas,
      usdComprado,
      usdPendiente,
      diasMaxIncumpl: diasMax,
    };
  }).sort((a, b) => b.pendientes - a.pendientes);
}

// ─── Componente principal ─────────────────────────────────────────────────────
const PAGE_SIZE = 25;

function OrdenesCompra() {
  const jobs = useJobsStore((s) => s.jobs);
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState<"" | "pendientes" | "entregadas">("pendientes");
  const [expandedOc, setExpandedOc] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const ocs = useMemo(() => buildOcSummary(jobs), [jobs]);

  const filtered = useMemo(() => {
    let list = ocs;
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((o) =>
        o.oc.toLowerCase().includes(t) ||
        o.proveedor.toLowerCase().includes(t) ||
        o.gerencia.toLowerCase().includes(t) ||
        o.campo.toLowerCase().includes(t)
      );
    }
    if (fEstado === "pendientes") list = list.filter((o) => o.pendientes > 0);
    if (fEstado === "entregadas") list = list.filter((o) => o.entregadas > 0 && o.pendientes === 0);
    return list;
  }, [ocs, q, fEstado]);

  // Reset page when filters change
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const paginatedOcs = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // KPIs globales
  const kpis = useMemo(() => ({
    totalOc: ocs.length,
    totalLineas: ocs.reduce((s, o) => s + o.totalLineas, 0),
    pendientes: ocs.filter((o) => o.pendientes > 0).length,
    usdTotal: ocs.reduce((s, o) => s + o.usdComprado, 0),
    usdPendiente: ocs.reduce((s, o) => s + o.usdPendiente, 0),
  }), [ocs]);

  const pct = (n: number, d: number) => d ? Math.round((n / d) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Órdenes de Compra</h1>
        <p className="text-sm text-muted-foreground">
          {kpis.totalOc.toLocaleString()} órdenes · {kpis.totalLineas.toLocaleString()} líneas en total
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiBox icon={Package} label="Total OC" value={kpis.totalOc.toLocaleString()} color="#6366f1" />
        <KpiBox icon={AlertTriangle} label="OC con pendientes" value={kpis.pendientes.toLocaleString()} color="#f59e0b"
          sub={`${pct(kpis.pendientes, kpis.totalOc)}%`} />
        <KpiBox icon={CheckCircle2} label="OC completadas" value={(kpis.totalOc - kpis.pendientes).toLocaleString()} color="#10b981"
          sub={`${pct(kpis.totalOc - kpis.pendientes, kpis.totalOc)}%`} />
        <KpiBox icon={Wallet} label="USD Total" value={fmtMoney(kpis.usdTotal, "USD")} color="#6366f1" />
        <KpiBox icon={PackageMinus} label="USD Pendiente" value={fmtMoney(kpis.usdPendiente, "USD")} color="#ef4444"
          sub={`${pct(kpis.usdPendiente, kpis.usdTotal)}%`} />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Buscar OC, proveedor, gerencia, campo..."
            className="w-full h-9 pl-9 pr-3 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        {(["" , "pendientes", "entregadas"] as const).map((v) => (
          <button key={v} type="button" onClick={() => { setFEstado(v); setPage(0); }}
            className={`px-3 h-9 rounded-md text-xs font-semibold border transition-colors ${fEstado === v ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}>
            {v === "" ? "Todas" : v === "pendientes" ? "Con pendientes" : "Completadas"}
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} órdenes · pág. {safePage + 1}/{totalPages}</span>
      </div>

      {/* Tabla de OC */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
              <th className="py-2.5 px-3 w-8" />
              <th className="py-2.5 px-3">OC</th>
              <th className="py-2.5 px-3">Proveedor</th>
              <th className="py-2.5 px-3">Gerencia</th>
              <th className="py-2.5 px-3">Campo</th>
              <th className="py-2.5 px-3 text-right">Líneas</th>
              <th className="py-2.5 px-3 text-right">Entregadas</th>
              <th className="py-2.5 px-3 text-right">Pendientes</th>
              <th className="py-2.5 px-3 text-right">USD Comprado</th>
              <th className="py-2.5 px-3 text-right">USD Pendiente</th>
              <th className="py-2.5 px-3 text-right">Max. Incumpl.</th>
              <th className="py-2.5 px-3" />
            </tr>
          </thead>
          <tbody>
            {paginatedOcs.map((oc) => {
              const isOpen = expandedOc === oc.oc;
              const cumplPct = pct(oc.entregadas, oc.totalLineas);
              const urgColor = oc.diasMaxIncumpl > 90 ? "#991b1b"
                : oc.diasMaxIncumpl > 60 ? "#ef4444"
                : oc.diasMaxIncumpl > 30 ? "#f97316"
                : oc.diasMaxIncumpl > 10 ? "#eab308"
                : "#22c55e";
              return (
                <>
                  <tr key={oc.oc}
                    className={`border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer ${isOpen ? "bg-muted/10" : ""}`}
                    onClick={() => setExpandedOc(isOpen ? null : oc.oc)}
                  >
                    <td className="px-3 py-3">
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(-90deg)" }} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs font-semibold text-info">{oc.oc}</td>
                    <td className="px-3 py-3 text-foreground max-w-[160px] truncate" title={oc.proveedor}>{oc.proveedor}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{oc.gerencia}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{oc.campo}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-medium">{oc.totalLineas}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-emerald-600 font-medium">{oc.entregadas}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold" style={{ color: oc.pendientes > 0 ? "#f59e0b" : "#10b981" }}>{oc.pendientes}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground text-xs">{fmtMoney(oc.usdComprado, "USD")}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-xs">
                      <span style={{ color: oc.usdPendiente > 0 ? "#ef4444" : "#10b981" }}>{fmtMoney(oc.usdPendiente, "USD")}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {oc.diasMaxIncumpl > 0
                        ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${urgColor}20`, color: urgColor }}>+{oc.diasMaxIncumpl}d</span>
                        : <span className="text-emerald-600 text-[10px] font-semibold">A tiempo</span>}
                    </td>
                    <td className="px-3 py-3">
                      {/* Barra de progreso */}
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${cumplPct}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">{cumplPct}%</span>
                      </div>
                    </td>
                  </tr>

                  {/* Líneas expandidas */}
                  {isOpen && (
                    <tr key={`${oc.oc}-expanded`} className="bg-muted/5">
                      <td colSpan={12} className="p-0">
                        <div className="border-t border-border/40">
                          {/* Header de líneas */}
                          <div className="flex items-center justify-between px-6 py-2 bg-muted/20">
                            <span className="text-xs font-semibold text-foreground">{oc.totalLineas} líneas · OC {oc.oc}</span>
                            <button type="button"
                              onClick={(e) => { e.stopPropagation(); navigate({ to: "/operaciones", search: { q: oc.oc } }); }}
                              className="inline-flex items-center gap-1 text-xs text-info hover:underline">
                              Ver todas en Operaciones <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border/30 bg-muted/10">
                                <th className="py-1.5 px-6">LLAVE</th>
                                <th className="py-1.5 px-3">Pos.</th>
                                <th className="py-1.5 px-3">Material</th>
                                <th className="py-1.5 px-3">Estado Entrega</th>
                                <th className="py-1.5 px-3 text-right">Qty</th>
                                <th className="py-1.5 px-3 text-right">Qty Entregada</th>
                                <th className="py-1.5 px-3 text-right">USD</th>
                                <th className="py-1.5 px-3 text-right">Días Incumpl.</th>
                                <th className="py-1.5 px-3">Fecha Compromiso</th>
                                <th className="py-1.5 px-3" />
                              </tr>
                            </thead>
                            <tbody>
                              {oc.lineas.map((j) => {
                                const est = estadoLinea(j);
                                const estColor = est === "Entregado" ? "#10b981"
                                  : est === "Entregado Parcial" ? "#3b82f6"
                                  : est === "Borrado" ? "#6b7280"
                                  : "#f59e0b";
                                const dias = j.diasIncumplimiento ?? 0;
                                const dColor = dias > 60 ? "#ef4444" : dias > 30 ? "#f97316" : dias > 10 ? "#eab308" : "#22c55e";
                                return (
                                  <tr key={j.id} className="border-b border-border/20 hover:bg-muted/20">
                                    <td className="py-2 px-6 font-mono text-info">{jobLlave(j)}</td>
                                    <td className="py-2 px-3 text-muted-foreground">{j.posicion ?? "—"}</td>
                                    <td className="py-2 px-3 text-foreground max-w-[180px] truncate" title={j.material ?? ""}>{j.material ?? "—"}</td>
                                    <td className="py-2 px-3">
                                      <span className="inline-flex px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${estColor}20`, color: estColor }}>{est}</span>
                                    </td>
                                    <td className="py-2 px-3 text-right tabular-nums">{(j.qty ?? 0).toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">{(j.qtyEntregada ?? 0).toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtMoney(valorCompradoUsd(j), "USD")}</td>
                                    <td className="py-2 px-3 text-right">
                                      {dias !== 0 && <span className="font-bold" style={{ color: dColor }}>{dias > 0 ? `+${dias}d` : `${dias}d`}</span>}
                                      {dias === 0 && <span className="text-emerald-600">A tiempo</span>}
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground">{j.fechaCompromiso ?? "—"}</td>
                                    <td className="py-2 px-3">
                                      <Link to="/operaciones/$jobId" params={{ jobId: j.id } as any}
                                        className="inline-flex items-center gap-0.5 text-info hover:underline" onClick={(e) => e.stopPropagation()}>
                                        Detalle <ChevronRight className="h-3 w-3" />
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="py-12 text-center text-sm text-muted-foreground">Sin órdenes con esos filtros.</td></tr>
            )}
          </tbody>
        </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-muted-foreground">
            Mostrando {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length} órdenes
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(0)} disabled={safePage === 0}
              className="h-8 px-2 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
              ‹‹
            </button>
            <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}
              className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
              ‹ Anterior
            </button>
            <span className="text-xs text-foreground font-medium px-2">{safePage + 1} / {totalPages}</span>
            <button type="button" onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))} disabled={safePage >= totalPages - 1}
              className="h-8 px-3 rounded-md border border-border text-xs disabled:opacity-40 hover:bg-muted transition-colors">
              Siguiente ›
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

function KpiBox({ icon: Icon, label, value, color, sub }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string; color: string; sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <div className="text-xl font-bold tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color }}>{sub}</div>}
    </div>
  );
}
