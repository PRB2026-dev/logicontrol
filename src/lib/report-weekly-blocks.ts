/**
 * Reporte Semanal — Bloques NUEVOS (A y B) + "Líneas activas a tiempo".
 *
 * REGLAS:
 *  - Cálculos DERIVADOS y de SOLO LECTURA. No modifican `jobs` ni los datos originales.
 *  - BK (diasIncumplimiento) se usa TAL CUAL viene de la hoja. No se recalcula.
 *  - Base deduplicada por LLAVE (oc + posición), conservando la primera ocurrencia.
 *  - OC = valores distintos de T (oc). Los conteos de OC por categoría son
 *    independientes (una OC puede estar en varias categorías): NUNCA se suman.
 *  - No depende de la ventana del reporte: trabaja sobre la base completa
 *    deduplicada para coincidir con los valores de referencia oficiales.
 *
 * Columnas DATA FINAL implicadas:
 *  T=oc · BF=estadoEntrega · BH=estadoAdicional · BK=diasIncumplimiento
 *  R=responsable · BY=categoriaSeguimiento · AR=fechaEntregaContractual
 *  AK=fechaAceptacion · BV=fechaRecepcion (fecha real de entrega)
 */

import type { Job } from "./jobs-data";
import { estadoOf, valorCompradoUsd, jobLlave } from "./operational";

const norm = (v: unknown): string => String(v ?? "").toLowerCase().trim();

// ─── Base KPI (población oficial) ─────────────────────────────────────────────
// Nacional · BH ∈ {0, L} · BF ≠ BORRADO.
export function baseKpi(jobs: Job[]): Job[] {
  return jobs.filter((j) => {
    if ((j.tipoCompra ?? "") === "Importación") return false;
    const bh = norm(j.estadoAdicional);
    if (bh !== "0" && bh !== "l") return false;
    const bf = norm(j.estadoEntrega);
    if (bf === "borrado" || bf.startsWith("borr")) return false;
    return true;
  });
}

// ─── Deduplicación por LLAVE (oc + posición) — derivada, solo lectura ─────────
export function dedupByLlave(jobs: Job[]): Job[] {
  const seen = new Set<string>();
  const out: Job[] = [];
  for (const j of jobs) {
    const k = jobLlave(j);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(j);
  }
  return out;
}

// ─── BK de la hoja (sin recalcular) ───────────────────────────────────────────
export function bkRaw(j: Job): number {
  return Number(j.diasIncumplimiento ?? 0);
}

