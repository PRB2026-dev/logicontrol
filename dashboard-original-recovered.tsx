import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { fmtMoney, jobLlave, valorCompradoUsd } from "@/lib/operational";
import type { Job } from "@/lib/jobs-data";
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
    if (s === "borrado" || s === "eliminado" || s.startsWith("borr") || s === "baja" || s === "anulado" || s === "cancelado") return "Borrado";
    if (s.includes("parcial") || s === "incompleto" || s === "entrega incompleta" || s.includes("parcialmente")) return "Entregado Parcial";
    if (s === "entregado" || s === "delivered" || s === "completo" || s === "completado") return "Entregado";
    if (s.includes("entregado") && !s.includes("parcial")) return "Entregado";
    if (s === "sin entrega" || s === "sin entregar" || s === "pendiente" || s === "no entregado") return "Sin entrega";
    return "Sin entrega";
  }
  const aa = norm(j.estadoAdicional);
  if (aa === "b") return "Borrado";
  const ls = norm(j.status);
  if (ls === "borrado" || ls.startsWith("borr") || ls === "baja" || ls === "anulado" || ls === "cancelado") return "Borrado";
  if (ls.includes("parcial") || ls === "incompleto" || ls === "entrega incompleta") return "Entregado Parcial";
  if (ls === "entregado" || ls === "cerrado" || ls === "facturado" || ls === "completo") return "Entregado";
  if (ls === "sin entrega" || ls === "sin entregar") return "Sin entrega";
  return "Sin entrega";
}

function trimestre(mes: number): number { return Math.ceil(mes / 3); }
function semestre(mes: number): number { return mes <= 6 ? 1 : 2; }

function deriveAnio(j: Job): number | null {
  if (j.anio) return j.anio;
  const ref = j.fechaOrden ?? j.fechaCreacion ?? null;
  if (!ref) return null;
  const d = new Date(ref);
  return isNaN(d.getTime()) ? null : d.getUTCFullYear();
}
function deriveMes(j: Job): number | null {
  if (j.mes) return j.mes;
  const ref = j.fechaOrden ?? j.fechaCreacion ?? null;
  if (!ref) return null;
  const d = new Date(ref);
  return isNaN(d.getTime()) ? null : d.getUTCMonth() + 1;
}

// ===== Clasificación BN (controlIncumplimiento) =====
const BN_CLOSED = new Set(["anticipado", "a tiempo", "retraso"]);
const normBN = (j: Job) => norm(j.controlIncumplimiento);
const isBNClosed = (bn: string) => BN_CLOSED.has(bn);
const isBNRetraso = (bn: string) => bn === "retraso";

// ===== Semáforo BK (diasIncumplimiento) – 6 grupos =====
type SemaforoGroup = {
  key: string; label: string;
  bg: string; text: string; border: string; dot: string;
  count: number; pct: number;
};

const SEMAFORO_DEFS: Omit<SemaforoGroup, "count" | "pct">[] = [
  { key: "g0", label: "A Tiempo y/o Anticipadas",  bg: "bg-emerald-500/10",  text: "text-emerald-600 dark:text-emerald-400",  border: "border-emerald-500/30",  dot: "bg-emerald-500"  },
  { key: "g1", label: "< 10 días",                  bg: "bg-yellow-400/10",  text: "text-yellow-600 dark:text-yellow-400",  border: "border-yellow-400/30",  dot: "bg-yellow-400"  },
  { key: "g2", label: "11 – 30 días",               bg: "bg-orange-500/10",  text: "text-orange-500",                       border: "border-orange-500/30",  dot: "bg-orange-500"  },
  { key: "g3", label: "31 – 60 días",               bg: "bg-red-400/10",     text: "text-red-400",                          border: "border-red-400/30",     dot: "bg-red-400"     },
  { key: "g4", label: "61 – 90 días",               bg: "bg-destructive/10", text: "text-destructive",                      border: "border-destructive/30", dot: "bg-destructive" },
  { key: "g5", label: "> 91 días",                  bg: "bg-rose-900/20",    text: "text-rose-600 dark:text-rose-400",      border: "border-rose-700/40",    dot: "bg-rose-700"    },
];

function bkGroupIdx(bk: number): number {
  if (bk <= 0)  return 0;
  if (bk <= 10) return 1;
  if (bk <= 30) return 2;
  if (bk <= 60) return 3;
  if (bk <= 90) return 4;
  return 5;
}

// Clasificación de líneas para la tabla ejecutiva (basada en estadoEntrega / estadoOf)
function isEntregadoTabla(j: Job) { return estadoOf(j) === "Entregado"; }
function isPendingTabla(j: Job) {
  const e = estadoOf(j);
  return e === "Entregado Parcial" || e === "Sin entrega";
}

