import type { Job, Priority, JobStatus, LineStatus, TipoCompra } from "./jobs-data";

const DAY = 86400000;

// ─── Festivos Colombia 2025-2026 ─────────────────────────────────────────────
const FESTIVOS = new Set([
  // 2025
  "2025-01-01", "2025-01-06", "2025-03-24", "2025-04-17", "2025-04-18",
  "2025-05-01", "2025-06-02", "2025-06-23", "2025-06-30", "2025-07-20",
  "2025-08-07", "2025-08-18", "2025-10-13", "2025-11-03", "2025-11-17",
  "2025-12-08", "2025-12-25",
  // 2026
  "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
  "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
  "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02",
  "2026-11-16", "2026-12-08", "2026-12-25",
]);

/** Calcula días HÁBILES entre dos fechas (lun-vie, sin festivos Colombia).
 *  Retorna positivo si `from` < `to` (retraso), negativo si `from` > `to` (adelantado). */
export function diasHabiles(from: string | null | undefined, to: Date = new Date()): number {
  if (!from) return 0;
  const start = new Date(from);
  if (isNaN(start.getTime())) return 0;
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  if (start.getTime() === end.getTime()) return 0;
  const signo = end > start ? 1 : -1;
  const menor = signo === 1 ? start : end;
  const mayor = signo === 1 ? end : start;
  let count = 0;
  const current = new Date(menor);
  current.setDate(current.getDate() + 1);
  while (current <= mayor) {
    const day = current.getDay();
    const iso = current.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !FESTIVOS.has(iso)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count * signo;
}

export function daysBetween(from: string | null | undefined, to: Date = new Date()): number {
  return diasHabiles(from, to);
}

// SLA target por prioridad (días)
const SLA_TARGET: Record<Priority, number> = {
  Baja: 10,
  Media: 7,
  Alta: 4,
  Crítica: 2,
};

export function slaTarget(p: Priority): number {
  return SLA_TARGET[p];
}

export function computeAging(job: Job): number {
  // Aging operativo por LÍNEA (orden + item): días de incumplimiento
  // sobre fecha compromiso. Si la línea está entregada, usa el valor
  // congelado de incumplimiento del archivo (si existe) o 0.
  const q = Number(job.qty ?? 0);
  const e = Number(job.qtyEntregada ?? 0);
  if (q > 0 && e >= q) {
    // Entregada: aging final = días de incumplimiento registrados (o 0)
    return Math.max(0, Number(job.diasIncumplimiento ?? 0));
  }
  // Pendiente / parcial: usa días de retraso vs fecha compromiso
  return Math.max(0, jobDelayDays(job));
}

export type AgingBucket = "0-2" | "3-5" | "6-10" | ">10";
export function agingBucket(days: number): AgingBucket {
  if (days <= 2) return "0-2";
  if (days <= 5) return "3-5";
  if (days <= 10) return "6-10";
  return ">10";
}

export type SlaStatus = "Cumplido" | "En riesgo" | "Vencido";
/** SLA por LÍNEA (orden + ítem) según estado operativo y días vs compromiso. */
export function slaStatus(job: Job): SlaStatus {
  const ls = lineStatus(job);
  const d = jobDelayDays(job);
  if (ls === "Entregado") return d > 0 ? "Vencido" : "Cumplido";
  if (ls === "Vencido") return "Vencido";
  if (ls === "Próximo a Vencer") return "En riesgo";
  // Pendiente / Parcial sin retraso
  if (d > 0) return "Vencido";
  if (d >= -2) return "En riesgo";
  return "Cumplido";
}

export const slaColors: Record<SlaStatus, string> = {
  Cumplido: "bg-success/15 text-success border border-success/30",
  "En riesgo": "bg-warning/15 text-warning border border-warning/40",
  Vencido: "bg-destructive/15 text-destructive border border-destructive/30",
};

export function isCritico(job: Job): boolean {
  return job.prioridad === "Crítica" || slaStatus(job) === "Vencido" || job.escalado;
}

// ============= ERP / Procurement intelligence =============

/** Días de retraso vs. fecha contractual de entrega.
 *  >0 = atrasado, 0 = a tiempo, <0 = aún en plazo (negativo = días restantes). */
export function delayDays(job: Job): number {
  const target = job.fechaEntregaContractual || job.etaCampo || job.eta;
  if (!target) return 0;
  const closed = ["Cerrado", "Facturado", "Entregado"] as JobStatus[];
  const ref = closed.includes(job.status)
    ? new Date(job.factura ?? job.aduana ?? job.ata ?? new Date().toISOString())
    : new Date();
  return diasHabiles(target, ref);
}

export type DelayBucket = "A tiempo" | "1-7d" | "8-15d" | "16-30d" | ">30d";
export function delayBucket(d: number): DelayBucket {
  if (d <= 0) return "A tiempo";
  if (d <= 7) return "1-7d";
  if (d <= 15) return "8-15d";
  if (d <= 30) return "16-30d";
  return ">30d";
}

export const delayBucketColors: Record<DelayBucket, string> = {
  "A tiempo": "bg-success/15 text-success border border-success/30",
  "1-7d": "bg-warning/15 text-warning border border-warning/40",
  "8-15d": "bg-warning/25 text-warning border border-warning/50",
  "16-30d": "bg-destructive/15 text-destructive border border-destructive/30",
  ">30d": "bg-destructive/25 text-destructive border border-destructive/50",
};

/** Compliance: 100 si entregado a tiempo, decae con días de retraso. */
export function compliance(job: Job): number {
  const d = delayDays(job);
  if (d <= 0) return 100;
  return Math.max(0, Math.round(100 - d * 3));
}

/** Urgency score 0-100 combinando prioridad + retraso + SLA + escalado. */
export function urgencyScore(job: Job): number {
  const prioW: Record<Priority, number> = { Baja: 10, Media: 25, Alta: 50, Crítica: 80 };
  const d = Math.max(0, delayDays(job));
  const sla = slaStatus(job);
  const slaW = sla === "Vencido" ? 30 : sla === "En riesgo" ? 15 : 0;
  const esc = job.escalado ? 15 : 0;
  return Math.min(100, prioW[job.prioridad] + Math.min(40, d * 2) + slaW + esc);
}

export type Criticality = "Bajo" | "Medio" | "Alto" | "Crítico";
export function criticality(job: Job): Criticality {
  const s = urgencyScore(job);
  if (s >= 80) return "Crítico";
  if (s >= 55) return "Alto";
  if (s >= 30) return "Medio";
  return "Bajo";
}

export const criticalityColors: Record<Criticality, string> = {
  Bajo: "bg-muted text-muted-foreground border border-border",
  Medio: "bg-info/15 text-info border border-info/30",
  Alto: "bg-warning/15 text-warning border border-warning/40",
  Crítico: "bg-destructive/15 text-destructive border border-destructive/30",
};

/** % de cantidad pendiente vs total. */
export function pendientePct(job: Job): number {
  const total = Number(job.qty ?? 0);
  if (!total) return 0;
  const pend = Number(job.qtyPendiente ?? Math.max(0, total - Number(job.qtyEntregada ?? 0)));
  return Math.max(0, Math.min(100, Math.round((pend / total) * 100)));
}


// ============= Módulo 1 — Estados y cálculos de la línea =============

const DAY_MS = 86400000;

export function saldoPendiente(job: Job): number {
  const q = Number(job.qty ?? 0);
  const e = Number(job.qtyEntregada ?? 0);
  return Math.max(0, q - e);
}

export function valorComprado(job: Job): number {
  if (job.valorTotal && job.valorTotal > 0) return Number(job.valorTotal);
  const q = Number(job.qty ?? 0);
  const vu = Number(job.valorUnitario ?? 0);
  if (q * vu > 0) return q * vu;
  return 0;
}

export function valorRecibido(job: Job): number {
  const totalCop = Number(job.valorTotal ?? 0);
  const pendienteCop = Number(job.valorPendienteCop ?? 0);
  if (totalCop > 0 && pendienteCop > 0) return Math.max(0, totalCop - pendienteCop);
  const e = Number(job.qtyEntregada ?? 0);
  const vu = Number(job.valorUnitario ?? 0);
  if (e * vu > 0) return e * vu;
  return 0;
}

export function valorPendiente(job: Job): number {
  if (job.valorPendienteUsd && Number(job.valorPendienteUsd) > 0 && !job.valorTotal) {
    return Number(job.valorPendienteUsd);
  }
  return Math.max(0, valorComprado(job) - valorRecibido(job));
}

// ===== Valores en USD =====
// FUENTE ÚNICA: columna BC del Excel → mapeada como `valorTotalUsd`.
// No se estima desde otras columnas. Si BC está vacía para una línea,
// esa línea aporta 0. Así el total siempre refleja exactamente la suma de BC.
export function valorCompradoUsd(job: Job): number {
  const v = Number(job.valorTotalUsd ?? 0);
  return isFinite(v) && v > 0 ? v : 0;
}
export function valorRecibidoUsd(job: Job): number {
  const total = valorCompradoUsd(job);
  if (total <= 0) return 0;

  // PASO 1: estados que garantizan 0 recibido — antes de cualquier otro cálculo.
  // Borrado / Sin entrega nunca tienen valor recibido, sin importar otros campos.
  const s = String(job.estadoEntrega ?? "").toLowerCase().trim();
  const esBorrado    = s === "borrado" || s === "eliminado" || s.startsWith("borr") ||
                       s === "baja"    || s === "anulado"   || s === "cancelado";
  const esSinEntrega = s === "sin entrega" || s === "sin entregar" ||
                       s === "pendiente"   || s === "no entregado";
  if (esBorrado || esSinEntrega) return 0;

  // PASO 2: columna "valor x entregar usd" del Excel → recibido = total − pendiente.
  // Solo cuando pendiente > 0 (0 podría ser celda vacía no informada).
  if (job.valorPendienteUsd !== null && job.valorPendienteUsd !== undefined) {
    const pending = Number(job.valorPendienteUsd);
    if (isFinite(pending) && pending > 0) return Math.max(0, total - pending);
  }

  // PASO 3: ratio de cantidades entregadas.
  const q = Number(job.qty ?? 0);
  const e = Number(job.qtyEntregada ?? 0);
  if (q > 0 && e >= q) return total;
  if (q > 0 && e > 0) return (total / q) * e;

  // PASO 4: estado dice entregado pero sin datos de cantidad.
  if (s === "entregado" || s === "delivered" || s === "completo" || s === "completado") return total;

  return 0;
}
export function valorPendienteUsdFn(job: Job): number {
  // Prioridad 1: columna directa del Excel "valor x entregar usd"
  if (job.valorPendienteUsd !== null && job.valorPendienteUsd !== undefined) {
    const v = Number(job.valorPendienteUsd);
    if (isFinite(v) && v > 0) return v;
  }
  return Math.max(0, valorCompradoUsd(job) - valorRecibidoUsd(job));
}

// ===== Valores en COP (desde el archivo, si existen) =====
export function valorPendienteCopFn(job: Job): number {
  if (job.valorPendienteCop && Number(job.valorPendienteCop) > 0) return Number(job.valorPendienteCop);
  return Math.max(0, valorComprado(job) - valorRecibido(job));
}
export function tieneCop(job: Job): boolean {
  return !!(job.valorPendienteCop && Number(job.valorPendienteCop) > 0) ||
    ((job.monedaPedido || job.moneda || "").toString().toUpperCase() === "COP");
}

/** Días de retraso vs. Fecha Compromiso (Módulo 1). */
export function diasRetraso(job: Job): number {
  const target = job.fechaCompromiso || job.fechaEntregaContractual || job.etaCampo;
  if (!target) return 0;
  return diasHabiles(target, new Date());
}

/** Estado automático de la línea según reglas del documento. */
export function lineStatus(job: Job): LineStatus {
  const q = Number(job.qty ?? 0);
  const e = Number(job.qtyEntregada ?? 0);
  if (q > 0 && e >= q) return "Entregado";
  const d = diasRetraso(job);
  const pend = q - e;
  if (pend > 0 && d > 0) return "Vencido";
  if (pend > 0 && d >= -7 && d <= 0) return "Próximo a Vencer";
  if (e > 0 && e < q) return "Parcial";
  return "Pendiente";
}

/** Rangos oficiales Informe de Incumplimiento. */
export type DelayRange =
  | "A tiempo / Anticipadas"
  | "1-10 días"
  | "11-30 días"
  | "31-60 días"
  | "61-90 días"
  | ">91 días";

export const DELAY_RANGES: DelayRange[] = [
  "A tiempo / Anticipadas",
  "1-10 días",
  "11-30 días",
  "31-60 días",
  "61-90 días",
  ">91 días",
];

export function delayRange(d: number): DelayRange {
  if (d <= 0) return "A tiempo / Anticipadas";
  if (d <= 10) return "1-10 días";
  if (d <= 30) return "11-30 días";
  if (d <= 60) return "31-60 días";
  if (d <= 90) return "61-90 días";
  return ">91 días";
}

/** Días de incumplimiento del job: prioriza dias_incumplimiento del archivo, si no calcula. */
export function jobDelayDays(job: Job): number {
  if (job.diasIncumplimiento != null && isFinite(Number(job.diasIncumplimiento))) {
    return Number(job.diasIncumplimiento);
  }
  return diasRetraso(job);
}

/** Clasificación automática Nacional / Importación si no viene marcada. */
export function deriveTipoCompra(job: Job): TipoCompra {
  if (job.tipoCompra === "Nacional" || job.tipoCompra === "Importación") return job.tipoCompra;
  const inco = (job.incoterms ?? "").toUpperCase();
  const intl = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];
  if (intl.some((i) => inco.includes(i))) return "Importación";
  if (job.paisOrigen && !/colombia|^co$/i.test(job.paisOrigen)) return "Importación";
  if (job.bl || job.awb || job.contenedor || job.forwarder || job.naviera) return "Importación";
  return "Nacional";
}

