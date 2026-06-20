import type { Job, LineStatus } from "./jobs-data";
import {
  lineStatus,
  valorComprado,
  valorRecibido,
  valorPendiente,
  valorCompradoUsd,
  valorRecibidoUsd,
  valorPendienteUsdFn,
  valorPendienteCopFn,
  saldoPendiente,
  diasRetraso,
} from "./operational";

export interface JobsSweep {
  ordenes: number;
  lineas: number;
  porEstado: Record<LineStatus, number>;
  qtyTotal: number;
  qtyRecibida: number;
  qtyFaltante: number;
  valorComprado: number;
  valorRecibido: number;
  valorPendiente: number;
  valorCompradoUsd: number;
  valorRecibidoUsd: number;
  valorPendienteUsd: number;
  valorCompradoCop: number;
  valorRecibidoCop: number;
  valorPendienteCop: number;
  retrasadas: number;
}

export function sweepJobs(jobs: Job[]): JobsSweep {
  const ocs = new Set<string>();
  const porEstado: Record<LineStatus, number> = {
    Entregado: 0,
    Parcial: 0,
    Pendiente: 0,
    Vencido: 0,
    "Próximo a Vencer": 0,
  };
  let qtyTotal = 0;
  let qtyRecibida = 0;
  let vc = 0;
  let vr = 0;
  let vp = 0;
  let vcUsd = 0;
  let vrUsd = 0;
  let vpUsd = 0;
  let vcCop = 0;
  let vrCop = 0;
  let vpCop = 0;
  let retrasadas = 0;

  for (const j of jobs) {
    const ocKey = j.oc?.trim() || j.bdpJob || j.id;
    ocs.add(ocKey);
    porEstado[lineStatus(j)] += 1;
    qtyTotal += Number(j.qty ?? 0);
    qtyRecibida += Number(j.qtyEntregada ?? 0);
    vc += valorComprado(j);
    vr += valorRecibido(j);
    vp += valorPendiente(j);
    vcUsd += valorCompradoUsd(j);
    vrUsd += valorRecibidoUsd(j);
    vpUsd += valorPendienteUsdFn(j);
    vcCop += valorComprado(j);
    vrCop += valorRecibido(j);
    vpCop += valorPendienteCopFn(j);
    if (diasRetraso(j) > 0 && saldoPendiente(j) > 0) retrasadas += 1;
  }

  return {
    ordenes: ocs.size,
    lineas: jobs.length,
    porEstado,
    qtyTotal,
    qtyRecibida,
    qtyFaltante: Math.max(0, qtyTotal - qtyRecibida),
    valorComprado: vc,
    valorRecibido: vr,
    valorPendiente: vp,
    valorCompradoUsd: vcUsd,
    valorRecibidoUsd: vrUsd,
    valorPendienteUsd: vpUsd,
    valorCompradoCop: vcCop,
    valorRecibidoCop: vrCop,
    valorPendienteCop: vpCop,
    retrasadas,
  };
}

export interface OcGroup {
  oc: string;
  lineas: Job[];
  qtyTotal: number;
  qtyRecibida: number;
  qtyFaltante: number;
  entregadas: number;
  parciales: number;
  pendientes: number;
  vencidas: number;
  valorComprado: number;
  valorRecibido: number;
  valorPendiente: number;
  valorCompradoUsd: number;
  valorRecibidoUsd: number;
  valorPendienteUsd: number;
  valorCompradoCop: number;
  valorRecibidoCop: number;
  valorPendienteCop: number;
}

export function groupByOc(jobs: Job[]): OcGroup[] {
  const map = new Map<string, Job[]>();
  for (const j of jobs) {
    const key = j.oc?.trim() || j.bdpJob || j.id;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(j);
  }
  return Array.from(map.entries()).map(([oc, lineas]) => {
    const s = sweepJobs(lineas);
    return {
      oc,
      lineas,
      qtyTotal: s.qtyTotal,
      qtyRecibida: s.qtyRecibida,
      qtyFaltante: s.qtyFaltante,
      entregadas: s.porEstado.Entregado,
      parciales: s.porEstado.Parcial,
      pendientes: s.porEstado.Pendiente + s.porEstado["Próximo a Vencer"],
      vencidas: s.porEstado.Vencido,
      valorComprado: s.valorComprado,
      valorRecibido: s.valorRecibido,
      valorPendiente: s.valorPendiente,
      valorCompradoUsd: s.valorCompradoUsd,
      valorRecibidoUsd: s.valorRecibidoUsd,
      valorPendienteUsd: s.valorPendienteUsd,
      valorCompradoCop: s.valorCompradoCop,
      valorRecibidoCop: s.valorRecibidoCop,
      valorPendienteCop: s.valorPendienteCop,
    };
  });
}
