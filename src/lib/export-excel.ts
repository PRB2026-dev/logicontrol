import * as XLSX from "xlsx";
import type { Job } from "./jobs-data";
import {
  computeAging,
  slaStatus,
  jobLlave,
  jobMoneda,
  valorCompradoUsd,
  valorRecibidoUsd,
  valorPendienteUsdFn,
  valorComprado,
  valorRecibido,
  valorPendienteCopFn,
} from "./operational";

export function exportJobsToExcel(jobs: Job[], filename = "operaciones.xlsx") {
  const rows = jobs.map((j) => ({
    LLAVE: jobLlave(j),
    "Orden de Compra": j.oc ?? j.bdpJob ?? "",
    Posición: j.posicion ?? "",
    "SAP": j.codigoSap ?? "",
    Proveedor: j.proveedor ?? j.cliente ?? "",
    Material: j.material ?? "",
    UM: j.um ?? "",
    Qty: Number(j.qty ?? 0),
    "Qty entregada": Number(j.qtyEntregada ?? 0),
    "Qty pendiente": Number(j.qtyPendiente ?? Math.max(0, Number(j.qty ?? 0) - Number(j.qtyEntregada ?? 0))),
    Moneda: jobMoneda(j),
    "Comprado USD": valorCompradoUsd(j),
    "Recibido USD": valorRecibidoUsd(j),
    "Pendiente USD": valorPendienteUsdFn(j),
    "Comprado COP": valorComprado(j),
    "Recibido COP": valorRecibido(j),
    "Pendiente COP": valorPendienteCopFn(j),
    Estado: j.status,
    "Status general": j.statusGeneral ?? "",
    Prioridad: j.prioridad,
    SLA: slaStatus(j),
    "Aging (d)": computeAging(j),
    Incoterms: j.incoterms ?? "",
    Modo: j.modo,
    Origen: j.origen,
    Destino: j.destino,
    Carrier: j.carrier,
    Responsable: j.responsable,
    Centro: j.centro,
    "Fecha orden": j.fechaOrden ?? "",
    "Compromiso proveedor": j.compromisoProveedor ?? j.fechaCompromiso ?? "",
    "Fecha real entrega": j.fechaRecepcion ?? "",
    ETA: j.eta,
    ATA: j.ata ?? "",
    Aduana: j.aduana ?? "",
    Factura: j.factura ?? "",
    Escalado: j.escalado ? "Sí" : "No",
    "Fecha creación": j.fechaCreacion,
    Observaciones: j.observaciones,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Operaciones");
  XLSX.writeFile(wb, filename);
}