export function fmtMoney(v: number, currency: string = "USD"): string {
  if (!isFinite(v)) v = 0;
  const c = (currency || "USD").toUpperCase();
  const safe = ["USD", "COP", "EUR"].includes(c) ? c : "USD";
  return v.toLocaleString("es-CO", { style: "currency", currency: safe, maximumFractionDigits: 0 });
}

/** Construye la LLAVE: OC + posición (LLAVE 1 + LLAVE 2). */
export function buildLlave(oc?: string | null, posicion?: string | null): string | null {
  const o = (oc ?? "").toString().trim();
  if (!o) return null;
  const p = (posicion ?? "").toString().trim();
  return p ? `${o}-${p.padStart(2, "0")}` : o;
}

export function jobLlave(job: Job): string {
  return job.llave || buildLlave(job.oc, job.posicion) || job.bdpJob || job.id;
}

export function jobMoneda(job: Job): string {
  return (job.monedaPedido || job.moneda || "USD").toString().toUpperCase();
}

/** ===== Filtro OFICIAL de OC Activa (Módulo Dashboard) =====
 *  BF (Estado de entrega) ∈ {"Entrega Parcial","Sin entrega"}
 *  AND
 *  BH (Estado adicional)  ∈ {"0","L"}
 *  Esta es la ÚNICA función de filtrado base. Cualquier KPI del dashboard
 *  debe ejecutarse SOBRE el resultado de filtrar con esta función.
 */
