import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { statusColors, type JobStatus, type Priority } from "@/lib/jobs-data";
import { computeAging, agingBucket, slaStatus, isCritico, fmtMoney, jobDelayDays, jobLlave, isOcActiva, lineaATiempo, lineaAtrasada, jobResponsable, orderStatusFromLines, DELAY_RANGES_30, delayRange30, valorCompradoUsd, valorPendienteUsdFn } from "@/lib/operational";
import { sweepJobs, groupByOc } from "@/lib/aggregations";
import { Package, AlertTriangle, ShieldCheck, ShieldAlert, Timer, Users, Flame, TrendingUp, FileStack, CheckCircle2, Clock, XCircle, Wallet, PackageCheck, PackageMinus, Layers, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, RadialBarChart, RadialBar, PolarAngleAxis, LabelList } from "recharts";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/dashboard-gerencial" />,
});

function Dashboard() {
  const rawJobs = useJobsStore((s) => s.jobs);

  // ===== FILTRO BASE ÚNICO: OC Activa (BF ∈ {Entrega Parcial, Sin entrega} AND BH ∈ {0, L}) =====
  const tienenFiltro = rawJobs.some((j) => (j.estadoEntrega ?? "") !== "" || (j.estadoAdicional ?? "") !== "");
  const baseJobs = tienenFiltro ? rawJobs.filter(isOcActiva) : rawJobs;

  // ===== FILTROS GLOBALES =====
  const [fProveedor, setFProveedor] = useState<string>("");
  const [fGerencia, setFGerencia] = useState<string>("");
  const [fCampo, setFCampo] = useState<string>("");
  const [fResponsable, setFResponsable] = useState<string>("");

  const proveedores = useMemo(() => Array.from(new Set(baseJobs.map((j) => (j.proveedor ?? "").trim()).filter(Boolean))).sort(), [baseJobs]);
  const gerencias = useMemo(() => Array.from(new Set(baseJobs.map((j) => (j.gerencia ?? "").trim()).filter(Boolean))).sort(), [baseJobs]);
  const campos = useMemo(() => Array.from(new Set(baseJobs.map((j) => (j.campo ?? "").trim()).filter(Boolean))).sort(), [baseJobs]);
  const responsables = useMemo(() => Array.from(new Set(baseJobs.map(jobResponsable))).sort(), [baseJobs]);

  const allJobs = useMemo(() => baseJobs.filter((j) =>
    (!fProveedor || (j.proveedor ?? "").trim() === fProveedor) &&
    (!fGerencia || (j.gerencia ?? "").trim() === fGerencia) &&
    (!fCampo || (j.campo ?? "").trim() === fCampo) &&
    (!fResponsable || jobResponsable(j) === fResponsable)
  ), [baseJobs, fProveedor, fGerencia, fCampo, fResponsable]);

  // Deduplicar por LLAVE (OC + ítem)
  const jobs = useMemo(() => {
    const seen = new Set<string>();
    return allJobs.filter((j) => {
      const k = jobLlave(j);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [allJobs]);
  const total = jobs.length;

  // ===== NIVEL 1 — ESTADO DE ÓRDENES =====
  const ocs = useMemo(() => groupByOc(jobs), [jobs]);
  const ocStatus = useMemo(() => ocs.map((g) => ({ ...g, estado: orderStatusFromLines(g.lineas) })), [ocs]);
  const totalOC = ocs.length;
  const ocEntregadas = ocStatus.filter((o) => o.estado === "Entregada").length;
  const ocParciales = ocStatus.filter((o) => o.estado === "Parcial").length;
  const ocPendientes = ocStatus.filter((o) => o.estado === "Pendiente").length;
  const ocAtrasadas = ocStatus.filter((o) => o.estado === "Atrasada").length;

  // ===== NIVEL 2 — LÍNEAS =====
  const lineasEntregadas = jobs.filter((j) => { const q=+(j.qty??0); const e=+(j.qtyEntregada??0); return q>0 && e>=q; }).length;
  const lineasAtrasadas = jobs.filter(lineaAtrasada).length;
  const lineasPendientes = total - lineasEntregadas - lineasAtrasadas;
  const lineasATiempo = jobs.filter(lineaATiempo).length;

  // USD por categoría (BC)
  let usdComprado = 0, usdEntregado = 0, usdPendiente = 0, usdAtrasado = 0;
  for (const j of jobs) {
    const c = valorCompradoUsd(j);
    const p = valorPendienteUsdFn(j);
    usdComprado += c;
    usdEntregado += Math.max(0, c - p);
    usdPendiente += p;
    if (lineaAtrasada(j)) usdAtrasado += p;
  }
  const pctE = total ? Math.round((lineasEntregadas / total) * 100) : 0;
  const pctP = total ? Math.round((lineasPendientes / total) * 100) : 0;
  const pctA = total ? Math.round((lineasAtrasadas / total) * 100) : 0;

  const sweep = sweepJobs(jobs);
  const cumplPct = pctE;
  const topRetraso = [...ocs]
    .sort((a, b) => b.vencidas - a.vencidas || b.qtyFaltante - a.qtyFaltante)
    .slice(0, 6);

  const slaArr = jobs.map((j) => ({ j, s: slaStatus(j) }));
  const slaCumplido = slaArr.filter((x) => x.s === "Cumplido").length;
  const slaRiesgo = slaArr.filter((x) => x.s === "En riesgo").length;
  const slaVencido = slaArr.filter((x) => x.s === "Vencido").length;
  const slaPct = total ? Math.round((slaCumplido / total) * 100) : 0;

  const criticos = jobs.filter(isCritico).length;
  const pendientes = jobs.filter((j) => !["Cerrado", "Facturado"].includes(j.status)).length;
  const escalados = jobs.filter((j) => j.escalado).length;

  const agingDays = jobs.map(computeAging);
  const agingProm = agingDays.length ? (agingDays.reduce((a, b) => a + b, 0) / agingDays.length).toFixed(1) : "0";

  const buckets = ["0-2", "3-5", "6-10", ">10"] as const;
  const agingDist = buckets.map((b) => ({
    name: `${b} d`,
    casos: jobs.filter((j) => agingBucket(computeAging(j)) === b).length,
  }));

  // ===== Rangos de incumplimiento (0-30, 31-60, 61-90, >90) sobre líneas atrasadas =====
  const atrasadas = jobs.filter(lineaAtrasada);
  const delayColors: Record<string, string> = {
    "0-30 días": "var(--info)",
    "31-60 días": "var(--warning)",
    "61-90 días": "#f97316",
    ">90 días": "var(--destructive)",
  };
  const incumplDist = DELAY_RANGES_30.map((r) => {
    const items = atrasadas.filter((j) => delayRange30(jobDelayDays(j)) === r);
    return {
      name: r,
      casos: items.length,
      usd: items.reduce((s, j) => s + valorPendienteUsdFn(j), 0),
    };
  });
  const totalIncumpl = incumplDist.reduce((a, b) => a + b.casos, 0);


  const prioOrder: Priority[] = ["Crítica", "Alta", "Media", "Baja"];
  const byPriority = prioOrder.map((p) => ({ name: p, value: jobs.filter((j) => j.prioridad === p).length }));

  const byStatus = (Object.keys(statusColors) as JobStatus[]).map((s) => ({
    name: s,
    value: jobs.filter((j) => j.status === s).length,
  }));

  // Productividad por responsable: usa TODAS las filas activas (sin dedupe
  // por llave) para no perder responsables que comparten OC+ítem. "Sin
  // asignar" cuando viene vacío, sin afectar los conteos numéricos.
  const productividad = Object.entries(
    allJobs.reduce<Record<string, { total: number; cerrados: number }>>((acc, j) => {
      const k = jobResponsable(j);
      if (!acc[k]) acc[k] = { total: 0, cerrados: 0 };
      acc[k].total += 1;
      if (["Cerrado", "Facturado", "Entregado"].includes(j.status)) acc[k].cerrados += 1;
      return acc;
    }, {}),
  )
    .map(([name, v]) => ({ name, total: v.total, cerrados: v.cerrados, pct: v.total ? Math.round((v.cerrados / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)", "var(--info)", "var(--destructive)"];
  const prioColors: Record<Priority, string> = {
    "Crítica": "var(--destructive)",
    Alta: "var(--warning)",
    Media: "var(--info)",
    Baja: "var(--muted-foreground)",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard ejecutivo</h1>
        <p className="text-sm text-muted-foreground">ERP operativo · Fuente: hoja <b>DATA FINAL</b> · Valores USD desde columna <b>BC</b>.</p>
      </div>

      {/* === FILTROS GLOBALES === */}
      <div className="bg-card border border-border rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <FilterSelect label="Proveedor" value={fProveedor} onChange={setFProveedor} options={proveedores} />
        <FilterSelect label="Gerencia" value={fGerencia} onChange={setFGerencia} options={gerencias} />
        <FilterSelect label="Campo" value={fCampo} onChange={setFCampo} options={campos} />
        <FilterSelect label="Responsable" value={fResponsable} onChange={setFResponsable} options={responsables} />
      </div>

      {/* === NIVEL 1 — ESTADO DE ÓRDENES === */}
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-2">Nivel 1 — Estado de Órdenes</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard icon={FileStack} label="Total Órdenes" value={totalOC} tint="chart-1" />
          <KpiCard icon={CheckCircle2} label="Entregadas" value={ocEntregadas} tint="success" />
          <KpiCard icon={PackageCheck} label="Parciales" value={ocParciales} tint="info" />
          <KpiCard icon={Clock} label="Pendientes" value={ocPendientes} tint="warning" />
          <KpiCard icon={XCircle} label="Atrasadas" value={ocAtrasadas} tint="destructive" />
        </div>
      </div>

      {/* === NIVEL 2 — ESTADO DE LÍNEAS === */}
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-2">Nivel 2 — Estado de Líneas ({total.toLocaleString()})</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LineStatCard tint="success" label="Entregadas" lineas={lineasEntregadas} usd={usdEntregado} pct={pctE} />
          <LineStatCard tint="warning" label="Pendientes" lineas={lineasPendientes} usd={usdPendiente - usdAtrasado} pct={pctP} />
          <LineStatCard tint="destructive" label="Atrasadas" lineas={lineasAtrasadas} usd={usdAtrasado} pct={pctA} />
        </div>
      </div>

      {/* === USD desde columna BC === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SweepCard
          title="Valor total comprado USD"
          subtitle="Suma de columna BC sobre filtros activos"
          value={fmtMoney(usdComprado, "USD")}
          icon={Wallet}
          tint="chart-1"
        />
        <SweepCard
          title="Valor entregado USD"
          subtitle={`${pctE}% de líneas entregadas`}
          value={fmtMoney(usdEntregado, "USD")}
          icon={PackageCheck}
          tint="success"
          progress={pctE}
        />
        <SweepCard
          title="Valor pendiente por entregar USD"
          subtitle={`${lineasPendientes + lineasAtrasadas} líneas sin entregar`}
          value={fmtMoney(usdPendiente, "USD")}
          icon={PackageMinus}
          tint="warning"
        />
      </div>

      {/* === Líneas a tiempo === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={CheckCircle2} label="Líneas a tiempo" value={lineasATiempo} tint="success" />
        <KpiCard icon={Layers} label="Líneas totales" value={total} tint="chart-2" />
        <KpiCard icon={Wallet} label="Cumplimiento" value={`${cumplPct}%`} tint="success" />
        <KpiCard icon={XCircle} label="USD atrasado" value={fmtMoney(usdAtrasado, "USD")} tint="destructive" />
      </div>


      {/* === Top OCs con mayor retraso === */}
      {topRetraso.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Órdenes con mayor pendiente</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Click para ver el detalle de la OC y sus líneas.</p>
            </div>
            <Link to="/operaciones" className="text-xs text-info hover:underline inline-flex items-center gap-1">Ver todas <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">OC</th>
                  <th className="py-2 pr-3">Líneas</th>
                  <th className="py-2 pr-3">Entregadas</th>
                  <th className="py-2 pr-3">Parciales</th>
                  <th className="py-2 pr-3">Vencidas</th>
                  <th className="py-2 pr-3 text-right">Qty total</th>
                  <th className="py-2 pr-3 text-right">Recibida</th>
                  <th className="py-2 pr-3 text-right">Faltante</th>
                  <th className="py-2 pr-3 text-right">Pend. USD</th>
                  <th className="py-2 pr-3 text-right">Pend. COP</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {topRetraso.map((g) => {
                  const first = g.lineas[0];
                  return (
                    <tr key={g.oc} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 pr-3 font-medium text-foreground">{g.oc}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{g.lineas.length}</td>
                      <td className="py-2 pr-3"><span className="text-success">{g.entregadas}</span></td>
                      <td className="py-2 pr-3"><span className="text-info">{g.parciales}</span></td>
                      <td className="py-2 pr-3"><span className="text-destructive font-semibold">{g.vencidas}</span></td>
                      <td className="py-2 pr-3 text-right tabular-nums">{g.qtyTotal.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-success">{g.qtyRecibida.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-warning">{g.qtyFaltante.toLocaleString()}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(g.valorPendienteUsd, "USD")}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(g.valorPendienteCop, "COP")}</td>
                      <td className="py-2 pr-3 text-right">
                        <Link to="/operaciones/$jobId" params={{ jobId: first.id } as any} className="text-info hover:underline text-xs">Detalle →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === KPIs operativos heredados === */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={Package} label="Total líneas" value={total} tint="chart-1" />
        <KpiCard icon={TrendingUp} label="Pendientes" value={pendientes} tint="info" />
        <KpiCard icon={Timer} label="Aging prom." value={`${agingProm}d`} tint="warning" />
        <KpiCard icon={Flame} label="Críticos" value={criticos} tint="destructive" />
        <KpiCard icon={AlertTriangle} label="Escalados" value={escalados} tint="warning" />
        <KpiCard icon={Users} label="Responsables" value={productividad.length} tint="chart-2" />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Cumplimiento por líneas" subtitle="% de líneas entregadas a tiempo" />
          <div className="h-56 relative">
            <ResponsiveContainer>
              <RadialBarChart
                innerRadius="65%"
                outerRadius="100%"
                data={[{ name: "Cumpl.", value: cumplPct, fill: "var(--success)" }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "var(--muted)" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-3xl font-semibold text-foreground">{cumplPct}%</div>
              <div className="text-xs text-muted-foreground">líneas cumplidas</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <SlaPill label="Entregadas" value={lineasEntregadas} color="success" />
            <SlaPill label="Pendientes" value={lineasPendientes} color="warning" />
            <SlaPill label="Atrasadas" value={lineasAtrasadas} color="destructive" />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Distribución de aging" subtitle="Antigüedad operativa por línea" />
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={agingDist} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="casos" radius={[6, 6, 0, 0]}>
                  {agingDist.map((b, i) => (
                    <Cell key={i} fill={["var(--success)", "var(--info)", "var(--warning)", "var(--destructive)"][i]} />
                  ))}
                  <LabelList dataKey="casos" position="top" fontSize={11} fill="var(--foreground)"
                    formatter={(v: number) => {
                      const t = agingDist.reduce((a, b) => a + b.casos, 0);
                      return t ? `${v} · ${Math.round((v / t) * 100)}%` : v;
                    }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* === Rangos de Incumplimiento (0-30 / 31-60 / 61-90 / >90) === */}
      <Card>
        <CardHeader title="Rangos de incumplimiento" subtitle="Líneas atrasadas y USD pendiente (columna BC) por rango de días" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="h-72 lg:col-span-2">
            <ResponsiveContainer>
              <BarChart data={incumplDist} margin={{ top: 20, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }}
                  formatter={(v: number, k: string) => k === "usd" ? fmtMoney(v, "USD") : v} />
                <Bar dataKey="casos" radius={[6, 6, 0, 0]}>
                  {incumplDist.map((b) => (
                    <Cell key={b.name} fill={delayColors[b.name]} />
                  ))}
                  <LabelList dataKey="casos" position="top" fontSize={11} fill="var(--foreground)"
                    formatter={(v: number) => totalIncumpl ? `${v} · ${Math.round((v / totalIncumpl) * 100)}%` : v} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2">
            {incumplDist.map((b) => {
              const pct = totalIncumpl ? Math.round((b.casos / totalIncumpl) * 100) : 0;
              return (
                <div key={b.name} className="p-2.5 rounded-md border border-border bg-card/40">
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-sm" style={{ background: delayColors[b.name] }} />
                    <span className="flex-1 text-sm text-foreground">{b.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{b.casos}</span>
                    <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 text-right tabular-nums">{fmtMoney(b.usd, "USD")}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Por prioridad" />
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byPriority} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}
                  label={(e: any) => {
                    const total = byPriority.reduce((a, b) => a + b.value, 0);
                    return total ? `${Math.round((e.value / total) * 100)}%` : "";
                  }}
                  labelLine={false}>
                  {byPriority.map((p) => <Cell key={p.name} fill={prioColors[p.name as Priority]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
            {byPriority.map((p) => (
              <div key={p.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: prioColors[p.name as Priority] }} />
                <span className="text-muted-foreground flex-1 truncate">{p.name}</span>
                <span className="font-medium text-foreground">{p.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Por estado operativo" />
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}
                  label={(e: any) => {
                    const total = byStatus.reduce((a, b) => a + b.value, 0);
                    return total && e.value ? `${Math.round((e.value / total) * 100)}%` : "";
                  }}
                  labelLine={false}>
                  {byStatus.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2">
            {byStatus.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: pieColors[i % pieColors.length] }} />
                <span className="text-muted-foreground flex-1 truncate">{s.name}</span>
                <span className="font-medium text-foreground">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Productividad por responsable" subtitle="Casos cerrados / asignados" />
          <div className="space-y-2.5">
            {productividad.map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground truncate">{p.name}</span>
                  <span className="text-muted-foreground tabular-nums">{p.cerrados}/{p.total} · {p.pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${p.pct}%`, background: p.pct >= 70 ? "var(--success)" : p.pct >= 40 ? "var(--warning)" : "var(--destructive)" }}
                  />
                </div>
              </div>
            ))}
            {productividad.length === 0 && <div className="text-xs text-muted-foreground">Sin datos.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
};

function KpiCard({ icon: Icon, label, value, tint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; tint: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`h-8 w-8 rounded-md flex items-center justify-center bg-${tint}/10`}>
          <Icon className={`h-4 w-4 text-${tint}`} />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SlaPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-md py-1.5 bg-${color}/10`}>
      <div className={`text-sm font-semibold text-${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
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

function SweepCard({ title, subtitle, value, icon: Icon, tint, progress }: { title: string; subtitle?: string; value: string; icon: React.ComponentType<{ className?: string }>; tint: string; progress?: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</div>
          <div className="mt-2 text-3xl font-semibold text-foreground tabular-nums">{value}</div>
          {subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <div className={`h-10 w-10 rounded-md flex items-center justify-center bg-${tint}/10`}>
          <Icon className={`h-5 w-5 text-${tint}`} />
        </div>
      </div>
      {typeof progress === "number" && (
        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full bg-${tint}`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-2 rounded-md border border-border bg-card text-sm text-foreground"
      >
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function LineStatCard({ tint, label, lineas, usd, pct }: { tint: string; label: string; lineas: number; usd: number; pct: number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold uppercase tracking-wide text-${tint}`}>{label}</div>
        <div className={`text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-${tint}/10 text-${tint}`}>{pct}%</div>
      </div>
      <div className="mt-2 text-3xl font-semibold text-foreground tabular-nums">{lineas.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">líneas</span></div>
      <div className="mt-1 text-sm text-muted-foreground tabular-nums">USD {usd.toLocaleString("es-CO", { maximumFractionDigits: 0 })}</div>
      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full bg-${tint}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  );
}