// ─── d = BV − AR en días CALENDARIO (null si falta AR o BV) ─────────────────────
export function diasBvMenosAr(j: Job): number | null {
  const ar = j.fechaEntregaContractual;
  const bv = j.fechaRecepcion;
  if (!ar || !bv) return null;
  const da = new Date(ar);
  const db = new Date(bv);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

// ─── Clasificaciones por línea ────────────────────────────────────────────────
export type Clasif = "Anticipada" | "En fecha" | "Atrasada";

/** Bloque A: entregadas (BF = ENTREGADO), clasificadas por BK de la hoja. */
export function clasifBloqueA(j: Job): Clasif | null {
  if (estadoOf(j) !== "Entregado") return null;
  const bk = bkRaw(j);
  if (bk < 0) return "Anticipada";
  if (bk === 0) return "En fecha";
  return "Atrasada";
}

/** Bloque B: entregadas con BV, clasificadas por d = BV − AR.
 *  Entregadas sin BV → "Sin fecha real" (no se descartan). */
export function clasifBloqueB(j: Job): Clasif | "Sin fecha real" | null {
  if (estadoOf(j) !== "Entregado") return null;
  if (!j.fechaRecepcion) return "Sin fecha real";
  const d = diasBvMenosAr(j);
  if (d === null) return "Sin fecha real";
  if (d < 0) return "Anticipada";
  if (d === 0) return "En fecha";
  return "Atrasada";
}

// ─── Resultados agregados ─────────────────────────────────────────────────────
export interface CategoriaResumen {
  lineas: number;
  ocs: number;          // OC únicas de esta categoría (Set, no suma entre categorías)
  usd: number;          // USD (BC, valorCompradoUsd)
}

function resumenCategoria(lineas: Job[]): CategoriaResumen {
  const ocs = new Set<string>();
  let usd = 0;
  for (const j of lineas) {
    const oc = (j.oc ?? "").trim();
    if (oc) ocs.add(oc);
    usd += valorCompradoUsd(j);
  }
  return { lineas: lineas.length, ocs: ocs.size, usd };
}

export interface BloqueAResult {
  total: CategoriaResumen;
  anticipadas: CategoriaResumen;
  enFecha: CategoriaResumen;
  atrasadas: CategoriaResumen;
}

export interface BloqueBResult {
  // Entregadas con BV (clasificadas por d = BV − AR)
  conBvTotal: number;
  anticipadas: CategoriaResumen;
  enFecha: CategoriaResumen;
  atrasadas: CategoriaResumen;
  // Entregadas sin BV (no se descartan)
  sinFechaReal: number;
  // Líneas que cambian de clasificación entre A (BK) y B (BV−AR)
  cambiaron: number;
}

export interface ActivasResult {
  aTiempo: { lineas: number; ocs: number };
  atrasada: { lineas: number; ocs: number };
  totalLineas: number;
  unionOcs: number;      // OC únicas en a tiempo O atrasada
  intersecOcs: number;   // OC presentes en AMBAS (para 112 + 47 − 11 = 148)
}

export interface WeeklyBlocksResult {
  baseLineas: number;
  entregadas: number;
  bloqueA: BloqueAResult;
  bloqueB: BloqueBResult;
  activas: ActivasResult;
}

/** Calcula todos los bloques nuevos sobre `jobs` (base completa deduplicada). */
export function computeWeeklyBlocks(jobs: Job[]): WeeklyBlocksResult {
  const base = dedupByLlave(baseKpi(jobs));
  const entregadas = base.filter((j) => estadoOf(j) === "Entregado");
  const conBv = entregadas.filter((j) => !!j.fechaRecepcion);

  // ─── Bloque A: entregadas por BK ──────────────────────────────────────────────
  const aAnt = entregadas.filter((j) => clasifBloqueA(j) === "Anticipada");
  const aEnf = entregadas.filter((j) => clasifBloqueA(j) === "En fecha");
  const aAtr = entregadas.filter((j) => clasifBloqueA(j) === "Atrasada");

  // ─── Bloque B: entregadas con BV por d = BV − AR ─────────────────────────────
  const bAnt = conBv.filter((j) => clasifBloqueB(j) === "Anticipada");
  const bEnf = conBv.filter((j) => clasifBloqueB(j) === "En fecha");
  const bAtr = conBv.filter((j) => clasifBloqueB(j) === "Atrasada");

  // Líneas que cambian de clasificación entre A (BK) y B (BV−AR).
  // Solo entre entregadas CON BV (ambas clasificaciones son reales).
  let cambiaron = 0;
  for (const j of conBv) {
    const ca = clasifBloqueA(j);
    const cb = clasifBloqueB(j);
    if (ca !== null && cb !== null && ca !== cb) cambiaron++;
  }

  // ─── Activas a tiempo / atrasada (BF ∈ {sin entrega, entrega parcial}) ────────
  const activas = base.filter((j) => {
    const bf = norm(j.estadoEntrega);
    return bf === "sin entrega" || bf.includes("parcial");
  });
  const aTiempo = activas.filter((j) => bkRaw(j) <= 0);
  const aAtrasada = activas.filter((j) => bkRaw(j) > 0);
  const ocsATiempo = new Set(aTiempo.map((j) => (j.oc ?? "").trim()).filter(Boolean));
  const ocsAAtrasada = new Set(aAtrasada.map((j) => (j.oc ?? "").trim()).filter(Boolean));
  const intersecOcs = [...ocsATiempo].filter((o) => ocsAAtrasada.has(o)).length;
  const unionOcs = new Set([...ocsATiempo, ...ocsAAtrasada]).size;

  return {
    baseLineas: base.length,
    entregadas: entregadas.length,
    bloqueA: {
      total: resumenCategoria(entregadas),
      anticipadas: resumenCategoria(aAnt),
      enFecha: resumenCategoria(aEnf),
      atrasadas: resumenCategoria(aAtr),
    },
    bloqueB: {
      conBvTotal: conBv.length,
      anticipadas: resumenCategoria(bAnt),
      enFecha: resumenCategoria(bEnf),
      atrasadas: resumenCategoria(bAtr),
      sinFechaReal: entregadas.length - conBv.length,
      cambiaron,
    },
    activas: {
      aTiempo: { lineas: aTiempo.length, ocs: ocsATiempo.size },
      atrasada: { lineas: aAtrasada.length, ocs: ocsAAtrasada.size },
      totalLineas: activas.length,
      unionOcs,
      intersecOcs,
    },
  };
}

// ─── Helpers para la exportación (clasificación legible por línea) ─────────────
export function clasifALabel(j: Job): string {
  const c = clasifBloqueA(j);
  return c ?? "—";
}
export function clasifBLabel(j: Job): string {
  const c = clasifBloqueB(j);
  return c ?? "—";
}