const BF_ACTIVOS = new Set(["entrega parcial", "sin entrega"]);
const BH_ACTIVOS = new Set(["0", "l"]);

function normTxt(v: unknown): string {
  return String(v ?? "").toLowerCase().trim();
}

export function isOcActiva(job: Job): boolean {
  const bf = normTxt(job.estadoEntrega);
  const bh = normTxt(job.estadoAdicional);
  return BF_ACTIVOS.has(bf) && BH_ACTIVOS.has(bh);
}

export function filterActivas(jobs: Job[]): Job[] {
  return jobs.filter(isOcActiva);
}

/** Responsable normalizado: "Sin asignar" cuando viene vacío. */
export function jobResponsable(job: Job): string {
  const r = String(job.responsable ?? "").trim();
  return r || "Sin asignar";
}

/** Línea "a tiempo": sin días de retraso vs compromiso. */
export function lineaATiempo(job: Job): boolean {
  return jobDelayDays(job) <= 0;
}

/** Línea atrasada: pendiente (no entregada) y con días de retraso > 0. */
export function lineaAtrasada(job: Job): boolean {
  const q = Number(job.qty ?? 0);
  const e = Number(job.qtyEntregada ?? 0);
  if (q > 0 && e >= q) return false;
  return jobDelayDays(job) > 0;
}

