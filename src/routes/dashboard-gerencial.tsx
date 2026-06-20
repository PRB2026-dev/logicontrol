import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { fmtMoney, valorCompradoUsd } from "@/lib/operational";
import type { Job } from "@/lib/jobs-data";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Package, CheckCircle2, Clock, XCircle, TrendingUp, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/dashboard-gerencial")({
  component: () => (
    <AppShell>
      <DashboardGerencial />
    </AppShell>
  ),
});

// ===== Helpers =====
const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];


type EstadoOp = "Entregado" | "Entregado Parcial" | "Sin entrega" | "Borrado";
function estadoOf(j: Job): EstadoOp {
  const s = norm(j.estadoEntrega);
  if (s) {
    // Valores del Excel columna BF: BORRADO, ENTREGA PARCIAL, ENTREGADO, SIN ENTREGA
    if (s === "borrado" || s === "eliminado" || s.startsWith("borr") || s === "baja" || s === "anulado" || s === "cancelado") return "Borrado";
    if (s.includes("parcial") || s === "incompleto" || s === "entrega incompleta" || s.includes("parcialmente")) return "Entregado Parcial";
    if (s === "entregado" || s === "delivered" || s === "completo" || s === "completado") return "Entregado";
    if (s.includes("entregado") && !s.includes("parcial")) return "Entregado";
    if (s === "sin entrega" || s === "sin entregar" || s === "pendiente" || s === "no entregado") return "Sin entrega";
    return "Sin entrega";
  }
  // Fallback 1: clasificación BH (columna BH) = "B" → Borrado
  const aa = norm(j.estadoAdicional);
  if (aa === "b") return "Borrado";
  // Fallback 2: campo status — puede contener valores BF si el header Excel era "ESTADO"
  // y el import lo capturó en status en vez de estadoEntrega
  const ls = norm(j.status);
  if (ls === "borrado" || ls.startsWith("borr") || ls === "baja" || ls === "anulado" || ls === "cancelado") return "Borrado";
  if (ls.includes("parcial") || ls === "incompleto" || ls === "entrega incompleta") return "Entregado Parcial";
  if (ls === "entregado" || ls === "cerrado" || ls === "facturado" || ls === "completo") return "Entregado";
  if (ls === "sin entrega" || ls === "sin entregar") return "Sin entrega";
  return "Sin entrega";
}

/** Derivar año desde columna CO o, como fallback, desde fechaOrden / fechaCreacion */
function deriveAnio(j: Job): number | null {
  if (j.anio) return j.anio;
  const ref = j.fechaOrden ?? j.fechaCreacion ?? null;
  if (!ref) return null;
  const d = new Date(ref);
  return isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

/** Derivar mes (1-12) desde columna CP o, como fallback, desde fechaOrden / fechaCreacion */
function deriveMes(j: Job): number | null {
  if (j.mes) return j.mes;
  const ref = j.fechaOrden ?? j.fechaCreacion ?? null;
  if (!ref) return null;
  const d = new Date(ref);
  return isNaN(d.getTime()) ? null : d.getUTCMonth() + 1;
}

// ─── BN / OC helpers ──────────────────────────────────────────────────────────
/** Clasifica el valor BN (controlIncumplimiento) de una línea */
type BNClass = "atiempo" | "retraso" | "pendiente";
function classBN(v: unknown): BNClass {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "anticipado" || s === "a tiempo") return "atiempo";
  if (s === "retraso") return "retraso";
  return "pendiente";
}
/** Para una OC con varias líneas, toma el peor resultado BN */
function worstBN(classes: BNClass[]): BNClass {
  if (classes.includes("retraso")) return "retraso";
  if (classes.includes("atiempo")) return "atiempo";
  return "pendiente";
}