// ===== Componente principal =====
function DashboardGerencial() {
  const rawJobs = useJobsStore((s) => s.jobs);

  // ── FILTROS ──
  const [fAnio, setFAnio] = useState("");
  const [fSemestre, setFSemestre] = useState("");
  const [fTrimestre, setFTrimestre] = useState("");
  const [fMes, setFMes] = useState("");
  const [fGerencia, setFGerencia] = useState("");
  const [fCampo, setFCampo] = useState("");
  const [fCuenta, setFCuenta] = useState("");
  const [fCategoriaSeguimiento, setFCategoriaSeguimiento] = useState("");
  const [fEstados, setFEstados] = useState<string[]>([]);

  const opt = (vals: (string | number | null | undefined)[]) =>
    Array.from(new Set(vals.map((v) => String(v ?? "").trim()).filter(Boolean))).sort();

  const aniosOpt               = useMemo(() => opt(rawJobs.map(deriveAnio)), [rawJobs]);
  const mesesOpt               = useMemo(() => opt(rawJobs.map(deriveMes)), [rawJobs]);
  const gerenciasOpt           = useMemo(() => opt(rawJobs.map((j) => j.gerencia)), [rawJobs]);
  const camposOpt              = useMemo(() => opt(rawJobs.map((j) => j.campo)), [rawJobs]);
  const cuentasOpt             = useMemo(() => opt(rawJobs.map((j) => j.cuenta)), [rawJobs]);
  const categoriasSeguimientoOpt = useMemo(() => opt(rawJobs.map((j) => j.categoriaSeguimiento)), [rawJobs]);

  const ESTADOS_FIJOS: EstadoOp[] = ["Borrado", "Entregado Parcial", "Entregado", "Sin entrega"];
  const estadosOpt = useMemo(() => {
    const fromData = new Set(rawJobs.map(estadoOf));
    return Array.from(new Set([...ESTADOS_FIJOS, ...fromData])).sort();
  }, [rawJobs]);

  const BF_MAP: Record<string, string> = {
    "Borrado": "borrado", "Entregado Parcial": "entrega parcial",
    "Entregado": "entregado", "Sin entrega": "sin entrega",
  };
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

  const semestresOpt = useMemo(() => {
    const s = rawJobs.map((j) => { const m = deriveMes(j) ?? 0; return m > 0 ? String(semestre(m)) : null; })
      .filter((v): v is string => v !== null);
    return Array.from(new Set(s)).sort();
  }, [rawJobs]);

  const trimestresOpt = useMemo(() => {
    const t = rawJobs.map((j) => { const m = deriveMes(j) ?? 0; return m > 0 ? String(trimestre(m)) : null; })
      .filter((v): v is string => v !== null);
    return Array.from(new Set(t)).sort();
  }, [rawJobs]);

  // ── FILTRADO ──
  const filtered = useMemo(() => rawJobs.filter((j) => {
    if (fAnio && String(deriveAnio(j) ?? "") !== fAnio) return false;
    const m = deriveMes(j) ?? 0;
    if (fMes && String(m) !== fMes) return false;
    if (fSemestre && m > 0 && String(semestre(m)) !== fSemestre) return false;
    if (fTrimestre && m > 0 && String(trimestre(m)) !== fTrimestre) return false;
    if (fGerencia && (j.gerencia ?? "").trim() !== fGerencia) return false;
    if (fCampo && (j.campo ?? "").trim() !== fCampo) return false;
    if (fCuenta && (j.cuenta ?? "").trim() !== fCuenta) return false;
    if (fCategoriaSeguimiento && (j.categoriaSeguimiento ?? "").trim() !== fCategoriaSeguimiento) return false;
    if (fEstados.length) {
      const rawBF = norm(j.estadoEntrega);
      const directHit = rawBF ? fEstados.some((fe) => BF_MAP[fe] === rawBF) : false;
      if (!directHit && !fEstados.includes(estadoOf(j))) return false;
    }
    return true;
  }), [rawJobs, fAnio, fSemestre, fTrimestre, fMes, fGerencia, fCampo, fCuenta, fCategoriaSeguimiento, fEstados]);

  const lineas = filtered;

  // ── OC Map (dedup por OC) ──
  const ocMap = useMemo(() => {
    const m = new Map<string, Job[]>();
    for (const j of lineas) {
      const k = (j.oc ?? jobLlave(j) ?? "").toString().trim();
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(j);
    }
    return m;
  }, [lineas]);
  const totalOC = ocMap.size;

  // ── KPIs OC via BN (controlIncumplimiento) ──
  // Una OC está ENTREGADA si TODAS sus líneas tienen BN en {anticipado, a tiempo, retraso}
  // Una OC es RETRASADA si ALGUNA línea tiene BN = retraso
  // A TIEMPO = ENTREGADA y sin líneas con retraso (BN = anticipado | a tiempo)
  // PENDIENTE = Total OC - ENTREGADAS
  const ocKpis = useMemo(() => {
    let entregadas = 0, atiempo = 0, retrasadas = 0;
    for (const [, ls] of ocMap) {
      const bns = ls.map(normBN);
      const allClosed = bns.every(isBNClosed);
      const anyRetraso = bns.some(isBNRetraso);
      if (allClosed) entregadas++;
      if (anyRetraso) retrasadas++;
      if (allClosed && !anyRetraso) atiempo++;
    }
    return { entregadas, atiempo, retrasadas, pendientes: totalOC - entregadas };
  }, [ocMap, totalOC]);

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  // ── Semáforo BK por OC: max(diasIncumplimiento) de todas las líneas de la OC ──
  const semaforoData = useMemo((): SemaforoGroup[] => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const [, ls] of ocMap) {
      const maxBK = ls.reduce((mx, j) => Math.max(mx, Number(j.diasIncumplimiento ?? 0)), 0);
      counts[bkGroupIdx(maxBK)]++;
    }
    return SEMAFORO_DEFS.map((g, i) => ({
      ...g,
      count: counts[i],
      pct: totalOC ? Math.round((counts[i] / totalOC) * 100) : 0,
    }));
  }, [ocMap, totalOC]);

  // ── Tabla ejecutiva (sin columna MAX BK) ──
  const tabla = useMemo(() => {
    const m = new Map<string, {
      campo: string; gerencia: string; cuenta: string;
      ocs: Set<string>; lineas: number;
      entregadas: number; pendientes: number; retrasadas: number;
      usd: number; unidades: number;
    }>();
    for (const j of lineas) {
      const campo    = (j.campo    ?? "—").trim() || "—";
      const gerencia = (j.gerencia ?? "—").trim() || "—";
      const cuenta   = (j.cuenta   ?? "—").trim() || "—";
      const k = `${campo}__${gerencia}__${cuenta}`;
      if (!m.has(k)) m.set(k, { campo, gerencia, cuenta, ocs: new Set(), lineas: 0, entregadas: 0, pendientes: 0, retrasadas: 0, usd: 0, unidades: 0 });
      const row = m.get(k)!;
      if (j.oc) row.ocs.add(String(j.oc).trim());
      row.lineas++;
      if (isEntregadoTabla(j)) row.entregadas++;
      if (isPendingTabla(j)) {
        row.pendientes++;
        if (Number(j.diasIncumplimiento ?? 0) > 0) row.retrasadas++;
      }
      row.usd      += valorCompradoUsd(j);
      row.unidades += Number(j.qty ?? 0);
    }
    return Array.from(m.values())
      .map((r) => ({ ...r, ocs: r.ocs.size }))
      .sort((a, b) => b.usd - a.usd);
  }, [lineas]);

  // ── RENDER ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard Gerencial</h1>
        <p className="text-sm text-muted-foreground">
          KPIs por OC · Clasificación BN (Control Incumplimiento) · Semáforo BK (Días Incumplimiento)
        </p>
      </div>

      {/* ── FILTROS ── */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Filtros</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Sel label="Año"      value={fAnio}      onChange={setFAnio}      options={aniosOpt} />
          <Sel label="Semestre" value={fSemestre}   onChange={setFSemestre}  options={semestresOpt} getLabel={(v) => `Semestre ${v}`} />
          <Sel label="Trimestre" value={fTrimestre} onChange={setFTrimestre} options={trimestresOpt} getLabel={(v) => `Q${v}`} />
          <Sel label="Mes" value={fMes} onChange={setFMes} options={mesesOpt}
            getLabel={(v) => { const n = parseInt(v, 10); return (!isNaN(n) && n >= 1 && n <= 12) ? `${MESES[n - 1]} (${n})` : v; }} />
          <Sel label="Gerencia" value={fGerencia}   onChange={setFGerencia}  options={gerenciasOpt} />
          <Sel label="Campo"    value={fCampo}      onChange={setFCampo}     options={camposOpt} />
          <Sel label="Cuenta"   value={fCuenta}     onChange={setFCuenta}    options={cuentasOpt} />
          <Sel label="Categoría seguimiento" value={fCategoriaSeguimiento} onChange={setFCategoriaSeguimiento} options={categoriasSeguimientoOpt} />
          <MultiStateFilter label="Estado BF" selected={fEstados} onChange={setFEstados} options={estadosOpt} counts={estadoCounts} />
        </div>
      </div>

      {/* ── KPIs ÓRDENES DE COMPRA (vía BN) ── */}
      <Section title="Órdenes de Compra · Clasificación exclusiva por BN (Control Incumplimiento)">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi icon={Package}      label="Total OC"              value={totalOC}            tint="chart-1" />
          <Kpi icon={CheckCircle2} label="Entregadas"            value={ocKpis.entregadas}  tint="success"
            sub={`${pct(ocKpis.entregadas, totalOC)}%`} />
          <Kpi icon={Clock}        label="Pendientes"             value={ocKpis.pendientes}  tint="warning"
            sub={`${pct(ocKpis.pendientes, totalOC)}%`} />
          <Kpi icon={XCircle}      label="Retrasadas"             value={ocKpis.retrasadas}  tint="destructive"
            sub={`${pct(ocKpis.retrasadas, totalOC)}%`} />
          <Kpi icon={TrendingUp}   label="A Tiempo + Anticipadas" value={ocKpis.atiempo}     tint="success"
            sub={`${pct(ocKpis.atiempo, totalOC)}%`} />
        </div>
      </Section>

      {/* ── SEMÁFORO BK ── */}
      <Section title="Semáforo de Cumplimiento · BK (Días Incumplimiento) · por OC">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {semaforoData.map((g) => (
            <div key={g.key} className={`rounded-lg border p-4 ${g.bg} ${g.border}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${g.dot}`} />
                <span className={`text-[10px] font-semibold uppercase tracking-wide leading-tight ${g.text}`}>
                  {g.label}
                </span>
              </div>
              <div className={`text-3xl font-bold tabular-nums ${g.text}`}>{g.count}</div>
              <div className={`text-xs mt-1 ${g.text} opacity-80`}>{g.pct}% del total</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── TABLA EJECUTIVA ── */}
      <Card title="Tabla ejecutiva" subtitle="Resumen por Campo · Gerencia · Cuenta">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Campo</th>
                <th className="py-2 pr-3">Gerencia</th>
                <th className="py-2 pr-3">Cuenta</th>
                <th className="py-2 pr-3 text-right">OC</th>
                <th className="py-2 pr-3 text-right">Líneas</th>
                <th className="py-2 pr-3 text-right">Entregadas</th>
                <th className="py-2 pr-3 text-right">Pendientes</th>
                <th className="py-2 pr-3 text-right">Retrasadas</th>
                <th className="py-2 pr-3 text-right">USD</th>
                <th className="py-2 pr-3 text-right">Unidades</th>
              </tr>
            </thead>
            <tbody>
              {tabla.slice(0, 80).map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium text-foreground">{r.campo}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.gerencia}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.cuenta}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.ocs}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.lineas}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-success">{r.entregadas}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-warning">{r.pendientes}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-destructive">{r.retrasadas}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(r.usd, "USD")}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.unidades.toLocaleString()}</td>
                </tr>
              ))}
              {tabla.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-muted-foreground text-sm">
                    Sin datos para los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ====== UI Helpers ======

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

const KPI_COLORS: Record<string, { icon: string; bg: string }> = {
  "chart-1":   { icon: "var(--chart-1)",        bg: "rgba(79,  70,  229, 0.14)" },
  success:     { icon: "var(--success)",         bg: "rgba(16,  185, 129, 0.14)" },
  warning:     { icon: "var(--warning)",         bg: "rgba(245, 158, 11,  0.14)" },
  destructive: { icon: "var(--destructive)",     bg: "rgba(239, 68,  68,  0.14)" },
  info:        { icon: "var(--info)",            bg: "rgba(59,  130, 246, 0.14)" },
  default:     { icon: "var(--muted-foreground)", bg: "rgba(107, 114, 128, 0.12)" },
};

function Kpi({
  icon: Icon, label, value, tint, sub,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string | number; tint: string; sub?: string;
}) {
  const c = KPI_COLORS[tint] ?? KPI_COLORS.default;
  return (
    <div className="border border-border rounded-lg p-4 bg-card shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: c.bg }}>
          <Icon className="h-4 w-4" style={{ color: c.icon }} />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground tabular-nums">{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: c.icon }}>{sub}</div>}
    </div>
  );
}

function Sel({
  label, value, onChange, options, getLabel,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; getLabel?: (v: string) => string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 px-2 rounded-md border border-border bg-card text-sm text-foreground"
      >
        <option value="">Todos</option>
        {options.map((o) => <option key={o} value={o}>{getLabel ? getLabel(o) : o}</option>)}
      </select>
    </label>
  );
}

function MultiStateFilter({
  label, selected, onChange, options, counts,
}: {
  label: string; selected: string[]; onChange: (value: string[]) => void;
  options: string[]; counts?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const displayLabel =
    selected.length === 0 ? "Todos"
    : selected.length === 1 ? selected[0]
    : `${selected.length} seleccionados`;

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