// ===== Estado a NIVEL DE ORDEN (Nivel 1) =====
export type OrderStatus = "Entregada" | "Parcial" | "Pendiente" | "Atrasada";
export function orderStatusFromLines(lineas: Job[]): OrderStatus {
  if (!lineas.length) return "Pendiente";
  let entregadas = 0;
  let conEntrega = 0;
  let atrasadasPend = 0;
  for (const j of lineas) {
    const q = Number(j.qty ?? 0);
    const e = Number(j.qtyEntregada ?? 0);
    if (q > 0 && e >= q) entregadas++;
    else {
      if (e > 0) conEntrega++;
      if (jobDelayDays(j) > 0) atrasadasPend++;
    }
  }
  if (entregadas === lineas.length) return "Entregada";
  if (atrasadasPend > 0) return "Atrasada";
  if (entregadas === 0 && conEntrega === 0) return "Pendiente";
  return "Parcial";
}

// ===== Rangos de incumplimiento operativos (0-30, 31-60, 61-90, >90) =====
export type DelayRange30 = "0-30 días" | "31-60 días" | "61-90 días" | ">90 días";
export const DELAY_RANGES_30: DelayRange30[] = ["0-30 días", "31-60 días", "61-90 días", ">90 días"];
export function delayRange30(d: number): DelayRange30 {
  if (d <= 30) return "0-30 días";
  if (d <= 60) return "31-60 días";
  if (d <= 90) return "61-90 días";
  return ">90 días";
}