// ─── Semáforo BK helpers ───────────────────────────────────────────────────────
type SemaforoKey = "atiempo" | "lt10" | "d1130" | "d3160" | "d6190" | "gt91";
function getSemaforoKey(dias: number | null): SemaforoKey {
  const d = dias ?? 0;
  if (d <= 0) return "atiempo";
  if (d <= 10) return "lt10";
  if (d <= 30) return "d1130";
  if (d <= 60) return "d3160";
  if (d <= 90) return "d6190";
  return "gt91";
}
const SEMAFORO_CONFIG: Array<{ key: SemaforoKey; label: string; color: string; textColor: string }> = [
  { key: "atiempo", label: "A Tiempo y/o Anticipadas", color: "#22c55e", textColor: "#166534" },
  { key: "lt10",   label: "< 10 días",                color: "#eab308", textColor: "#713f12" },
  { key: "d1130",  label: "11 - 30 días",             color: "#f97316", textColor: "#7c2d12" },
  { key: "d3160",  label: "31 - 60 días",             color: "#f87171", textColor: "#7f1d1d" },
  { key: "d6190",  label: "61 - 90 días",             color: "#ef4444", textColor: "#7f1d1d" },
  { key: "gt91",   label: "> 91 días",                color: "#991b1b", textColor: "#450a0a" },
];

