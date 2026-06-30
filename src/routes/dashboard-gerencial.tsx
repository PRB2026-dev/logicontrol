import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { fmtMoney, jobDelayDays, jobLlave, valorCompradoUsd, valorRecibidoUsd, valorPendienteUsdFn } from "@/lib/operational";
import type { Job } from "@/lib/jobs-data";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, LabelList, LineChart, Line, Legend, ComposedChart } from "recharts";
import { Package, CheckCircle2, Clock, XCircle, Wallet, PackageCheck, PackageMinus, Layers, Boxes, TrendingUp, TrendingDown, Timer, AlertTriangle, ChevronDown, ShieldCheck, ShieldAlert, Building2, Trash2, Users } from "lucide-react";

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
    if (s === "entregado" || s === "delivered" || s === "completo" || s === "completado") return "Entregado";
    if (s.includes("entregado") && !s.includes("parcial")) return "Entregado";
    if (s === "sin entrega" || s === "sin entregar" || s === "pendiente" || s === "no entregado") return "Sin entrega";
    return "Sin entrega";
  }
  // Sin campo BF: clasificar como Sin entrega (NO usar BH para determinar estado)
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
  const allStoreJobs = useJobsStore((s) => s.jobs);
  // Excluir líneas de importación — tienen su propio módulo independiente
  const rawJobs = useMemo(() => allStoreJobs.filter((j) => (j.tipoCompra ?? "") !== "Importación"), [allStoreJobs]);

  // ===== FILTROS =====
  const [fAnio, setFAnio] = useState("");
  const [fSemestre, setFSemestre] = useState("");
  const [fTrimestre, setFTrimestre] = useState("");
  const [fMes, setFMes] = useState("");
  const [fGerencia, setFGerencia] = useState("");
  const [fCampo, setFCampo] = useState("");
  const [fCuenta, setFCuenta] = useState("");
  const [fGestionOperativa, setFGestionOperativa] = useState<"" | "FRONTERA" | "BDP">("");
  const [fEstados, setFEstados] = useState<string[]>([]);
  const [fSemaforoKey, setFSemaforoKey] = useState<SemaforoKey | "">("");
  const [fProveedor, setFProveedor] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fEquipo, setFEquipo] = useState("");
  const [fLiberacion, setFLiberacion] = useState<string[]>([]);

  const opt = (vals: (string | number | null | undefined)[]) =>
    Array.from(new Set(vals.map((v) => String(v ?? "").trim()).filter(Boolean))).sort();

  const aniosOpt = useMemo(() => opt(rawJobs.map(deriveAnio)), [rawJobs]);
  const mesesOpt = useMemo(() => opt(rawJobs.map(deriveMes)), [rawJobs]);
  const gerenciasOpt = useMemo(() => opt(rawJobs.map((j) => j.gerencia)), [rawJobs]);
  const camposOpt = useMemo(() => opt(rawJobs.map((j) => j.campo)), [rawJobs]);
  const cuentasOpt = useMemo(() => opt(rawJobs.map((j) => j.cuenta)), [rawJobs]);
  const proveedoresOpt = useMemo(() => opt(rawJobs.map((j) => j.proveedor)), [rawJobs]);
  const categoriasOpt = useMemo(() => opt(rawJobs.map((j) => j.categoriaSeguimiento)), [rawJobs]);
  const equiposOpt = useMemo(() => opt(rawJobs.map((j) => j.equipo)), [rawJobs]);

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
    if (fProveedor && (j.proveedor ?? "").trim() !== fProveedor) return false;
    if (fCategoria && (j.categoriaSeguimiento ?? "").trim() !== fCategoria) return false;
    if (fEquipo && (j.equipo ?? "").trim() !== fEquipo) return false;
    if (fLiberacion.length > 0) {
      const bh = norm(j.estadoAdicional);
      const match = fLiberacion.some(f => {
        if (f.startsWith("0")) return bh === "0";
        if (f.startsWith("L")) return bh === "l";
        if (f.startsWith("B")) return bh === "b";
        return false;
      });
      if (!match) return false;
    }
    if (fGestionOperativa) {
      const by = norm(j.categoriaSeguimiento);
      if (fGestionOperativa === "FRONTERA" && by !== "revision administrativa") return false;
      if (fGestionOperativa === "BDP" && by !== "revision proveedor") return false;
    }
    if (fEstados.length) {
      if (!fEstados.includes(estadoOf(j))) return false;
    }
    if (fSemaforoKey && getSemaforoKey(j.diasIncumplimiento ?? 0) !== fSemaforoKey) return false;
    return true;
  }), [rawJobs, fAnio, fMes, fSemestre, fTrimestre, fGerencia, fCampo, fCuenta, fProveedor, fCategoria, fEquipo, fLiberacion, fGestionOperativa, fEstados, fSemaforoKey]);

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

  // ─── Tendencia mensual de líneas y % cumplimiento ────────────────────────────
  const tendLineasData = useMemo(() => {
    const map = new Map<number, { total: number; entregadas: number; pendientes: number }>();
    for (const j of lineas) {
      const m = deriveMes(j);
      if (!m) continue;
      if (!map.has(m)) map.set(m, { total: 0, entregadas: 0, pendientes: 0 });
      const v = map.get(m)!;
      v.total++;
      if (isEntregado(j)) v.entregadas++;
      else v.pendientes++;
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, v]) => ({
        mes: MESES[m - 1] ?? String(m),
        total: v.total,
        entregadas: v.entregadas,
        pendientes: v.pendientes,
        pctCumpl: v.total ? Math.round((v.entregadas / v.total) * 100) : 0,
      }));
  }, [lineas]);

  // ─── Tendencia combinada: USD + Líneas por mes ───────────────────────────────
  const tendCombinada = useMemo(() => {
    // Merge por mes usando tendData (USD) como base
    const lineasMap = new Map(tendLineasData.map((d) => [d.mes, d]));
    // Unir todos los meses presentes en cualquiera de los dos arrays
    const allMeses = Array.from(new Set([
      ...tendData.map((d) => d.mes),
      ...tendLineasData.map((d) => d.mes),
    ]));
    // Mantener orden cronológico usando el índice en MESES
    allMeses.sort((a, b) => MESES.indexOf(a) - MESES.indexOf(b));
    return allMeses.map((mes) => {
      const usd   = tendData.find((d) => d.mes === mes);
      const lneas = lineasMap.get(mes);
      return {
        mes,
        comprado:   usd?.comprado   ?? 0,
        recibido:   usd?.recibido   ?? 0,
        pendiente:  usd?.pendiente  ?? 0,
        total:      lneas?.total      ?? 0,
        entregadas: lneas?.entregadas ?? 0,
        pendientes: lneas?.pendientes ?? 0,
      };
    });
  }, [tendData, tendLineasData]);
  const proveedoresData = useMemo(() => {
    type ProvAcc = {
      lineas: number;
      entregadas: number;
      pendientes: number;
      atiempo: number;
      tarde: number;
      conFechaCompromiso: number; // "llamados de atención"
      usd: number;
    };
    const map = new Map<string, ProvAcc>();
    for (const j of lineas) {
      const prov = (j.proveedor ?? "Sin proveedor").trim() || "Sin proveedor";
      if (!map.has(prov)) map.set(prov, { lineas: 0, entregadas: 0, pendientes: 0, atiempo: 0, tarde: 0, conFechaCompromiso: 0, usd: 0 });
      const v = map.get(prov)!;
      v.lineas++;
      v.usd += valorCompradoUsd(j);
      if (j.fechaCompromiso) v.conFechaCompromiso++;
      if (isEntregado(j)) {
        v.entregadas++;
        if ((j.diasIncumplimiento ?? 0) <= 0) v.atiempo++;
        else v.tarde++;
      } else {
        v.pendientes++;
      }
    }

    const arr = Array.from(map.entries()).map(([nombre, d]) => ({ nombre, ...d }));
    const totalProveedores = arr.length;
    const proveedoresActivos = arr.filter((p) => p.pendientes > 0).length;

    const topLineas      = arr.sort((a, b) => b.lineas - a.lineas)[0]?.nombre ?? "—";
    const topLlamados    = [...arr].sort((a, b) => b.conFechaCompromiso - a.conFechaCompromiso)[0]?.nombre ?? "—";
    const topPendientes  = [...arr].sort((a, b) => b.pendientes - a.pendientes)[0]?.nombre ?? "—";
    const topEntregadas  = [...arr].sort((a, b) => b.entregadas - a.entregadas)[0]?.nombre ?? "—";

    const totalEntregadasAtiempo = lineas.filter((j) => isEntregado(j) && (j.diasIncumplimiento ?? 0) <= 0).length;
    const totalEntregadasTarde   = lineas.filter((j) => isEntregado(j) && (j.diasIncumplimiento ?? 0) > 0).length;

    // Top 8 por líneas para gráfico
    const chartData = [...arr]
      .sort((a, b) => b.lineas - a.lineas)
      .slice(0, 8)
      .map((p) => ({ name: p.nombre, lineas: p.lineas, pendientes: p.pendientes, entregadas: p.entregadas }));

    return {
      totalProveedores,
      proveedoresActivos,
      topLineas,
      topLlamados,
      topPendientes,
      topEntregadas,
      totalEntregadasAtiempo,
      totalEntregadasTarde,
      chartData,
    };
  }, [lineas]);

  // ─── Pendientes por Categoría de Seguimiento — jerarquía 3 niveles reales ───
  // Nivel 1: categoriaSeguimiento (FRONTERA / BDP)
  // Nivel 2: detalleStatus        (ej. "En Seguimiento", "Por Cancelar")
  // Nivel 3: statusGeneral        (ej. "En Validación Admon", "En Fabricación")
  type CatDesglose = {
    label: string;
    lineas: number;
    usd: number;
    detalles: Array<{
      detalleStatus: string;
      lineas: number;
      usd: number;
      areas: Array<{
        area: string;       // statusGeneral
        lineas: number;
        usd: number;
        statusGenerales: Array<{ sg: string; lineas: number; usd: number }>; // kept for type compat, same as area
      }>;
    }>;
  };

  const pendientesPorCategoria = useMemo((): CatDesglose[] => {
    const isFrontera = (cat: string) => {
      const c = cat.toLowerCase().trim();
      return c.includes("administrativa") || c === "frontera";
    };
    const isBdp = (cat: string) => {
      const c = cat.toLowerCase().trim();
      return c.includes("proveedor") || c === "bdp";
    };

    // Nivel 3 = statusGeneral (área/actividad operativa real)
    type Node3 = Map<string, { lineas: number; usd: number }>;
    type Node2 = Map<string, { lineas: number; usd: number; sg: Node3 }>;
    type Node1 = { lineas: number; usd: number; detalles: Node2 };

    const frontera: Node1 = { lineas: 0, usd: 0, detalles: new Map() };
    const bdp:      Node1 = { lineas: 0, usd: 0, detalles: new Map() };
    const otros:    Node1 = { lineas: 0, usd: 0, detalles: new Map() };

    for (const j of lineas) {
      if (!isPending(j)) continue;
      const cat = (j.categoriaSeguimiento ?? "").trim();
      const det = (j.detalleStatus  ?? "Sin detalle").trim()  || "Sin detalle";
      const sg  = (j.statusGeneral  ?? "Sin estado").trim()   || "Sin estado";
      const usd = valorPendienteUsdFn(j);

      const node: Node1 = isFrontera(cat) ? frontera : isBdp(cat) ? bdp : otros;
      node.lineas++;
      node.usd += usd;

      if (!node.detalles.has(det)) node.detalles.set(det, { lineas: 0, usd: 0, sg: new Map() });
      const dNode = node.detalles.get(det)!;
      dNode.lineas++;
      dNode.usd += usd;

      if (!dNode.sg.has(sg)) dNode.sg.set(sg, { lineas: 0, usd: 0 });
      const sNode = dNode.sg.get(sg)!;
      sNode.lineas++;
      sNode.usd += usd;
    }

    const toDesglose = (label: string, node: Node1): CatDesglose => ({
      label,
      lineas: node.lineas,
      usd: node.usd,
      detalles: Array.from(node.detalles.entries())
        .sort((a, b) => b[1].lineas - a[1].lineas)
        .map(([det, dNode]) => ({
          detalleStatus: det,
          lineas: dNode.lineas,
          usd: dNode.usd,
          areas: Array.from(dNode.sg.entries())
            .sort((a, b) => b[1].lineas - a[1].lineas)
            .map(([sg, v]) => ({
              area: sg,
              lineas: v.lineas,
              usd: v.usd,
              statusGenerales: [{ sg, lineas: v.lineas, usd: v.usd }],
            })),
        })),
    });

    const result: CatDesglose[] = [];
    if (frontera.lineas > 0) result.push(toDesglose("FRONTERA ENERGY · Revisión Administrativa", frontera));
    if (bdp.lineas > 0)      result.push(toDesglose("BDP · Revisión Proveedor", bdp));
    if (otros.lineas > 0)    result.push(toDesglose("Sin clasificar",                            otros));
    return result;
  }, [lineas]);

  // ─── Líneas Borradas ─────────────────────────────────────────────────────────
  const borradasData = useMemo(() => {
    const borradas = lineas.filter((j) => estadoOf(j) === "Borrado");
    const totalBorradas = borradas.length;
    const usdBorradas = borradas.reduce((s, j) => s + valorCompradoUsd(j), 0);

    // Tendencia mensual de borradas
    const map = new Map<number, number>();
    for (const j of borradas) {
      const m = deriveMes(j);
      if (!m) continue;
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    const tendenciaBorradas = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([m, count]) => ({ mes: MESES[m - 1] ?? String(m), borradas: count }));

    // Top proveedores con borradas
    const provMap = new Map<string, number>();
    for (const j of borradas) {
      const p = (j.proveedor ?? "Sin proveedor").trim() || "Sin proveedor";
      provMap.set(p, (provMap.get(p) ?? 0) + 1);
    }
    const topProvBorradas = Array.from(provMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, count]) => ({ nombre, count }));

    return { totalBorradas, usdBorradas, tendenciaBorradas, topProvBorradas };
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

  // ─── Semáforo BK por LÍNEA (no por OC) ─────────────────────────────────────
  const semaforoData = useMemo(() => {
    const totalLineas = lineas.length || 1;
    const counts: Record<SemaforoKey, number> = { atiempo: 0, lt10: 0, d1130: 0, d3160: 0, d6190: 0, gt91: 0 };
    const usdMap:    Record<SemaforoKey, number> = { atiempo: 0, lt10: 0, d1130: 0, d3160: 0, d6190: 0, gt91: 0 };
    for (const j of lineas) {
      const k = getSemaforoKey(j.diasIncumplimiento ?? 0);
      counts[k]++;
      usdMap[k] += valorCompradoUsd(j);
    }
    return SEMAFORO_CONFIG.map((s) => ({
      ...s,
      count:  counts[s.key],
      usd:    usdMap[s.key],
      pct:    totalLineas > 0 ? (counts[s.key] / totalLineas) * 100 : 0,
    }));
  }, [lineas]);

  // ─── Gestión Operativa BDP vs FRONTERA ─────────────────────────────────────
  // Solo sobre líneas pendientes y atrasadas (no entregadas)
  const lineasPendAtrasadas = useMemo(() =>
    lineas.filter((j) => isPending(j)), [lineas]);

  const gestionOperativa = useMemo(() => {
    let fronteraLineas = 0, fronteraUsd = 0;
    let bdpLineas = 0, bdpUsd = 0;
    for (const j of lineasPendAtrasadas) {
      const by = norm(j.categoriaSeguimiento);
      const usd = valorPendienteUsdFn(j);
      if (by === "revision administrativa") { fronteraLineas++; fronteraUsd += usd; }
      else if (by === "revision proveedor") { bdpLineas++; bdpUsd += usd; }
    }
    const total = fronteraLineas + bdpLineas || 1;
    const totalUsd = fronteraUsd + bdpUsd || 1;
    return {
      frontera: { lineas: fronteraLineas, usd: fronteraUsd, pctLineas: Math.round((fronteraLineas / total) * 100), pctUsd: Math.round((fronteraUsd / totalUsd) * 100) },
      bdp:      { lineas: bdpLineas,      usd: bdpUsd,      pctLineas: Math.round((bdpLineas / total) * 100),      pctUsd: Math.round((bdpUsd / totalUsd) * 100) },
      total: fronteraLineas + bdpLineas,
    };
  }, [lineasPendAtrasadas]);

  const gestionChartData = useMemo(() => [
    { name: "FRONTERA", lineas: gestionOperativa.frontera.lineas, usd: gestionOperativa.frontera.usd, pct: gestionOperativa.frontera.pctLineas, fill: "#3b82f6" },
    { name: "BDP",      lineas: gestionOperativa.bdp.lineas,      usd: gestionOperativa.bdp.usd,      pct: gestionOperativa.bdp.pctLineas,      fill: "#f59e0b" },
  ], [gestionOperativa]);

  // ─── Seguimiento Últimos 7 Días ──────────────────────────────────────────────
  const TODAY = useMemo(() => new Date(), []);
  const seguimientoData = useMemo(() => {
    let seguidas = 0, sinSeguimiento = 0;
    for (const j of lineasPendAtrasadas) {
      const fecha = j.fechaSeguimiento;
      if (fecha) {
        const diff = Math.floor((TODAY.getTime() - new Date(fecha).getTime()) / 86400000);
        if (diff <= 7) seguidas++;
        else sinSeguimiento++;
      } else {
        sinSeguimiento++;
      }
    }
    const total = seguidas + sinSeguimiento || 1;
    const pct = Math.round((seguidas / total) * 100);
    return { seguidas, sinSeguimiento, total: seguidas + sinSeguimiento, pct };
  }, [lineasPendAtrasadas, TODAY]);

  const semaforo7Dias = seguimientoData.pct >= 80 ? { color: "#22c55e", label: "Óptimo" }
    : seguimientoData.pct >= 60 ? { color: "#eab308", label: "Alerta" }
    : { color: "#ef4444", label: "Crítico" };

  // Líneas sin seguimiento — detalle para alerta
  const lineasSinSeguimiento = useMemo(() =>
    lineasPendAtrasadas
      .filter((j) => {
        const f = j.fechaSeguimiento;
        if (!f) return true;
        return Math.floor((TODAY.getTime() - new Date(f).getTime()) / 86400000) > 7;
      })
      .map((j) => {
        const diasSinGestion = j.fechaSeguimiento
          ? Math.floor((TODAY.getTime() - new Date(j.fechaSeguimiento).getTime()) / 86400000)
          : null;
        return { ...j, diasSinGestion };
      })
      .sort((a, b) => (b.diasIncumplimiento ?? 0) - (a.diasIncumplimiento ?? 0)),
  [lineasPendAtrasadas, TODAY]);

  const [mostrarAlerta, setMostrarAlerta] = useState(false);
  const [expandedCat, setExpandedCat]   = useState<Record<string, boolean>>({});
  const [expandedDet, setExpandedDet]   = useState<Record<string, boolean>>({});
  const [expandedArea, setExpandedArea] = useState<Record<string, boolean>>({});

  const seguimientoChartData = useMemo(() => [
    { name: "Con seguimiento",    value: seguimientoData.seguidas,       fill: "#22c55e" },
    { name: "Sin seguimiento",   value: seguimientoData.sinSeguimiento, fill: "#ef4444" },
  ], [seguimientoData]);

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-10 gap-3">
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
          <Sel label="Proveedor" value={fProveedor} onChange={setFProveedor} options={proveedoresOpt} />
          <Sel label="Equipo" value={fEquipo} onChange={setFEquipo} options={equiposOpt} />
          <MultiStateFilter label="Liberación" selected={fLiberacion} onChange={setFLiberacion}
            options={["0 - Activas", "L - Liberadas", "B - Bloqueadas"]} />
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

      {/* MÓDULO PROVEEDORES — reemplaza Unidades */}
      <Section title="Proveedores · Análisis por líneas">
        <div className="space-y-4">
          {/* KPIs principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi icon={Building2}    label="Total proveedores"        value={proveedoresData.totalProveedores} tint="chart-1" />
            <Kpi icon={Users}        label="Proveedores activos"      value={proveedoresData.proveedoresActivos} tint="info"
              sub="Con líneas pendientes" />
            <Kpi icon={CheckCircle2} label="Entregadas a tiempo"      value={proveedoresData.totalEntregadasAtiempo.toLocaleString()} tint="success"
              sub={`${pct(proveedoresData.totalEntregadasAtiempo, lineasTotal)}%`} />
            <Kpi icon={AlertTriangle} label="Entregadas con retraso"  value={proveedoresData.totalEntregadasTarde.toLocaleString()} tint="destructive"
              sub={`${pct(proveedoresData.totalEntregadasTarde, lineasTotal)}%`} />
          </div>
          {/* Gráficos frente a frente: Líneas | USD */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gráfico top 5 por líneas */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Top 5 proveedores · Líneas (entregadas / pendientes)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={proveedoresData.chartData.slice(0, 5).map(d => {
                    const total = d.entregadas + d.pendientes;
                    const pctVal = total > 0 ? Math.round((d.entregadas / total) * 100) : 0;
                    return { ...d, name: d.name.length > 18 ? d.name.slice(0, 18) + "…" : d.name, pct: pctVal };
                  })} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(v: number, name: string) => [v.toLocaleString(), name]} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="entregadas" name="Entregadas" stackId="a" fill="#10b981" barSize={20}>
                      <LabelList dataKey="entregadas" position="center" fill="#fff" fontSize={9} fontWeight={600} />
                    </Bar>
                    <Bar dataKey="pendientes" name="Pendientes" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20}>
                      <LabelList dataKey="pct" position="right" fill="var(--foreground)" fontSize={10} fontWeight={700} formatter={(v: number) => `${v}%`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico top 5 por USD */}
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Top 5 proveedores · USD (recibido / pendiente)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={proveedoresData.chartData.slice(0, 5).map(d => {
                    const usdRec = lineas.filter(j => (j.proveedor ?? "").trim() === d.name && isEntregado(j)).reduce((s, j) => s + valorRecibidoUsd(j), 0);
                    const usdPend = lineas.filter(j => (j.proveedor ?? "").trim() === d.name).reduce((s, j) => s + valorPendienteUsdFn(j), 0);
                    const usdTotal = usdRec + usdPend;
                    const pctVal = usdTotal > 0 ? Math.round((usdRec / usdTotal) * 100) : 0;
                    return { name: d.name.length > 18 ? d.name.slice(0, 18) + "…" : d.name, recibido: Math.round(usdRec), pendienteUsd: Math.round(usdPend), pct: pctVal };
                  })} layout="vertical" margin={{ top: 4, right: 70, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(v: number, name: string) => [fmtMoney(v, "USD"), name === "recibido" ? "Recibido" : "Pendiente"]} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="recibido" name="Recibido" stackId="a" fill="#10b981" barSize={20} />
                    <Bar dataKey="pendienteUsd" name="Pendiente" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20}>
                      <LabelList dataKey="pct" position="right" fill="var(--foreground)" fontSize={10} fontWeight={700} formatter={(v: number) => `${v}%`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tabla ranking top 10 proveedores */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Ranking Top 10 · Cumplimiento por proveedor</h3>
              <p className="text-[11px] text-muted-foreground">Total USD, líneas entregadas a tiempo / con retraso, % cumplimiento</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Proveedor</th>
                    <th className="py-2 px-3 text-right">Líneas</th>
                    <th className="py-2 px-3 text-right">USD Total</th>
                    <th className="py-2 px-3 text-right">A tiempo</th>
                    <th className="py-2 px-3 text-right">Retraso</th>
                    <th className="py-2 px-3 text-right">Pendientes</th>
                    <th className="py-2 px-3">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedoresData.chartData.slice(0, 10).map((p, i) => {
                    const full = [...(function() {
                      const map = new Map<string, { atiempo: number; tarde: number; pendientes: number; usd: number }>();
                      for (const j of lineas) {
                        const prov = (j.proveedor ?? "Sin proveedor").trim() || "Sin proveedor";
                        if (!map.has(prov)) map.set(prov, { atiempo: 0, tarde: 0, pendientes: 0, usd: 0 });
                        const v = map.get(prov)!;
                        v.usd += valorCompradoUsd(j);
                        if (isEntregado(j)) { if ((j.diasIncumplimiento ?? 0) <= 0) v.atiempo++; else v.tarde++; }
                        else v.pendientes++;
                      }
                      return map;
                    })()].find(([n]) => n === p.name)?.[1] ?? { atiempo: 0, tarde: 0, pendientes: 0, usd: 0 };
                    const delivered = full.atiempo + full.tarde;
                    const cumpl = delivered > 0 ? Math.round((full.atiempo / delivered) * 100) : 0;
                    const cumplColor = cumpl >= 80 ? "#10b981" : cumpl >= 50 ? "#f59e0b" : "#ef4444";
                    return (
                      <tr key={p.name} className="border-b border-border/40 hover:bg-muted/20">
                        <td className="py-2 px-3 font-bold text-muted-foreground">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-foreground max-w-[200px] truncate" title={p.name}>{p.name}</td>
                        <td className="py-2 px-3 text-right tabular-nums">{p.lineas}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{fmtMoney(full.usd, "USD")}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-success font-medium">{full.atiempo}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-destructive font-medium">{full.tarde}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-warning font-medium">{full.pendientes}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${cumpl}%`, backgroundColor: cumplColor }} />
                            </div>
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: cumplColor }}>{cumpl}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Section>
      <Section title="Semáforo de Cumplimiento · días de incumplimiento (BK) · por línea">
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
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={semaforoData}
                margin={{ top: 56, right: 8, left: 0, bottom: 44 }}
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
                  formatter={(_v: number, _n: string, props: { payload?: { count: number; usd: number; pct: number } }) => {
                    const d = props.payload;
                    if (!d) return ["", ""];
                    return [
                      `${d.count.toLocaleString()} líneas · ${fmtMoney(d.usd, "USD")} · ${Math.round(d.pct)}%`,
                      "Líneas",
                    ];
                  }}
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
                  <LabelList
                    content={(props) => {
                      const { x, y, width, value, index } = props as {
                        x: number; y: number; width: number; value: number; index: number;
                      };
                      const d = semaforoData[index];
                      if (!d || value === 0) return null;
                      const cx = x + width / 2;
                      return (
                        <g>
                          <text x={cx} y={(y as number) - 38} textAnchor="middle" fontSize={11} fontWeight={700} fill={d.color}>
                            {value.toLocaleString()}
                          </text>
                          <text x={cx} y={(y as number) - 24} textAnchor="middle" fontSize={9} fill="var(--muted-foreground)">
                            {fmtMoney(d.usd, "USD")}
                          </text>
                          <text x={cx} y={(y as number) - 11} textAnchor="middle" fontSize={10} fontWeight={600} fill={d.color}>
                            {Math.round(d.pct)}%
                          </text>
                        </g>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      {/* PENDIENTES POR CATEGORÍA DE SEGUIMIENTO — jerarquía 4 niveles */}
      <Section title="Pendientes por Categoría de Seguimiento · FRONTERA ENERGY vs BDP">
        {pendientesPorCategoria.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            Sin líneas pendientes con los filtros actuales.
          </div>
        ) : (
          <CatSeguimientoChart
            data={pendientesPorCategoria}
            fmtMoney={fmtMoney}
            tooltipStyle={tooltipStyle}
            expandedCat={expandedCat}
            setExpandedCat={setExpandedCat}
            expandedDet={expandedDet}
            setExpandedDet={setExpandedDet}
            expandedArea={expandedArea}
            setExpandedArea={setExpandedArea}
          />
        )}
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

      {/* TENDENCIAS — gráfica unificada USD + Líneas */}
      <Section title="Tendencias Mensuales · USD · Líneas">
        <Card title="USD comprado / recibido / pendiente · Líneas total / entregadas / pendientes" subtitle="Eje izquierdo: USD · Eje derecho: Líneas">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={tendCombinada} margin={{ top: 4, right: 48, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                {/* Eje Y izquierdo — USD */}
                <YAxis
                  yAxisId="usd"
                  orientation="left"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                {/* Eje Y derecho — Líneas */}
                <YAxis
                  yAxisId="lin"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => v.toLocaleString()}
                  width={40}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, name: string) => {
                    const isUsd = ["Comprado", "Recibido", "Pendiente USD"].includes(name);
                    return [isUsd ? `$${(v / 1000).toFixed(1)}k` : v.toLocaleString(), name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {/* Barras USD (eje izquierdo) */}
                <Bar yAxisId="usd" dataKey="comprado"   name="Comprado"      fill={P.comprado}  radius={[2, 2, 0, 0]} barSize={6} />
                <Bar yAxisId="usd" dataKey="recibido"   name="Recibido"      fill={P.recibido}  radius={[2, 2, 0, 0]} barSize={6} />
                <Bar yAxisId="usd" dataKey="pendiente"  name="Pendiente USD" fill={P.pendiente} radius={[2, 2, 0, 0]} barSize={6} />
                {/* Líneas (eje derecho) */}
                <Line yAxisId="lin" type="monotone" dataKey="total"      name="Total líneas"  stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="lin" type="monotone" dataKey="entregadas" name="Entregadas"    stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="lin" type="monotone" dataKey="pendientes" name="Pendientes"    stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </Section>

      {/* SEGUIMIENTO ÚLTIMOS 7 DÍAS */}
      <Section title="Seguimiento Últimos 7 Días · Líneas pendientes con gestión reciente">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Gauge central ── */}
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="relative" style={{ width: 160, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    {/* pista gris de fondo */}
                    <Pie data={[{ value: 100 }]} dataKey="value"
                      startAngle={210} endAngle={-30}
                      innerRadius={54} outerRadius={72}
                      stroke="none" isAnimationActive={false}>
                      <Cell fill="var(--muted)" />
                    </Pie>
                    {/* arco de progreso */}
                    <Pie
                      data={[
                        { value: seguimientoData.pct },
                        { value: Math.max(0, 100 - seguimientoData.pct) },
                      ]}
                      dataKey="value"
                      startAngle={210} endAngle={-30}
                      innerRadius={54} outerRadius={72}
                      stroke="none" paddingAngle={0}
                    >
                      <Cell fill={semaforo7Dias.color} />
                      <Cell fill="transparent" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* texto central superpuesto */}
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 12 }}>
                  <span className="text-3xl font-bold tabular-nums" style={{ color: semaforo7Dias.color }}>
                    {seguimientoData.pct}%
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: semaforo7Dias.color }}>
                    {semaforo7Dias.label}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center leading-tight">
                % de líneas pendientes<br />gestionadas en los últimos 7 días
              </p>
              {/* escala semáforo */}
              <div className="flex gap-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-destructive" />&lt;60%</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />60–79%</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />≥80%</span>
              </div>
            </div>

            {/* ── Métricas ── */}
            <div className="flex flex-col justify-center gap-4">
              {/* total */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-muted">
                  <Layers className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total líneas pendientes</div>
                  <div className="text-xl font-bold tabular-nums text-foreground">{seguimientoData.total.toLocaleString()}</div>
                </div>
              </div>
              {/* seguidas */}
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#22c55e18", border: "1px solid #22c55e30" }}>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#22c55e20" }}>
                  <CheckCircle2 className="h-5 w-5" style={{ color: "#22c55e" }} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "#22c55e" }}>Con seguimiento (≤ 7 días)</div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: "#22c55e" }}>{seguimientoData.seguidas.toLocaleString()}</div>
                </div>
                <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>
                  {seguimientoData.total ? Math.round((seguimientoData.seguidas / seguimientoData.total) * 100) : 0}%
                </span>
              </div>
              {/* sin seguimiento */}
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#ef444418", border: "1px solid #ef444430" }}>
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#ef444420" }}>
                  <AlertTriangle className="h-5 w-5" style={{ color: "#ef4444" }} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "#ef4444" }}>Sin seguimiento (&gt; 7 días)</div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: "#ef4444" }}>{seguimientoData.sinSeguimiento.toLocaleString()}</div>
                </div>
                <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                  {seguimientoData.total ? Math.round((seguimientoData.sinSeguimiento / seguimientoData.total) * 100) : 0}%
                </span>
              </div>
            </div>

            {/* ── Barra apilada + detalle ── */}
            <div className="flex flex-col justify-center gap-4">
              <div>
                <div className="text-xs font-semibold text-foreground mb-2">Distribución de gestión</div>
                {/* barra apilada horizontal */}
                <div className="h-10 rounded-lg overflow-hidden flex" style={{ border: "1px solid var(--border)" }}>
                  <div
                    className="flex items-center justify-center text-[11px] font-bold text-white transition-all"
                    style={{
                      width: `${seguimientoData.total ? (seguimientoData.seguidas / seguimientoData.total) * 100 : 0}%`,
                      backgroundColor: "#22c55e",
                      minWidth: seguimientoData.seguidas > 0 ? 28 : 0,
                    }}
                  >
                    {seguimientoData.seguidas > 0 && `${Math.round((seguimientoData.seguidas / (seguimientoData.total || 1)) * 100)}%`}
                  </div>
                  <div
                    className="flex items-center justify-center text-[11px] font-bold text-white transition-all flex-1"
                    style={{ backgroundColor: "#ef4444", minWidth: seguimientoData.sinSeguimiento > 0 ? 28 : 0 }}
                  >
                    {seguimientoData.sinSeguimiento > 0 && `${Math.round((seguimientoData.sinSeguimiento / (seguimientoData.total || 1)) * 100)}%`}
                  </div>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span style={{ color: "#22c55e" }}>■ Gestionadas</span>
                  <span style={{ color: "#ef4444" }}>■ Sin gestión</span>
                </div>
              </div>
              {/* gráfico de barras recharts */}
              <div>
                <div className="text-xs font-semibold text-foreground mb-1">Comparativa líneas</div>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={seguimientoChartData}
                      layout="vertical"
                      margin={{ top: 2, right: 48, left: 4, bottom: 2 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number) => [v.toLocaleString(), "Líneas"]}
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                        {seguimientoChartData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                        <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 600, fill: "var(--foreground)" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* fórmula */}
              <div className="text-[10px] text-muted-foreground border border-border rounded-md px-3 py-2 bg-muted/30">
                <span className="font-semibold text-foreground">Fórmula: </span>
                % Seguimiento = Líneas seguidas ÷ Total pendientes × 100
              </div>
            </div>

          </div>

          {/* ── Panel de alerta: líneas sin seguimiento ── */}
          {lineasSinSeguimiento.length > 0 && (() => {
            const fronteraSin = lineasSinSeguimiento.filter(j => norm(j.categoriaSeguimiento) === "revision administrativa").length;
            const bdpSin      = lineasSinSeguimiento.filter(j => norm(j.categoriaSeguimiento) === "revision proveedor").length;
            const otrasSin    = lineasSinSeguimiento.length - fronteraSin - bdpSin;
            return (
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #ef444440" }}>
              <button
                type="button"
                onClick={() => setMostrarAlerta(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                style={{ backgroundColor: "#ef444410" }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "#ef4444" }} />
                    <span className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                      {lineasSinSeguimiento.length} líneas sin seguimiento
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    {fronteraSin > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f630" }}>
                        FRONTERA&nbsp;<strong>{fronteraSin}</strong>
                      </span>
                    )}
                    {bdpSin > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b30" }}>
                        BDP&nbsp;<strong>{bdpSin}</strong>
                      </span>
                    )}
                    {otrasSin > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: "#6b728015", color: "#6b7280", border: "1px solid #6b728030" }}>
                        Sin clasificar&nbsp;<strong>{otrasSin}</strong>
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 flex-shrink-0 transition-transform" style={{ color: "#ef4444", transform: mostrarAlerta ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>

              {mostrarAlerta && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left" style={{ backgroundColor: "var(--muted)" }}>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Urgencia</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Gestión</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">OC</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Material</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Proveedor</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Responsable</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Gerencia</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Campo</th>
                        <th className="py-2 px-3 text-right font-semibold text-muted-foreground uppercase tracking-wide">Días incumpl.</th>
                        <th className="py-2 px-3 text-right font-semibold text-muted-foreground uppercase tracking-wide">Días sin gestión</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Último seguim.</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Estado entrega</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineasSinSeguimiento.slice(0, 50).map((j, i) => {
                        const dias = j.diasIncumplimiento ?? 0;
                        const [urgColor, urgBg, urgLabel] =
                          dias > 90 ? ["#991b1b", "#991b1b15", ">91d 🔴"] :
                          dias > 60 ? ["#ef4444", "#ef444415", "61-90d 🔴"] :
                          dias > 30 ? ["#f97316", "#f9731615", "31-60d 🟠"] :
                          dias > 10 ? ["#eab308", "#eab30815", "11-30d 🟡"] :
                                      ["#22c55e", "#22c55e15", "≤10d 🟢"];
                        return (
                          <tr key={j.id ?? i} className="border-b hover:bg-muted/20" style={{ borderColor: "var(--border)" }}>
                            <td className="py-2 px-3">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: urgBg, color: urgColor }}>
                                {urgLabel}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {(() => {
                                const by = norm(j.categoriaSeguimiento);
                                if (by === "revision administrativa") return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f630" }}>FRONTERA</span>;
                                if (by === "revision proveedor")      return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b30" }}>BDP</span>;
                                return <span className="text-[10px] text-muted-foreground">—</span>;
                              })()}
                            </td>
                            <td className="py-2 px-3 font-medium text-foreground">{j.oc ?? "—"}</td>
                            <td className="py-2 px-3 text-muted-foreground max-w-[140px] truncate" title={j.material ?? ""}>{j.material ?? "—"}</td>
                            <td className="py-2 px-3 text-muted-foreground max-w-[120px] truncate" title={j.proveedor ?? ""}>{j.proveedor ?? "—"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{j.responsable ?? "—"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{j.gerencia ?? "—"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{j.campo ?? "—"}</td>
                            <td className="py-2 px-3 text-right">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums" style={{ backgroundColor: urgBg, color: urgColor }}>
                                {dias > 0 ? `+${dias}d` : `${dias}d`}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {j.diasSinGestion !== null
                                ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-destructive/15 text-destructive">{j.diasSinGestion}d</span>
                                : <span className="text-[10px] font-semibold text-destructive">Sin fecha</span>}
                            </td>
                            <td className="py-2 px-3 text-muted-foreground tabular-nums">
                              {j.fechaSeguimiento ?? <span className="font-semibold" style={{ color: "#ef4444" }}>Nunca</span>}
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/15 text-destructive">
                                {estadoOf(j)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {lineasSinSeguimiento.length > 50 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t" style={{ borderColor: "var(--border)" }}>
                      Mostrando 50 de {lineasSinSeguimiento.length} líneas. Aplica filtros para reducir.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
          })()}
        </div>
      </Section>

      {/* MÓDULO LÍNEAS BORRADAS */}
      <Section title="Líneas Borradas · Total, valor USD y tendencia">
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Kpi icon={Trash2}       label="Total líneas borradas" value={borradasData.totalBorradas.toLocaleString()} tint="destructive"
              sub={`${pct(borradasData.totalBorradas, rawJobs.length)}% del total`} />
            <Kpi icon={Wallet}       label="USD asociado"          value={fmtMoney(borradasData.usdBorradas, "USD")}   tint="warning" />
            <Kpi icon={PackageMinus} label="Proveedores afectados" value={borradasData.topProvBorradas.length.toLocaleString()} tint="chart-1" />
          </div>
          {/* Gráficos */}
          {borradasData.totalBorradas > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tendencia mensual */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Tendencia mensual de borradas</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={borradasData.tendenciaBorradas} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v.toLocaleString(), "Borradas"]} />
                      <Bar dataKey="borradas" fill="#ef4444" radius={[2, 2, 0, 0]}>
                        <LabelList dataKey="borradas" position="top" style={{ fontSize: 10, fill: "var(--foreground)" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              {/* Top proveedores con borradas */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Top proveedores con líneas borradas</h3>
                <div className="space-y-2">
                  {borradasData.topProvBorradas.map((p, i) => (
                    <div key={p.nombre} className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-xs text-foreground flex-1 truncate">{p.nombre}</span>
                      <span className="text-xs font-semibold tabular-nums text-destructive">{p.count}</span>
                      <div className="w-20">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-destructive" style={{
                            width: `${borradasData.topProvBorradas[0]?.count ? Math.round((p.count / borradasData.topProvBorradas[0].count) * 100) : 0}%`,
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                  {borradasData.topProvBorradas.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">Sin datos</div>
                  )}
                </div>
              </div>
            </div>
          )}
          {borradasData.totalBorradas === 0 && (
            <div className="bg-card border border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No hay líneas borradas con los filtros actuales.
            </div>
          )}
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

// ─── CatSeguimientoChart ──────────────────────────────────────────────────────
// Visualización unificada: KPIs superiores + Sunburst/Barras + árbol colapsable.
// Reemplaza "Pendientes por Categoría" y "Gestión Operativa BDP vs Frontera".

type CatDesgloseItem = {
  label: string;
  lineas: number;
  usd: number;
  detalles: Array<{
    detalleStatus: string;
    lineas: number;
    usd: number;
    areas: Array<{
      area: string;
      lineas: number;
      usd: number;
      statusGenerales: Array<{ sg: string; lineas: number; usd: number }>;
    }>;
  }>;
};

type CatChartProps = {
  data: CatDesgloseItem[];
  fmtMoney: (v: number, c: string) => string;
  tooltipStyle: object;
  expandedCat:  Record<string, boolean>;
  setExpandedCat:  React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedDet:  Record<string, boolean>;
  setExpandedDet:  React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  expandedArea: Record<string, boolean>;
  setExpandedArea: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

// ─── CatSeguimientoChart — drill-down interactivo ────────────────────────────
// Nivel 1: Categorías (FRONTERA / BDP) — clic → baja al nivel 2
// Nivel 2: Detalle Status de la categoría — clic → baja al nivel 3
// Nivel 3: Status General (actividad operativa) — nivel hoja
// Breadcrumb en la parte superior permite subir cualquier nivel
function CatSeguimientoChart({ data, fmtMoney, tooltipStyle }: CatChartProps) {
  const [drill, setDrill] = useState<{ catLabel: string; detLabel?: string } | null>(null);

  const totalLineas = data.reduce((s, c) => s + c.lineas, 0) || 1;
  const totalUsd    = data.reduce((s, c) => s + c.usd, 0);

  const CAT_COLORS: Record<string, string> = {};
  data.forEach((cat) => {
    CAT_COLORS[cat.label] = cat.label.includes("FRONTERA") ? "#3b82f6"
      : cat.label.includes("BDP") ? "#f59e0b"
      : "#6b7280";
  });

  const PALETTE_F = ["#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#dbeafe","#eff6ff"];
  const PALETTE_B = ["#b45309","#d97706","#f59e0b","#fbbf24","#fcd34d","#fde68a","#fef3c7","#fffbeb"];
  const PALETTE_O = ["#374151","#4b5563","#6b7280","#9ca3af","#d1d5db","#e5e7eb","#f3f4f6","#f9fafb"];

  function pal(catLabel: string, idx: number) {
    const p = catLabel.includes("FRONTERA") ? PALETTE_F : catLabel.includes("BDP") ? PALETTE_B : PALETTE_O;
    return p[idx % p.length];
  }

  function short(label: string) {
    return label.includes("FRONTERA") ? "FRONTERA ENERGY" : label.includes("BDP") ? "BDP" : label;
  }

  // ── datos del nivel activo ──────────────────────────────────────────────────
  type ChartRow = { name: string; lineas: number; usd: number; pct: number; fill: string; drillKey: { catLabel: string; detLabel?: string } | null };

  const { rows, breadcrumb, levelLabel } = ((): { rows: ChartRow[]; breadcrumb: Array<{ label: string; onClick: () => void }>; levelLabel: string } => {
    if (!drill) {
      return {
        levelLabel: "Categoría",
        breadcrumb: [],
        rows: data.map((cat) => ({
          name: short(cat.label),
          lineas: cat.lineas, usd: cat.usd,
          pct: Math.round((cat.lineas / totalLineas) * 100),
          fill: CAT_COLORS[cat.label],
          drillKey: { catLabel: cat.label },
        })),
      };
    }
    const cat = data.find((c) => c.label === drill.catLabel);
    if (!cat) return { levelLabel: "", breadcrumb: [], rows: [] };

    if (!drill.detLabel) {
      return {
        levelLabel: "Detalle Status",
        breadcrumb: [{ label: short(cat.label), onClick: () => setDrill(null) }],
        rows: cat.detalles.map((det, i) => ({
          name: det.detalleStatus,
          lineas: det.lineas, usd: det.usd,
          pct: Math.round((det.lineas / cat.lineas) * 100),
          fill: pal(cat.label, i),
          drillKey: { catLabel: cat.label, detLabel: det.detalleStatus },
        })),
      };
    }

    const det = cat.detalles.find((d) => d.detalleStatus === drill.detLabel);
    if (!det) return { levelLabel: "", breadcrumb: [], rows: [] };
    return {
      levelLabel: "Status General",
      breadcrumb: [
        { label: short(cat.label), onClick: () => setDrill(null) },
        { label: det.detalleStatus, onClick: () => setDrill({ catLabel: cat.label }) },
      ],
      rows: det.areas.map((area, i) => ({
        name: area.area,
        lineas: area.lineas, usd: area.usd,
        pct: Math.round((area.lineas / det.lineas) * 100),
        fill: pal(cat.label, i + 2),
        drillKey: null,
      })),
    };
  })();

  const barH = Math.max(260, rows.length * 46 + 40);

  const TT = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartRow }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ ...tooltipStyle as React.CSSProperties, padding: "8px 12px", minWidth: 190 }}>
        <div className="font-semibold text-xs mb-1 text-foreground">{d.name}</div>
        <div className="text-xs text-muted-foreground">{d.lineas.toLocaleString()} líneas · {d.pct}%</div>
        <div className="text-xs text-muted-foreground">{fmtMoney(d.usd, "USD")}</div>
        {d.drillKey && <div className="text-[10px] text-muted-foreground mt-1 italic">Clic para ver detalle →</div>}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">

      {/* ── KPIs superiores — clicables, resaltan la selección ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {data.map((cat) => {
          const color = CAT_COLORS[cat.label];
          const selected = drill?.catLabel === cat.label;
          const faded = drill && drill.catLabel !== cat.label;
          return (
            <button key={cat.label} type="button"
              onClick={() => setDrill(selected && !drill?.detLabel ? null : { catLabel: cat.label })}
              className="border rounded-lg p-3 bg-muted/20 space-y-1 text-left transition-all hover:shadow-md"
              style={{ borderColor: selected ? color : `${color}40`, opacity: faded ? 0.45 : 1, boxShadow: selected ? `0 0 0 2px ${color}` : undefined }}
            >
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color }}>{short(cat.label)}</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold tabular-nums" style={{ color }}>{cat.lineas.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground pb-0.5">líneas</span>
                <span className="ml-auto text-sm font-bold tabular-nums" style={{ color }}>{Math.round((cat.lineas / totalLineas) * 100)}%</span>
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">{fmtMoney(cat.usd, "USD")}</div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                <div className="h-full rounded-full" style={{ width: `${Math.round((cat.lineas / totalLineas) * 100)}%`, backgroundColor: color }} />
              </div>
            </button>
          );
        })}
        <div className="border rounded-lg p-3 bg-muted/30 space-y-1 border-border">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total pendientes</div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold tabular-nums text-foreground">{totalLineas.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground pb-0.5">líneas</span>
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">{fmtMoney(totalUsd, "USD")}</div>
          <div className="h-1.5 rounded-full bg-muted mt-1" />
        </div>
      </div>

      {/* ── Breadcrumb + nivel actual ── */}
      <div className="flex items-center gap-1 flex-wrap border-t border-border pt-3">
        <button type="button" onClick={() => setDrill(null)}
          className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${!drill ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Categoría
        </button>
        {breadcrumb.map((b, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">›</span>
            <button type="button" onClick={b.onClick}
              className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${i === breadcrumb.length - 1 && !drill?.detLabel ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {b.label}
            </button>
          </span>
        ))}
        {drill?.detLabel && (
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">›</span>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-primary text-primary-foreground">{drill.detLabel}</span>
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {levelLabel} · {rows.length} ítems · {rows.reduce((s, r) => s + r.lineas, 0).toLocaleString()} líneas
        </span>
      </div>

      {/* ── Gráfica drill-down ── */}
      <div style={{ height: barH }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical"
            margin={{ top: 4, right: 120, left: 8, bottom: 4 }}
            style={{ cursor: drill?.detLabel ? "default" : "pointer" }}
            onClick={(e) => {
              const d = e?.activePayload?.[0]?.payload as ChartRow | undefined;
              if (d?.drillKey) setDrill(d.drillKey);
            }}
          >
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={155}
              tickFormatter={(v: string) => v.length > 26 ? v.slice(0, 26) + "…" : v} />
            <Tooltip content={TT} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
            <Bar dataKey="lineas" radius={[0, 4, 4, 0]}>
              {rows.map((d, i) => <Cell key={i} fill={d.fill} />)}
              <LabelList content={(props) => {
                const { x, y, width, value, index } = props as { x: number; y: number; width: number; value: number; index: number };
                const d = rows[index];
                if (!d) return null;
                return (
                  <g>
                    <text x={(x as number) + (width as number) + 6} y={(y as number) + 11} fontSize={11} fontWeight={700} fill={d.fill}>
                      {value.toLocaleString()}{d.drillKey ? " ›" : ""}
                    </text>
                    <text x={(x as number) + (width as number) + 6} y={(y as number) + 23} fontSize={9} fill="var(--muted-foreground)">
                      {d.pct}% · {fmtMoney(d.usd, "USD")}
                    </text>
                  </g>
                );
              }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!drill?.detLabel && rows.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center -mt-2">
          Clic en una barra para ver el siguiente nivel ›
        </p>
      )}

      {/* ── tabla completa colapsable ── */}
      <details className="border-t border-border pt-2">
        <summary className="text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground py-1">
          ▶ Ver tabla completa
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-border text-muted-foreground uppercase tracking-wide text-[10px]">
                <th className="py-1.5 px-2">Categoría</th>
                <th className="py-1.5 px-2">Detalle Status</th>
                <th className="py-1.5 px-2">Status General</th>
                <th className="py-1.5 px-2 text-right">Líneas</th>
                <th className="py-1.5 px-2 text-right">USD</th>
                <th className="py-1.5 px-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {data.flatMap((cat) =>
                cat.detalles.flatMap((det) =>
                  det.areas.map((area) => {
                    const color = CAT_COLORS[cat.label];
                    return (
                      <tr key={`${cat.label}__${det.detalleStatus}__${area.area}`}
                        className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-1.5 px-2 font-semibold" style={{ color }}>{short(cat.label)}</td>
                        <td className="py-1.5 px-2 text-muted-foreground">{det.detalleStatus}</td>
                        <td className="py-1.5 px-2 text-foreground">{area.area}</td>
                        <td className="py-1.5 px-2 text-right font-bold tabular-nums" style={{ color }}>{area.lineas.toLocaleString()}</td>
                        <td className="py-1.5 px-2 text-right text-muted-foreground tabular-nums">{fmtMoney(area.usd, "USD")}</td>
                        <td className="py-1.5 px-2 text-right font-semibold tabular-nums" style={{ color }}>{Math.round((area.lineas / totalLineas) * 100)}%</td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
