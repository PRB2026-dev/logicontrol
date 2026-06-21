import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { fmtMoney, jobDelayDays, jobLlave, valorCompradoUsd, valorRecibidoUsd, valorPendienteUsdFn } from "@/lib/operational";
import type { Job } from "@/lib/jobs-data";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, LabelList, LineChart, Line, Legend } from "recharts";
import { Package, CheckCircle2, Clock, XCircle, Wallet, PackageCheck, PackageMinus, Layers, Boxes, TrendingUp, TrendingDown, Timer, AlertTriangle, ChevronDown } from "lucide-react";

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

// ─── Paleta unificada de gráficos ───────────────────────────────────────────
const P = {
  anticipado: "#10b981",  // emerald — entregado anticipado
  atiempo:    "#3b82f6",  // blue    — entregado a tiempo
  retrasado:  "#ef4444",  // red     — entregado retrasado
  pendiente:  "#f59e0b",  // amber   — pendiente de entrega
  comprado:   "#6366f1",  // indigo  — USD total comprado
  recibido:   "#0ea5e9",  // sky     — USD recibido
} as const;

type EstadoOp = "Entregado" | "Entregado Parcial" | "Sin entrega" | "Borrado";
function estadoOf(j: Job): EstadoOp {
  const s = norm(j.estadoEntrega);
  if (s) {
    if (s === "borrado" || s === "eliminado" || s.startsWith("borr") || s === "baja" || s === "anulado" || s === "cancelado") return "Borrado";
    if (
      s.includes("parcial") ||
      s === "incompleto" ||
      s === "entrega incompleta" ||
      s.includes("parcialmente") ||
      s === "partial" ||
      s === "entregado parcial" ||
      s === "entrega parcial"
    ) return "Entregado Parcial";
    if (s === "entregado" || s === "delivered" || s === "completo" || s === "completado") {
      const q = Number(j.qty ?? 0); const e = Number(j.qtyEntregada ?? 0);
      if (q > 0 && e > 0 && e < q) return "Entregado Parcial";
      return "Entregado";
    }
    if (s.includes("entregado") && !s.includes("parcial")) {
      const q = Number(j.qty ?? 0); const e = Number(j.qtyEntregada ?? 0);
      if (q > 0 && e > 0 && e < q) return "Entregado Parcial";
      return "Entregado";
    }
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

function isEntregado(j: Job) { return estadoOf(j) === "Entregado"; }
function isPending(j: Job) { return estadoOf(j) === "Entregado Parcial" || estadoOf(j) === "Sin entrega"; }

type Cumpl = "Anticipado" | "A tiempo" | "Retrasado";
function cumplOf(j: Job): Cumpl {
  const d = jobDelayDays(j);
  if (d < 0) return "Anticipado";
  if (d === 0) return "A tiempo";
  return "Retrasado";
}

function trimestre(mes: number): number { return Math.ceil(mes / 3); }
function semestre(mes: number): number { return mes <= 6 ? 1 : 2; }

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
/** Clasifica una línea como atiempo / retraso / pendiente.
 *  Prioriza controlIncumplimiento (BN). Si está vacío, usa estadoEntrega + diasIncumplimiento. */
type BNClass = "atiempo" | "retraso" | "pendiente";
function classBN(j: Job): BNClass {
  const s = String(j.controlIncumplimiento ?? "").trim().toLowerCase();
  if (s && s !== "null" && s !== "undefined") {
    if (s.includes("anticip") || s.includes("a tiempo") || s === "no" || s === "cumple") return "atiempo";
    if (s.includes("retraso") || s.includes("retras") || s === "si" || s === "sí" || s === "con incumplimiento") return "retraso";
  }
  // Fallback: si no hay valor BN, usar estado de entrega + días de incumplimiento
  const est = estadoOf(j);
  if (est === "Sin entrega" || est === "Entregado Parcial") return "pendiente";
  const d = j.diasIncumplimiento ?? 0;
  if (d <= 0) return "atiempo";
  return "retraso";
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

// ─── Semáforo original 5 categorías ───────────────────────────────────────────
const SEMAFORO_5 = [
  { label: "A tiempo",   dot: "#22c55e", bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300" },
  { label: "1-10 días",  dot: "#eab308", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-300" },
  { label: "11-30 días", dot: "#f97316", bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  { label: "31-60 días", dot: "#f87171", bg: "bg-red-100",    text: "text-red-800",    border: "border-red-300" },
  { label: "> 60 días",  dot: "#991b1b", bg: "bg-red-200",    text: "text-red-900",    border: "border-red-400" },
];

function semaforoBK(bk: number | null) {
  const d = bk ?? 0;
  if (d <= 0)  return SEMAFORO_5[0];
  if (d <= 10) return SEMAFORO_5[1];
  if (d <= 30) return SEMAFORO_5[2];
  if (d <= 60) return SEMAFORO_5[3];
  return SEMAFORO_5[4];
}

function DashboardGerencial() {
  const rawJobs = useJobsStore((s) => s.jobs);

  // ===== FILTROS =====
  const [fAnio, setFAnio] = useState("");
  const [fSemestre, setFSemestre] = useState("");
  const [fTrimestre, setFTrimestre] = useState("");
  const [fMes, setFMes] = useState("");
  const [fGerencia, setFGerencia] = useState("");
  const [fCampo, setFCampo] = useState("");
  const [fCuenta, setFCuenta] = useState("");
  const [fCategoriaSeguimiento, setFCategoriaSeguimiento] = useState("");
  const [fEstados, setFEstados] = useState<string[]>([]);
  const [fSemaforoKey, setFSemaforoKey] = useState<SemaforoKey | "">("");

  const opt = (vals: (string | number | null | undefined)[]) =>
    Array.from(new Set(vals.map((v) => String(v ?? "").trim()).filter(Boolean))).sort();

  const aniosOpt = useMemo(() => opt(rawJobs.map(deriveAnio)), [rawJobs]);
  const mesesOpt = useMemo(() => opt(rawJobs.map(deriveMes)), [rawJobs]);
  const gerenciasOpt = useMemo(() => opt(rawJobs.map((j) => j.gerencia)), [rawJobs]);
  const camposOpt = useMemo(() => opt(rawJobs.map((j) => j.campo)), [rawJobs]);
  const cuentasOpt = useMemo(() => opt(rawJobs.map((j) => j.cuenta)), [rawJobs]);
  const categoriasSeguimientoOpt = useMemo(() => opt(rawJobs.map((j) => j.categoriaSeguimiento)), [rawJobs]);

  const semestresOpt = useMemo(() => {
    const s = Array.from(new Set(rawJobs.map((j) => {
      const m = deriveMes(j) ?? 0;
      if (m <= 0) return null;
      return String(semestre(m));
    }).filter((v): v is string => v !== null)));
    return s.sort();
  }, [rawJobs]);

  const trimestresOpt = useMemo(() => {
    const t = Array.from(new Set(rawJobs.map((j) => {
      const m = deriveMes(j) ?? 0;
      if (m <= 0) return null;
      return String(trimestre(m));
    }).filter((v): v is string => v !== null)));
    return t.sort();
  }, [rawJobs]);

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

  const estadoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const j of rawJobs) {
      // Usar estadoOf(j) como única fuente de clasificación
      // para que conteo y filtro sean siempre consistentes
      const key = estadoOf(j);
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [rawJobs]);

  const filtered = useMemo(() => rawJobs.filter((j) => {
    const anio = deriveAnio(j);
    if (fAnio && String(anio ?? "") !== fAnio) return false;
    const m = deriveMes(j) ?? 0;
    if (fMes && String(m) !== fMes) return false;
    if (fSemestre && m > 0 && String(semestre(m)) !== fSemestre) return false;
    if (fTrimestre && m > 0 && String(trimestre(m)) !== fTrimestre) return false;
    if (fGerencia && (j.gerencia ?? "").trim() !== fGerencia) return false;
    if (fCampo && (j.campo ?? "").trim() !== fCampo) return false;
    if (fCuenta && (j.cuenta ?? "").trim() !== fCuenta) return false;
    if (fCategoriaSeguimiento && (j.categoriaSeguimiento ?? "").trim() !== fCategoriaSeguimiento) return false;
    if (fEstados.length) {
      // estadoOf(j) es la única fuente — igual que estadoCounts
      if (!fEstados.includes(estadoOf(j))) return false;
    }
    if (fSemaforoKey && getSemaforoKey(j.diasIncumplimiento ?? 0) !== fSemaforoKey) return false;
    return true;
  }), [rawJobs, fAnio, fMes, fSemestre, fTrimestre, fGerencia, fCampo, fCuenta, fCategoriaSeguimiento, fEstados, fSemaforoKey]);

  const lineas = useMemo(() => filtered, [filtered]);

  // ─── KPIs USD ───────────────────────────────────────────────────────────────
  // Se suman TODAS las líneas del filtro activo (el filtro de estados controla
  // qué se incluye; no se excluye ningún estado de forma hardcodeada).
  const usdComprado  = useMemo(() => lineas.reduce((s, j) => s + valorCompradoUsd(j), 0), [lineas]);
  // valorRecibidoUsd retorna 0 para Sin entrega / Borrado de forma natural
  const usdRecibido  = useMemo(() => lineas.reduce((s, j) => s + valorRecibidoUsd(j), 0), [lineas]);
  const usdPendiente = useMemo(() => usdComprado - usdRecibido, [usdComprado, usdRecibido]);

  // ─── KPIs Líneas ────────────────────────────────────────────────────────────
  const lineasTotal      = lineas.length;
  const lineasEntregadas = useMemo(() => lineas.filter(isEntregado).length, [lineas]);
  const lineasAtiempo    = useMemo(() => lineas.filter((j) => isEntregado(j) && (j.diasIncumplimiento ?? 0) <= 0).length, [lineas]);
  const lineasTarde      = useMemo(() => lineas.filter((j) => isEntregado(j) && (j.diasIncumplimiento ?? 0) > 0).length, [lineas]);
  // Total - Entregadas garantiza que Entregadas + Pendientes = Total (incluye borrados/cancelados)
  const lineasPendientes = useMemo(() => lineasTotal - lineasEntregadas, [lineasTotal, lineasEntregadas]);

  // ─── KPIs Unidades ──────────────────────────────────────────────────────────
  const unidades = useMemo(() => lineas.reduce((s, j) => s + Number(j.qty ?? 0), 0), [lineas]);
  const unidadesEntregadas = useMemo(() => lineas.filter(isEntregado).reduce((s, j) => s + Number(j.qty ?? 0), 0), [lineas]);
  const unidadesAtiempo    = useMemo(() => lineas.filter((j) => isEntregado(j) && (j.diasIncumplimiento ?? 0) <= 0).reduce((s, j) => s + Number(j.qty ?? 0), 0), [lineas]);
  const unidadesTarde      = useMemo(() => lineas.filter((j) => isEntregado(j) && (j.diasIncumplimiento ?? 0) > 0).reduce((s, j) => s + Number(j.qty ?? 0), 0), [lineas]);
  // Total - Entregadas garantiza que Entregadas + Pendientes = Total
  const unidadesPendientes = useMemo(() => unidades - unidadesEntregadas, [unidades, unidadesEntregadas]);

  // ─── Cumplimiento ───────────────────────────────────────────────────────────
  const cumplData = useMemo(() => {
    let anticipado = 0, atiempo = 0, retrasado = 0, pendiente = 0;
    for (const j of lineas) {
      if (!isEntregado(j)) { pendiente++; continue; }
      const d = j.diasIncumplimiento ?? 0;
      if (d < 0) anticipado++;
      else if (d === 0) atiempo++;
      else retrasado++;
    }
    return [
      { name: "Anticipado", value: anticipado, fill: P.anticipado },
      { name: "A tiempo",   value: atiempo,    fill: P.atiempo },
      { name: "Retrasado",  value: retrasado,  fill: P.retrasado },
      { name: "Pendiente",  value: pendiente,  fill: P.pendiente },
    ];
  }, [lineas]);
  // ─── Cumplimiento USD ──────────────────────────────────────────────────────
  const cumplUsdData = useMemo(() => {
    let anticipadoUsd = 0, atiempoUsd = 0, retrasadoUsd = 0, pendienteUsd = 0;
    for (const j of lineas) {
      if (!isEntregado(j)) { pendienteUsd += valorCompradoUsd(j); continue; }
      const recUsd = valorRecibidoUsd(j);
      const d = j.diasIncumplimiento ?? 0;
      if (d < 0) anticipadoUsd += recUsd;
      else if (d === 0) atiempoUsd += recUsd;
      else retrasadoUsd += recUsd;
    }
    return [
      { name: "Anticipado", value: anticipadoUsd, fill: P.anticipado },
      { name: "A tiempo",   value: atiempoUsd,    fill: P.atiempo },
      { name: "Retrasado",  value: retrasadoUsd,  fill: P.retrasado },
      { name: "Pendiente",  value: pendienteUsd,  fill: P.pendiente },
    ];
  }, [lineas]);
  // ─── Tendencia mensual USD ───────────────────────────────────────────────────
  const tendData = useMemo(() => {
    const map = new Map<number, { comprado: number; recibido: number; pendiente: number }>();
    for (const j of lineas) {
      const m = deriveMes(j);
      if (!m) continue;
      if (!map.has(m)) map.set(m, { comprado: 0, recibido: 0, pendiente: 0 });
      const v = map.get(m)!;
      v.comprado  += valorCompradoUsd(j);
      v.recibido  += valorRecibidoUsd(j);
      v.pendiente += valorPendienteUsdFn(j);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, v]) => ({ mes: MESES[m - 1] ?? String(m), ...v }));
  }, [lineas]);

  // ─── USD por Gerencia ────────────────────────────────────────────────────────
  const usdPorGerencia = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of lineas) {
      const g = (j.gerencia ?? "—").trim() || "—";
      map.set(g, (map.get(g) ?? 0) + valorCompradoUsd(j));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [lineas]);

  // ─── USD por Campo ───────────────────────────────────────────────────────────
  const usdPorCampo = useMemo(() => {
    const map = new Map<string, number>();
    for (const j of lineas) {
      const c = (j.campo ?? "—").trim() || "—";
      map.set(c, (map.get(c) ?? 0) + valorCompradoUsd(j));
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [lineas]);

  // ─── Incumplimiento mensual ──────────────────────────────────────────────────
  const incumplData = useMemo(() => {
    const map = new Map<number, { total: number; retrasado: number }>();
    for (const j of lineas) {
      const m = deriveMes(j);
      if (!m) continue;
      if (!map.has(m)) map.set(m, { total: 0, retrasado: 0 });
      const v = map.get(m)!;
      v.total++;
      if (jobDelayDays(j) > 0) v.retrasado++;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, v]) => ({
        mes: MESES[m - 1] ?? String(m),
        pct: v.total ? Math.round((v.retrasado / v.total) * 100) : 0,
      }));
  }, [lineas]);

  // ─── KPI OC (basados exclusivamente en BN = controlIncumplimiento) ──────────
  const ocKpis = useMemo(() => {
    const ocMap = new Map<string, BNClass[]>();
    for (const j of lineas) {
      const ocKey = j.oc?.trim() || `__ln_${j.id}`;
      if (!ocMap.has(ocKey)) ocMap.set(ocKey, []);
      ocMap.get(ocKey)!.push(classBN(j));
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

  // ─── Semáforo BK (max BK por OC, 6 grupos) ──────────────────────────────────
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

  // ─── Tabla ejecutiva ─────────────────────────────────────────────────────────
  const tabla = useMemo(() => {
    type Acc = {
      campo: string; gerencia: string; cuenta: string;
      ocBN: Map<string, BNClass[]>;
      maxBK: Map<string, number>;
      usd: number; unidades: number;
    };
    const groups = new Map<string, Acc>();
    for (const j of lineas) {
      const campo    = (j.campo    ?? "—").trim() || "—";
      const gerencia = (j.gerencia ?? "—").trim() || "—";
      const cuenta   = (j.cuenta   ?? "—").trim() || "—";
      const gk = `${campo}__${gerencia}__${cuenta}`;
      if (!groups.has(gk)) groups.set(gk, { campo, gerencia, cuenta, ocBN: new Map(), maxBK: new Map(), usd: 0, unidades: 0 });
      const g = groups.get(gk)!;
      const ocKey = j.oc?.trim() || `__ln_${j.id}`;
      if (!g.ocBN.has(ocKey)) g.ocBN.set(ocKey, []);
      g.ocBN.get(ocKey)!.push(classBN(j));
      const bk = j.diasIncumplimiento ?? 0;
      const curBK = g.maxBK.get(ocKey);
      if (curBK === undefined || bk > curBK) g.maxBK.set(ocKey, bk);
      g.usd += valorCompradoUsd(j);
      g.unidades += Number(j.qty ?? 0);
    }
    return Array.from(groups.values()).map((g) => {
      let totalOC = 0, entregadas = 0, atiempo = 0, retraso = 0, maxBKVal = 0;
      for (const cls of g.ocBN.values()) {
        totalOC++;
        const w = worstBN(cls);
        if (w !== "pendiente") entregadas++;
        if (w === "atiempo") atiempo++;
        if (w === "retraso") retraso++;
      }
      for (const bk of g.maxBK.values()) if (bk > maxBKVal) maxBKVal = bk;
      return {
        campo: g.campo, gerencia: g.gerencia, cuenta: g.cuenta,
        totalOC, entregadas, atiempo, retraso, pendientes: totalOC - entregadas,
        usd: g.usd, unidades: g.unidades, maxBK: maxBKVal,
      };
    }).sort((a, b) => b.totalOC - a.totalOC);
  }, [lineas]);

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

  /** Reemplaza fEstados con `ids`; si ya están activos, los limpia */
  const setOrClear = (ids: string[]) =>
    setFEstados(prev => ids.length === prev.length && ids.every(id => prev.includes(id)) ? [] : ids);

  /** True cuando fEstados contiene exactamente `ids` */
  const isEstadoActive = (ids: string[]) =>
    ids.length === fEstados.length && ids.every(id => fEstados.includes(id));

  /** Toggle para la barra del semáforo */
  const toggleSemaforo = (key: SemaforoKey) =>
    setFSemaforoKey(prev => prev === key ? "" : key);

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-3">
          <Sel label="Año" value={fAnio} onChange={setFAnio} options={aniosOpt} />
          <Sel label="Semestre" value={fSemestre} onChange={setFSemestre} options={semestresOpt}
            getLabel={(v) => `S${v}`} />
          <Sel label="Trimestre" value={fTrimestre} onChange={setFTrimestre} options={trimestresOpt}
            getLabel={(v) => `T${v}`} />
          <Sel label="Mes" value={fMes} onChange={setFMes} options={mesesOpt}
            getLabel={(v) => { const n = parseInt(v, 10); return (!isNaN(n) && n >= 1 && n <= 12) ? `${MESES[n - 1]} (${n})` : v; }} />
          <Sel label="Gerencia" value={fGerencia} onChange={setFGerencia} options={gerenciasOpt} />
          <Sel label="Campo" value={fCampo} onChange={setFCampo} options={camposOpt} />
          <Sel label="Cuenta" value={fCuenta} onChange={setFCuenta} options={cuentasOpt} />
          <Sel label="Categoría" value={fCategoriaSeguimiento} onChange={setFCategoriaSeguimiento} options={categoriasSeguimientoOpt} />
          <MultiStateFilter label="Estado" selected={fEstados} onChange={setFEstados} options={estadosOpt} counts={estadoCounts} />
        </div>
      </div>

      {/* KPIs USD */}
      <Section title="USD · Valor comprado vs recibido vs pendiente">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Kpi icon={Wallet}       label="USD Comprado"  value={fmtMoney(usdComprado,  "USD")} tint="chart-1" />
          <Kpi icon={PackageCheck} label="USD Recibido"  value={fmtMoney(usdRecibido,  "USD")} tint="success"
            sub={`${pct(usdRecibido, usdComprado)}%`} />
          <Kpi icon={PackageMinus} label="USD Pendiente" value={fmtMoney(usdPendiente, "USD")} tint="warning"
            sub={`${pct(usdPendiente, usdComprado)}%`} />
        </div>
      </Section>

      {/* KPIs OC – basados en BN (controlIncumplimiento) */}
      <Section title="Órdenes de Compra · Total, entregadas y pendientes">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi icon={Package}      label="Total OC"            value={ocKpis.totalOC}    tint="chart-1" />
          <Kpi icon={CheckCircle2} label="Entregadas"          value={ocKpis.entregadas} tint="success"
            sub={`${pct(ocKpis.entregadas, ocKpis.totalOC)}%`}
            onClick={() => setOrClear(["Entregado"])} active={isEstadoActive(["Entregado"])} />
          <Kpi icon={TrendingDown} label="Entregadas a tiempo" value={ocKpis.atiempo}    tint="info"
            sub={`${pct(ocKpis.atiempo, ocKpis.totalOC)}%`} />
          <Kpi icon={AlertTriangle} label="Entregadas tarde"  value={ocKpis.retraso}    tint="destructive"
            sub={`${pct(ocKpis.retraso, ocKpis.totalOC)}%`} />
          <Kpi icon={PackageMinus} label="Pendientes"          value={ocKpis.pendientes} tint="warning"
            sub={`${pct(ocKpis.pendientes, ocKpis.totalOC)}%`}
            onClick={() => setOrClear(["Sin entrega", "Entregado Parcial"])} active={isEstadoActive(["Sin entrega", "Entregado Parcial"])} />
        </div>
      </Section>

      {/* KPIs Líneas */}
      <Section title="Líneas · Total, entregadas y pendientes">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi icon={Layers}        label="Total líneas"       value={lineasTotal.toLocaleString()}      tint="chart-1" />
          <Kpi icon={CheckCircle2}  label="Entregadas"         value={lineasEntregadas.toLocaleString()} tint="success"
            sub={`${pct(lineasEntregadas, lineasTotal)}%`}
            onClick={() => setOrClear(["Entregado"])} active={isEstadoActive(["Entregado"])} />
          <Kpi icon={TrendingDown}  label="Entregadas a tiempo" value={lineasAtiempo.toLocaleString()}   tint="info"
            sub={`${pct(lineasAtiempo, lineasTotal)}%`} />
          <Kpi icon={AlertTriangle} label="Entregadas tarde"   value={lineasTarde.toLocaleString()}      tint="destructive"
            sub={`${pct(lineasTarde, lineasTotal)}%`} />
          <Kpi icon={PackageMinus}  label="Pendientes"         value={lineasPendientes.toLocaleString()} tint="warning"
            sub={`${pct(lineasPendientes, lineasTotal)}%`}
            onClick={() => setOrClear(["Sin entrega", "Entregado Parcial"])} active={isEstadoActive(["Sin entrega", "Entregado Parcial"])} />
        </div>
      </Section>

      {/* KPIs Unidades */}
      <Section title="Unidades · Total, entregadas y pendientes">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Kpi icon={Boxes}         label="Total unidades"    value={unidades.toLocaleString()}          tint="chart-1" />
          <Kpi icon={PackageCheck}  label="Entregadas"        value={unidadesEntregadas.toLocaleString()} tint="success"
            sub={`${pct(unidadesEntregadas, unidades)}%`}
            onClick={() => setOrClear(["Entregado"])} active={isEstadoActive(["Entregado"])} />
          <Kpi icon={TrendingDown}  label="Entregadas a tiempo" value={unidadesAtiempo.toLocaleString()}  tint="info"
            sub={`${pct(unidadesAtiempo, unidades)}%`} />
          <Kpi icon={AlertTriangle} label="Entregadas tarde"  value={unidadesTarde.toLocaleString()}      tint="destructive"
            sub={`${pct(unidadesTarde, unidades)}%`} />
          <Kpi icon={PackageMinus}  label="Pendientes"        value={unidadesPendientes.toLocaleString()} tint="warning"
            sub={`${pct(unidadesPendientes, unidades)}%`}
            onClick={() => setOrClear(["Sin entrega", "Entregado Parcial"])} active={isEstadoActive(["Sin entrega", "Entregado Parcial"])} />
        </div>
      </Section>

      {/* SEMÁFORO BK – 6 grupos (tarjetas de datos) */}
      <Section title="Semáforo de Cumplimiento · días de incumplimiento (BK) · max por OC">
        <div className="bg-card border border-border rounded-lg p-4">
          {fSemaforoKey && (
            <div className="flex items-center justify-between mb-2 text-xs">
              <span className="text-blue-500 font-medium">
                Filtrando: {SEMAFORO_CONFIG.find((s) => s.key === fSemaforoKey)?.label}
              </span>
              <button
                onClick={() => setFSemaforoKey("")}
                className="text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border hover:border-foreground/30 transition-colors"
              >
                ✕ limpiar
              </button>
            </div>
          )}
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={semaforoData}
                margin={{ top: 4, right: 8, left: 0, bottom: 44 }}
                style={{ cursor: "pointer" }}
                onClick={(e) => {
                  if (e?.activePayload?.[0]) {
                    const key = (e.activePayload[0].payload as { key: SemaforoKey }).key;
                    toggleSemaforo(key);
                  }
                }}
              >
                <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number) => [`${v} OC`, "Cantidad"]}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {semaforoData.map((g) => (
                    <Cell
                      key={g.key}
                      fill={g.color}
                      opacity={fSemaforoKey && fSemaforoKey !== g.key ? 0.35 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* Cumplimiento Donut */}
      <Section title="Cumplimiento · Entregado (Anticipado / A tiempo / Retrasado) + Pendiente">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-5 flex flex-col items-center gap-4">
            <h3 className="text-sm font-semibold text-foreground self-start">Por Líneas</h3>
            <DonutChart data={cumplData} />
          </div>
          <div className="bg-card border border-border rounded-lg p-5 flex flex-col items-center gap-4">
            <h3 className="text-sm font-semibold text-foreground self-start">Por USD</h3>
            <DonutChart data={cumplUsdData} valueFormat={(v) => fmtMoney(v, "USD")} />
          </div>
        </div>
      </Section>

      {/* Tendencia mensual USD */}
      <Section title="Tendencia mensual · USD comprado vs recibido vs pendiente">
        <Card title="USD por mes" subtitle="Comprado vs Recibido vs Pendiente">
          <BarsUsd data={tendData} />
        </Card>
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
              {tabla.slice(0, 100).map((r, i) => {
                return (
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
                );
              })}
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

const KPI_COLORS: Record<string, { icon: string; bg: string }> = {
  "chart-1":   { icon: "var(--chart-1)",         bg: "rgba(79,  70, 229, 0.14)" },
  "chart-2":   { icon: "var(--chart-2)",         bg: "rgba(16, 185, 129, 0.14)" },
  success:     { icon: "var(--success)",         bg: "rgba(16, 185, 129, 0.14)" },
  warning:     { icon: "var(--warning)",         bg: "rgba(245,158,  11, 0.14)" },
  destructive: { icon: "var(--destructive)",     bg: "rgba(239, 68,  68, 0.14)" },
  info:        { icon: "var(--info)",            bg: "rgba( 59,130, 246, 0.14)" },
  default:     { icon: "var(--muted-foreground)", bg: "rgba(107,114, 128, 0.12)" },
};

function Kpi({ icon: Icon, label, value, tint, sub, onClick, active }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string | number; tint: string; sub?: string;
  onClick?: () => void; active?: boolean;
}) {
  const colors = KPI_COLORS[tint] ?? KPI_COLORS.default;
  return (
    <div
      className={`border rounded-lg p-4 bg-card shadow-sm transition-all ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      } ${active ? "border-transparent" : "border-border"}`}
      style={active ? { boxShadow: `0 0 0 2px ${colors.icon}` } : undefined}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className="h-7 w-7 rounded-md flex items-center justify-center" style={{ backgroundColor: colors.bg }}>
          <Icon className="h-4 w-4" style={{ color: colors.icon }} />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground tabular-nums">{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: colors.icon }}>{sub}</div>}
    </div>
  );
}

function DonutChart({ data, valueFormat }: {
  data: { name: string; value: number; fill: string }[];
  valueFormat?: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt = valueFormat ?? ((v: number) => v.toLocaleString());
  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm mx-auto">
      <div className="h-48 w-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius="55%" outerRadius="82%" paddingAngle={2}>
              {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), ""]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full flex flex-col gap-2 text-sm">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.fill }} />
            <span className="text-muted-foreground flex-1">{d.name}</span>
            <span className="font-semibold tabular-nums">{fmt(d.value)}</span>
            <span className="text-xs text-muted-foreground w-12 text-right">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </div>
        ))}
        <div className="mt-1 pt-2 border-t border-border flex items-center gap-2">
          <span className="text-muted-foreground flex-1">Total</span>
          <span className="font-semibold tabular-nums">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

function BarsUsd({ data }: { data: { mes: string; comprado: number; recibido: number; pendiente: number }[] }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmtMoney(v, "USD"), name]} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="comprado"  name="Comprado"  fill={P.comprado}  radius={[2, 2, 0, 0]} />
          <Bar dataKey="recibido"  name="Recibido"  fill={P.recibido}  radius={[2, 2, 0, 0]} />
          <Bar dataKey="pendiente" name="Pendiente" fill={P.pendiente} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Sel({ label, value, onChange, options, getLabel }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; getLabel?: (v: string) => string;
}) {
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

function MultiStateFilter({ label, selected, onChange, options, counts }: {
  label: string; selected: string[]; onChange: (value: string[]) => void; options: string[]; counts?: Record<string, number>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  return (
    <label className="flex flex-col gap-1 relative" ref={ref}>
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-2 rounded-md border border-border bg-card text-sm text-foreground text-left flex items-center justify-between gap-1"
      >
        <span className="truncate">{selected.length ? selected.join(", ") : "Todos"}</span>
        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-popover border border-border rounded-lg shadow-lg py-1">
          {options.map((o) => (
            <label key={o} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={() => toggle(o)}
                className="rounded border-border"
              />
              <span className="flex-1">{o}</span>
              {counts?.[o] !== undefined && (
                <span className="text-xs text-muted-foreground">{counts[o]}</span>
              )}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => { onChange([]); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-destructive hover:bg-muted/50"
            >
              Limpiar
            </button>
          )}
        </div>
      )}
    </label>
  );
}