function DashboardGerencial() {
  const rawJobs = useJobsStore((s) => s.jobs);

  // ===== FILTROS =====
  const [fAnio, setFAnio] = useState("");
  const [fMes, setFMes] = useState("");
  const [fGerencia, setFGerencia] = useState("");
  const [fCampo, setFCampo] = useState("");
  const [fCuenta, setFCuenta] = useState("");
  const [fCategoriaSeguimiento, setFCategoriaSeguimiento] = useState("");
  const [fEstados, setFEstados] = useState<string[]>([]);

  const opt = (vals: (string | number | null | undefined)[]) =>
    Array.from(new Set(vals.map((v) => String(v ?? "").trim()).filter(Boolean))).sort();

  const aniosOpt = useMemo(() => opt(rawJobs.map(deriveAnio)), [rawJobs]);
  const mesesOpt = useMemo(() => opt(rawJobs.map(deriveMes)), [rawJobs]);
  const gerenciasOpt = useMemo(() => opt(rawJobs.map((j) => j.gerencia)), [rawJobs]);
  const camposOpt = useMemo(() => opt(rawJobs.map((j) => j.campo)), [rawJobs]);
  const cuentasOpt = useMemo(() => opt(rawJobs.map((j) => j.cuenta)), [rawJobs]);
  const categoriasSeguimientoOpt = useMemo(() => opt(rawJobs.map((j) => j.categoriaSeguimiento)), [rawJobs]);

  const ESTADOS_FIJOS: EstadoOp[] = ["Borrado", "Entregado Parcial", "Entregado", "Sin entrega"];
  const estadosOpt = useMemo(() => {
    const fromData = new Set(rawJobs.map(estadoOf));
    return Array.from(new Set([...ESTADOS_FIJOS, ...fromData])).sort();
  }, [rawJobs]);

  const BF_MAP: Record<string, string> = {
    "Borrado": "borrado",
    "Entregado Parcial": "entrega parcial",
    "Entregado": "entregado",
    "Sin entrega": "sin entrega",
  };

  // Conteo de estados para badges del filtro
  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const j of rawJobs) {
      const rawBF = norm(j.estadoEntrega);
      const directKey = Object.entries(BF_MAP).find(([, v]) => v === rawBF)?.[0];
      const key = directKey ?? estadoOf(j);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [rawJobs]);

  const filtered = useMemo(() => rawJobs.filter((j) => {
    const anio = deriveAnio(j);
    if (fAnio && String(anio ?? "") !== fAnio) return false;
    const m = deriveMes(j) ?? 0;
    if (fMes && String(m) !== fMes) return false;
    if (fGerencia && (j.gerencia ?? "").trim() !== fGerencia) return false;
    if (fCampo && (j.campo ?? "").trim() !== fCampo) return false;
    if (fCuenta && (j.cuenta ?? "").trim() !== fCuenta) return false;
    if (fCategoriaSeguimiento && (j.categoriaSeguimiento ?? "").trim() !== fCategoriaSeguimiento) return false;
    if (fEstados.length) {
      const rawBF = norm(j.estadoEntrega);
      const directHit = rawBF ? fEstados.some((fe) => BF_MAP[fe] === rawBF) : false;
      const derivedHit = fEstados.includes(estadoOf(j));
      if (!directHit && !derivedHit) return false;
    }
    return true;
  }), [rawJobs, fAnio, fMes, fGerencia, fCampo, fCuenta, fCategoriaSeguimiento, fEstados]);

  const lineas = useMemo(() => filtered, [filtered]);

  // ── KPI OC (basados exclusivamente en BN = controlIncumplimiento) ─────────────
  const ocKpis = useMemo(() => {
    const ocMap = new Map<string, BNClass[]>();
    for (const j of lineas) {
      const ocKey = j.oc?.trim() || `__ln_${j.id}`;
      if (!ocMap.has(ocKey)) ocMap.set(ocKey, []);
      ocMap.get(ocKey)!.push(classBN(j.controlIncumplimiento));
    }
    let totalOC = 0, entregadas = 0, atiempo = 0, retraso = 0;
    for (const classes of ocMap.values()) {
      totalOC++;
      const w = worstBN(classes);
      if (w !== "pendiente") entregadas++;
      if (w === "atiempo") atiempo++;
      if (w === "retraso") retraso++;
    }
    return { totalOC, entregadas, atiempo, retraso, pendientes: totalOC - entregadas };
  }, [lineas]);

  // ── Semáforo BK (max BK por OC, 6 grupos) ────────────────────────────────────
  const semaforoData = useMemo(() => {
    const ocMaxBK = new Map<string, number>();
    for (const j of lineas) {
      const ocKey = j.oc?.trim() || `__ln_${j.id}`;
      const bk = j.diasIncumplimiento ?? 0;
      const cur = ocMaxBK.get(ocKey);
      if (cur === undefined || bk > cur) ocMaxBK.set(ocKey, bk);
    }
    const totalOC = ocMaxBK.size || 1;
    const counts: Record<SemaforoKey, number> = { atiempo: 0, lt10: 0, d1130: 0, d3160: 0, d6190: 0, gt91: 0 };
    for (const bk of ocMaxBK.values()) counts[getSemaforoKey(bk)]++;
    return SEMAFORO_CONFIG.map((s) => ({
      ...s,
      count: counts[s.key],
      pct: (counts[s.key] / totalOC) * 100,
    }));
  }, [lineas]);

  // ── Tabla ejecutiva (agrupada por campo / gerencia / cuenta, OC por BN) ────────
  const tabla = useMemo(() => {
    type Acc = {
      campo: string; gerencia: string; cuenta: string;
      ocBN: Map<string, BNClass[]>;
      usd: number; unidades: number;
    };
    const groups = new Map<string, Acc>();
    for (const j of lineas) {
      const campo    = (j.campo    ?? "—").trim() || "—";
      const gerencia = (j.gerencia ?? "—").trim() || "—";
      const cuenta   = (j.cuenta   ?? "—").trim() || "—";
      const gk = `${campo}__${gerencia}__${cuenta}`;
      if (!groups.has(gk)) groups.set(gk, { campo, gerencia, cuenta, ocBN: new Map(), usd: 0, unidades: 0 });
      const g = groups.get(gk)!;
      const ocKey = j.oc?.trim() || `__ln_${j.id}`;
      if (!g.ocBN.has(ocKey)) g.ocBN.set(ocKey, []);
      g.ocBN.get(ocKey)!.push(classBN(j.controlIncumplimiento));
      g.usd += valorCompradoUsd(j);
      g.unidades += Number(j.qty ?? 0);
    }
    return Array.from(groups.values()).map((g) => {
      let totalOC = 0, entregadas = 0, atiempo = 0, retraso = 0;
      for (const cls of g.ocBN.values()) {
        totalOC++;
        const w = worstBN(cls);
        if (w !== "pendiente") entregadas++;
        if (w === "atiempo") atiempo++;
        if (w === "retraso") retraso++;
      }
      return {
        campo: g.campo, gerencia: g.gerencia, cuenta: g.cuenta,
        totalOC, entregadas, atiempo, retraso, pendientes: totalOC - entregadas,
        usd: g.usd, unidades: g.unidades,
      };
    }).sort((a, b) => b.totalOC - a.totalOC);
  }, [lineas]);

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard Gerencial</h1>
        <p className="text-sm text-muted-foreground">
          {lineas.length.toLocaleString()} líneas · {ocKpis.totalOC.toLocaleString()} OC únicas
        </p>
      </div>

      {/* FILTROS GLOBALES */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Filtros</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <Sel label="Año" value={fAnio} onChange={setFAnio} options={aniosOpt} />
          <Sel label="Mes" value={fMes} onChange={setFMes} options={mesesOpt}
            getLabel={(v) => { const n = parseInt(v, 10); return (!isNaN(n) && n >= 1 && n <= 12) ? `${MESES[n - 1]} (${n})` : v; }} />
          <Sel label="Gerencia" value={fGerencia} onChange={setFGerencia} options={gerenciasOpt} />
          <Sel label="Campo" value={fCampo} onChange={setFCampo} options={camposOpt} />
          <Sel label="Cuenta" value={fCuenta} onChange={setFCuenta} options={cuentasOpt} />
          <Sel label="Categoría seguimiento" value={fCategoriaSeguimiento} onChange={setFCategoriaSeguimiento} options={categoriasSeguimientoOpt} />
          <MultiStateFilter label="Estado" selected={fEstados} onChange={setFEstados} options={estadosOpt} counts={estadoCounts} />
        </div>
      </div>

      {/* KPIs OC — basados en BN (controlIncumplimiento) */}
      <Section title="Órdenes de Compra · clasificación exclusiva por BN (columna BN)">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi icon={Package}      label="Total OC"   value={ocKpis.totalOC}    tint="chart-1" />
          <Kpi icon={CheckCircle2} label="Entregadas" value={ocKpis.entregadas} tint="success"
            sub={`${pct(ocKpis.entregadas, ocKpis.totalOC)}%`} />
          <Kpi icon={TrendingUp}   label="A Tiempo"   value={ocKpis.atiempo}    tint="info"
            sub={`${pct(ocKpis.atiempo, ocKpis.totalOC)}%`} />
          <Kpi icon={XCircle}      label="Retrasadas" value={ocKpis.retraso}    tint="destructive"
            sub={`${pct(ocKpis.retraso, ocKpis.totalOC)}%`} />
          <Kpi icon={Clock}        label="Pendientes" value={ocKpis.pendientes} tint="warning"
            sub={`${pct(ocKpis.pendientes, ocKpis.totalOC)}%`} />
        </div>
      </Section>

      {/* SEMÁFORO BK */}
      <Section title="Semáforo de Cumplimiento · días de incumplimiento (BK) · max por OC">
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {semaforoData.map((g) => (
              <div
                key={g.key}
                className="flex flex-col items-center p-3 rounded-lg border"
                style={{ borderColor: g.color + "60", backgroundColor: g.color + "12" }}
              >
                <span className="h-3 w-3 rounded-full mb-2" style={{ backgroundColor: g.color }} />
                <p className="text-xs text-center font-semibold leading-tight mb-2" style={{ color: g.textColor }}>
                  {g.label}
                </p>
                <p className="text-2xl font-bold">{g.count.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{g.pct.toFixed(1)}%</p>
              </div>
            ))}
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={semaforoData} margin={{ top: 4, right: 8, left: 0, bottom: 44 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} OC`, "Cantidad"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {semaforoData.map((g) => <Cell key={g.key} fill={g.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* TABLA EJECUTIVA */}
      <Section title="Tabla Ejecutiva · OC clasificadas por BN · Campo · Gerencia · Cuenta">
        <div className="bg-card border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 px-3">Campo</th>
                <th className="py-2 px-3">Gerencia</th>
                <th className="py-2 px-3">Cuenta</th>
                <th className="py-2 px-3 text-right">Total OC</th>
                <th className="py-2 px-3 text-right">Entregadas</th>
                <th className="py-2 px-3 text-right">A Tiempo</th>
                <th className="py-2 px-3 text-right">Retrasadas</th>
                <th className="py-2 px-3 text-right">Pendientes</th>
                <th className="py-2 px-3 text-right">USD</th>
                <th className="py-2 px-3 text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {tabla.slice(0, 100).map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 px-3 font-medium text-foreground">{r.campo}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.gerencia}</td>
                  <td className="py-2 px-3 text-muted-foreground">{r.cuenta}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-medium">{r.totalOC}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-success">{r.entregadas}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-info">{r.atiempo}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-destructive">{r.retraso}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-warning">{r.pendientes}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{fmtMoney(r.usd, "USD")}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.unidades.toLocaleString()}</td>
                </tr>
              ))}
              {tabla.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-muted-foreground">
                    Sin datos para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}


// ====== UI helpers ======
const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="mb-3">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const KPI_COLORS: Record<string, { icon: string; bg: string; text: string }> = {
  "chart-1": { icon: "var(--chart-1)", bg: "rgba(79, 70, 229, 0.14)", text: "var(--foreground)" },
  success: { icon: "var(--success)", bg: "rgba(16, 185, 129, 0.14)", text: "var(--foreground)" },
  warning: { icon: "var(--warning)", bg: "rgba(245, 158, 11, 0.14)", text: "var(--foreground)" },
  destructive: { icon: "var(--destructive)", bg: "rgba(239, 68, 68, 0.14)", text: "var(--foreground)" },
  info: { icon: "var(--info)", bg: "rgba(59, 130, 246, 0.14)", text: "var(--foreground)" },
  default: { icon: "var(--muted-foreground)", bg: "rgba(107, 114, 128, 0.12)", text: "var(--foreground)" },
};

function Kpi({ icon: Icon, label, value, tint, sub, big }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string | number; tint: string; sub?: string; big?: boolean }) {
  const colors = KPI_COLORS[tint] ?? KPI_COLORS.default;
  return (
    <div className="border border-border rounded-lg p-4 bg-card shadow-sm" style={{ backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
          <Icon className="h-4 w-4" style={{ color: colors.icon }} />
        </div>
      </div>
      <div className={`mt-2 font-semibold text-foreground tabular-nums ${big ? "text-xl" : "text-2xl"}`}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: colors.icon }}>{sub}</div>}
    </div>
  );
}

function Sel({ label, value, onChange, options, getLabel }: { label: string; value: string; onChange: (v: string) => void; options: string[]; getLabel?: (v: string) => string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 px-2 rounded-md border border-border bg-card text-sm text-foreground">
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{getLabel ? getLabel(o) : o}</option>)}
      </select>
    </label>
  );
}

function MultiStateFilter({ label, selected, onChange, options, counts }: { label: string; selected: string[]; onChange: (value: string[]) => void; options: string[]; counts?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const toggle = (value: string) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(next);
  };

  const displayLabel = selected.length === 0 ? "Todos" : selected.length === 1 ? selected[0] : `${selected.length} seleccionados`;

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-2 rounded-md border border-border bg-card text-sm text-foreground text-left flex items-center justify-between gap-1"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 min-w-full bg-card border border-border rounded-md shadow-md py-1">
          <label className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-muted/40">
            <input type="checkbox" checked={selected.length === 0} onChange={() => onChange([])} className="h-3.5 w-3.5 rounded border-border" />
            <span className="text-sm text-foreground whitespace-nowrap">Todos</span>
          </label>
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 cursor-pointer px-3 py-1.5 hover:bg-muted/40">
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} className="h-3.5 w-3.5 rounded border-border" />
              <span className="text-sm text-foreground whitespace-nowrap">{o}</span>
              {counts !== undefined && (
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{counts[o] ?? 0}</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

