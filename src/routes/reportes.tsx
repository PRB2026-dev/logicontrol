import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { FileText, Download, Calendar, CheckCircle2, AlertTriangle, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useJobsStore } from "@/lib/jobs-store";
import { exportJobsToExcel } from "@/lib/export-excel";
import { slaStatus, jobDelayDays, lineStatus, fmtMoney, valorCompradoUsd, valorPendienteUsdFn, diasHabiles } from "@/lib/operational";
import type { Job } from "@/lib/jobs-data";
import { useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { ReportWeeklyBlocks } from "@/components/report-weekly-blocks";
import { computeWeeklyBlocks, clasifALabel, clasifBLabel, diasBvMenosAr } from "@/lib/report-weekly-blocks";

export const Route = createFileRoute("/reportes")({
  component: () => (
    <AppShell>
      <Reportes />
    </AppShell>
  ),
});

const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();

function Reportes() {
  const jobs = useJobsStore((s) => s.jobs);
  const weeklyBlocks = useMemo(() => computeWeeklyBlocks(jobs), [jobs]);

  // ─── Reporte Semanal: métricas ──────────────────────────────────────────────
  const semanal = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Últimos 5 días hábiles (lun-vie, sin festivos) = 1 semana laboral
    const FESTIVOS_SET = new Set([
      "2025-01-01","2025-01-06","2025-03-24","2025-04-17","2025-04-18","2025-05-01","2025-06-02","2025-06-23","2025-06-30","2025-07-20","2025-08-07","2025-08-18","2025-10-13","2025-11-03","2025-11-17","2025-12-08","2025-12-25",
      "2026-01-01","2026-01-12","2026-03-23","2026-04-02","2026-04-03","2026-05-01","2026-05-18","2026-06-08","2026-06-15","2026-06-29","2026-07-20","2026-08-07","2026-08-17","2026-10-12","2026-11-02","2026-11-16","2026-12-08","2026-12-25",
    ]);
    let hace7 = new Date(today);
    let diasHabilesContados = 0;
    while (diasHabilesContados < 5) {
      hace7.setDate(hace7.getDate() - 1);
      const day = hace7.getDay();
      const iso = hace7.toISOString().slice(0, 10);
      if (day !== 0 && day !== 6 && !FESTIVOS_SET.has(iso)) diasHabilesContados++;
    }

    // Solo líneas activas: BH=[0,L] + BF=[sin entrega, entrega parcial] + no importaciones
    const activas = jobs.filter(j => {
      if ((j.tipoCompra ?? "") === "Importación") return false;
      const bh = norm(j.estadoAdicional);
      if (bh !== "0" && bh !== "l") return false;
      const bf = norm(j.estadoEntrega);
      if (bf !== "sin entrega" && !bf.includes("parcial")) return false;
      return true;
    });

    // 1. Total OC y líneas sujetas a seguimiento (todas las activas ya son pendientes)
    const lineasSeguimiento = activas;
    const ocsSeguimiento = new Set(lineasSeguimiento.map(j => (j.oc ?? "").trim()).filter(Boolean));
    const totalOCSeguimiento = ocsSeguimiento.size;
    const totalLineasSeguimiento = lineasSeguimiento.length;

    // 2. % Cumplimiento ANS (seguimiento últimos 14 días hábiles)
    let conSeguimiento = 0;
    for (const j of lineasSeguimiento) {
      if (j.fechaSeguimiento) {
        const dias = diasHabiles(j.fechaSeguimiento, today);
        if (dias <= 14) conSeguimiento++;
      }
    }
    const pctCumplimientoANS = lineasSeguimiento.length > 0
      ? Math.round((conSeguimiento / lineasSeguimiento.length) * 100) : 0;

    // 3. Entregas programadas vs cumplidas (fecha entrega CONTRACTUAL en la semana)
    // Filtro: no importaciones, BH=[0,L], excluir borradas
    const todasNoImpo = jobs.filter(j => {
      if ((j.tipoCompra ?? "") === "Importación") return false;
      const bh = norm(j.estadoAdicional);
      if (bh !== "0" && bh !== "l") return false;
      const bf = norm(j.estadoEntrega);
      if (bf === "borrado" || bf.startsWith("borr")) return false;
      return true;
    });
    const programadasSemana = todasNoImpo.filter(j => {
      const fecha = j.fechaEntregaContractual || j.fechaCompromiso;
      if (!fecha) return false;
      const d = new Date(fecha);
      d.setHours(0, 0, 0, 0);
      return d >= hace7 && d <= today;
    });
    const cumplidasSemana = programadasSemana.filter(j => norm(j.estadoEntrega) === "entregado");
    const parcialesSemana = programadasSemana.filter(j => norm(j.estadoEntrega).includes("parcial"));
    const pendientesSemana = programadasSemana.filter(j => {
      const bf = norm(j.estadoEntrega);
      return bf === "sin entrega" || bf === "sin entregar" || bf === "pendiente";
    });
    const totalProgramadas = programadasSemana.length;
    const totalCumplidas = cumplidasSemana.length;
    const totalParciales = parcialesSemana.length;
    const totalPendientesSem = pendientesSemana.length;

    // 4. Alertas emitidas = promedio de seguimientos preventivos por línea
    // Incluye: BH=[0,L], BF=[sin entrega, parcial, entregado], excluye borradas e importaciones
    const lineasParaAlertas = jobs.filter(j => {
      if ((j.tipoCompra ?? "") === "Importación") return false;
      const bh = norm(j.estadoAdicional);
      if (bh !== "0" && bh !== "l") return false;
      const bf = norm(j.estadoEntrega);
      if (bf === "borrado" || bf.startsWith("borr")) return false;
      return true;
    });
    const totalSeguimientosPreventivos = lineasParaAlertas.reduce((s, j) => s + Number(j.cantSeguimientoPreventivo ?? 0), 0);
    const alertasEmitidas = lineasParaAlertas.length > 0 ? Math.round((totalSeguimientosPreventivos / lineasParaAlertas.length) * 100) / 100 : 0;

    // 5. Backlog operativo (órdenes atrasadas sin entregar)
    const backlog = lineasSeguimiento.filter(j => jobDelayDays(j) > 0);
    const backlogCount = backlog.length;
    const backlogUsd = backlog.reduce((s, j) => s + valorPendienteUsdFn(j), 0);
    const backlogOCs = new Set(backlog.map(j => (j.oc ?? "").trim()).filter(Boolean)).size;

    // 6. Riesgos críticos (incumplimiento > 30 días sin seguimiento reciente)
    const riesgosCriticos = lineasSeguimiento.filter(j => {
      const delay = jobDelayDays(j);
      if (delay <= 30) return false;
      if (!j.fechaSeguimiento) return true;
      const diasSinGestion = diasHabiles(j.fechaSeguimiento, today);
      return diasSinGestion > 14;
    });
    const totalRiesgosCriticos = riesgosCriticos.length;
    const usdRiesgo = riesgosCriticos.reduce((s, j) => s + valorPendienteUsdFn(j), 0);

    return {
      totalOCSeguimiento, totalLineasSeguimiento,
      pctCumplimientoANS, conSeguimiento,
      totalProgramadas, totalCumplidas, totalParciales, totalPendientesSem,
      alertasEmitidas, totalSeguimientosPreventivos, totalLineasAlertas: lineasParaAlertas.length,
      backlogCount, backlogUsd, backlogOCs,
      totalRiesgosCriticos, usdRiesgo,
    };
  }, [jobs]);

  // ─── Reporte >30 días hábiles: métricas ─────────────────────────────────────
  const reporte30 = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Líneas activas: BH=[0,L] + BF=[sin entrega, entrega parcial] + no importaciones
    const activas30 = jobs.filter(j => {
      if ((j.tipoCompra ?? "") === "Importación") return false;
      const bh = norm(j.estadoAdicional);
      if (bh !== "0" && bh !== "l") return false;
      const bf = norm(j.estadoEntrega);
      if (bf !== "sin entrega" && !bf.includes("parcial")) return false;
      return true;
    });

    // Solo las que tienen >30 días hábiles de incumplimiento
    const lineas30 = activas30.filter(j => jobDelayDays(j) > 30);
    const ocs30 = new Set(lineas30.map(j => (j.oc ?? "").trim()).filter(Boolean));

    // Desglose por rango
    const rango31_60 = lineas30.filter(j => jobDelayDays(j) <= 60);
    const rango61_90 = lineas30.filter(j => jobDelayDays(j) > 60 && jobDelayDays(j) <= 90);
    const rangoMas90 = lineas30.filter(j => jobDelayDays(j) > 90);

    // USD
    const usdTotal30 = lineas30.reduce((s, j) => s + valorPendienteUsdFn(j), 0);
    const usd31_60 = rango31_60.reduce((s, j) => s + valorPendienteUsdFn(j), 0);
    const usd61_90 = rango61_90.reduce((s, j) => s + valorPendienteUsdFn(j), 0);
    const usdMas90 = rangoMas90.reduce((s, j) => s + valorPendienteUsdFn(j), 0);

    // Sin seguimiento (>14 días hábiles sin gestión)
    const sinSeguimiento = lineas30.filter(j => {
      if (!j.fechaSeguimiento) return true;
      return diasHabiles(j.fechaSeguimiento, today) > 14;
    });

    // Top proveedores
    const provMap = new Map<string, { lineas: number; usd: number }>();
    for (const j of lineas30) {
      const p = (j.proveedor ?? "Sin prov.").trim();
      const c = provMap.get(p) ?? { lineas: 0, usd: 0 };
      c.lineas++; c.usd += valorPendienteUsdFn(j);
      provMap.set(p, c);
    }
    const topProveedores = [...provMap.entries()].sort((a, b) => b[1].lineas - a[1].lineas).slice(0, 5);

    return {
      totalLineas: lineas30.length,
      totalOC: ocs30.size,
      usdTotal: usdTotal30,
      rango31_60: rango31_60.length, usd31_60,
      rango61_90: rango61_90.length, usd61_90,
      rangoMas90: rangoMas90.length, usdMas90,
      sinSeguimiento: sinSeguimiento.length,
      topProveedores,
    };
  }, [jobs]);

  const exportarSemanal = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 7 días hábiles hacia atrás
    const FEST = new Set(["2025-01-01","2025-01-06","2025-03-24","2025-04-17","2025-04-18","2025-05-01","2025-06-02","2025-06-23","2025-06-30","2025-07-20","2025-08-07","2025-08-18","2025-10-13","2025-11-03","2025-11-17","2025-12-08","2025-12-25","2026-01-01","2026-01-12","2026-03-23","2026-04-02","2026-04-03","2026-05-01","2026-05-18","2026-06-08","2026-06-15","2026-06-29","2026-07-20","2026-08-07","2026-08-17","2026-10-12","2026-11-02","2026-11-16","2026-12-08","2026-12-25"]);
    let hace7 = new Date(today);
    let _dh = 0;
    while (_dh < 7) { hace7.setDate(hace7.getDate() - 1); const dy = hace7.getDay(); if (dy !== 0 && dy !== 6 && !FEST.has(hace7.toISOString().slice(0, 10))) _dh++; }
    const fechaGen = today.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const periodo = `${hace7.toLocaleDateString("es-CO")} al ${today.toLocaleDateString("es-CO")}`;

    const activas = jobs.filter(j => {
      if ((j.tipoCompra ?? "") === "Importación") return false;
      const bh = norm(j.estadoAdicional);
      if (bh !== "0" && bh !== "l") return false;
      const bf = norm(j.estadoEntrega);
      if (bf !== "sin entrega" && !bf.includes("parcial")) return false;
      return true;
    });

    const lineasSeg = activas;
    const ocsSeg = new Set(lineasSeg.map(j => (j.oc ?? "").trim()).filter(Boolean));

    let conSeg = 0;
    for (const j of lineasSeg) {
      if (j.fechaSeguimiento) {
        if (diasHabiles(j.fechaSeguimiento, today) <= 14) conSeg++;
      }
    }
    const pctANS = lineasSeg.length > 0 ? Math.round((conSeg / lineasSeg.length) * 100) : 0;

    const todasNoImpo = jobs.filter(j => {
      if ((j.tipoCompra ?? "") === "Importación") return false;
      const bh = norm(j.estadoAdicional);
      if (bh !== "0" && bh !== "l") return false;
      const bf = norm(j.estadoEntrega);
      if (bf === "borrado" || bf.startsWith("borr")) return false;
      return true;
    });
    const programadas = todasNoImpo.filter(j => {
      const fecha = j.fechaEntregaContractual || j.fechaCompromiso;
      if (!fecha) return false;
      const d = new Date(fecha);
      d.setHours(0, 0, 0, 0);
      return d >= hace7 && d <= today;
    });
    const cumplidas = programadas.filter(j => norm(j.estadoEntrega) === "entregado");

    const totalSegPrev = lineasSeg.reduce((s, j) => s + Number(j.cantSeguimientoPreventivo ?? 0), 0);
    const alertasPromedio = lineasSeg.length > 0 ? Math.round((totalSegPrev / lineasSeg.length) * 100) / 100 : 0;

    const backlog = lineasSeg.filter(j => jobDelayDays(j) > 0);
    const riesgos = lineasSeg.filter(j => {
      if (jobDelayDays(j) <= 30) return false;
      if (!j.fechaSeguimiento) return true;
      return diasHabiles(j.fechaSeguimiento, today) > 14;
    });

    const wb = XLSX.utils.book_new();

    // ═══ HOJA 1: RESUMEN EJECUTIVO ═══
    const h1: (string | number)[][] = [
      [], // fila vacía para espacio
      ["", "REPORTE SEMANAL DE GESTIÓN OPERATIVA"],
      ["", "LogiControl · PSA BDP"],
      [],
      ["", "Fecha de generación:", fechaGen],
      ["", "Período del reporte:", periodo],
      ["", "Generado por:", "Sistema LogiControl v1.2"],
      [],
      [], // separador
      ["", "═══════════════════════════════════════════════════════════════"],
      ["", "RESUMEN EJECUTIVO"],
      ["", "═══════════════════════════════════════════════════════════════"],
      [],
      ["", "INDICADOR", "RESULTADO", "OBSERVACIÓN"],
      ["", "─────────────────────────────", "──────────", "─────────────────────────────────────────"],
      ["", "1. OC sujetas a seguimiento", ocsSeg.size, `${lineasSeg.length} líneas pendientes de entrega`],
      ["", "2. Cumplimiento ANS (14 días hábiles)", `${pctANS}%`, `${conSeg} líneas con gestión reciente de ${lineasSeg.length} total`],
      ["", "3. Entregas programadas vs cumplidas", `${cumplidas.length} / ${programadas.length}`, `${programadas.length > 0 ? Math.round((cumplidas.length / programadas.length) * 100) : 0}% de cumplimiento en entregas de la semana`],
      ["", "4. Alertas emitidas (promedio)", alertasPromedio, `${totalSegPrev.toLocaleString()} seguimientos / ${lineasSeg.length} líneas`],
      ["", "5. Backlog operativo", backlog.length, `${new Set(backlog.map(j => j.oc).filter(Boolean)).size} OC atrasadas · USD ${Math.round(backlog.reduce((s, j) => s + valorPendienteUsdFn(j), 0)).toLocaleString()} en riesgo`],
      ["", "6. Riesgos críticos", riesgos.length, `USD ${Math.round(riesgos.reduce((s, j) => s + valorPendienteUsdFn(j), 0)).toLocaleString()} · Líneas >30 días sin gestión`],
      [],
      ["", "═══════════════════════════════════════════════════════════════"],
      ["", "ANÁLISIS DE CUMPLIMIENTO"],
      ["", "═══════════════════════════════════════════════════════════════"],
      [],
      ["", "Nivel de servicio (ANS):", pctANS >= 80 ? "ÓPTIMO ✓" : pctANS >= 60 ? "EN ALERTA ⚠" : "CRÍTICO ✗"],
      ["", "Entregas a tiempo:", programadas.length > 0 ? `${Math.round((cumplidas.length / programadas.length) * 100)}%` : "N/A"],
      ["", "Backlog pendiente:", `${backlog.length} líneas por USD ${Math.round(backlog.reduce((s, j) => s + valorPendienteUsdFn(j), 0)).toLocaleString()}`],
      [],
      ["", "NOTA: Todos los cálculos de días son en días hábiles (lunes a viernes, excluyendo festivos Colombia)."],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(h1);
    ws1["!cols"] = [{ wch: 3 }, { wch: 42 }, { wch: 18 }, { wch: 55 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Resumen Ejecutivo");

    // ═══ HOJA 2: BACKLOG OPERATIVO ═══
    const h2: (string | number)[][] = [
      [],
      ["", "BACKLOG OPERATIVO — LÍNEAS ATRASADAS SIN ENTREGAR"],
      ["", `Total: ${backlog.length} líneas · USD ${Math.round(backlog.reduce((s, j) => s + valorPendienteUsdFn(j), 0)).toLocaleString()}`],
      [],
      ["", "N°", "OC", "POS", "PROVEEDOR", "MATERIAL", "QTY PEND.", "DÍAS ATRASO", "USD PENDIENTE", "RESPONSABLE", "GERENCIA", "F. COMPROMISO"],
    ];
    backlog.sort((a, b) => jobDelayDays(b) - jobDelayDays(a)).slice(0, 500).forEach((j, i) => {
      h2.push(["", i + 1, j.oc ?? "", j.posicion ?? "", j.proveedor ?? "", (j.material ?? "").slice(0, 40),
        Math.max(0, Number(j.qty ?? 0) - Number(j.qtyEntregada ?? 0)),
        jobDelayDays(j), Math.round(valorPendienteUsdFn(j)),
        j.responsable ?? "", j.gerencia ?? "", j.fechaCompromiso ?? j.fechaEntregaContractual ?? ""]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(h2);
    ws2["!cols"] = [{ wch: 3 }, { wch: 4 }, { wch: 14 }, { wch: 5 }, { wch: 25 }, { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Backlog Operativo");

    // ═══ HOJA 3: RIESGOS CRÍTICOS ═══
    const h3: (string | number)[][] = [
      [],
      ["", "RIESGOS CRÍTICOS — PLANES DE ACCIÓN REQUERIDOS"],
      ["", `${riesgos.length} líneas con >30 días de incumplimiento y sin gestión reciente`],
      [],
      ["", "N°", "OC", "POS", "PROVEEDOR", "MATERIAL", "DÍAS ATRASO", "ÚLTIMA GESTIÓN", "DÍAS SIN GESTIÓN", "USD PENDIENTE", "RESPONSABLE"],
    ];
    riesgos.sort((a, b) => jobDelayDays(b) - jobDelayDays(a)).slice(0, 200).forEach((j, i) => {
      const diasSinG = j.fechaSeguimiento ? diasHabiles(j.fechaSeguimiento, today) : null;
      h3.push(["", i + 1, j.oc ?? "", j.posicion ?? "", j.proveedor ?? "", (j.material ?? "").slice(0, 40),
        jobDelayDays(j), j.fechaSeguimiento ?? "SIN REGISTRO",
        diasSinG !== null ? diasSinG : "N/A",
        Math.round(valorPendienteUsdFn(j)), j.responsable ?? ""]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(h3);
    ws3["!cols"] = [{ wch: 3 }, { wch: 4 }, { wch: 14 }, { wch: 5 }, { wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Riesgos Críticos");

    // ═══ HOJA 4: ENTREGAS PROGRAMADAS ═══
    const h4: (string | number)[][] = [
      [],
      ["", "ENTREGAS PROGRAMADAS EN LA SEMANA"],
      ["", `${programadas.length} programadas · ${cumplidas.length} cumplidas · ${programadas.length > 0 ? Math.round((cumplidas.length / programadas.length) * 100) : 0}% cumplimiento`],
      [],
      ["", "N°", "OC", "POS", "PROVEEDOR", "MATERIAL", "F. COMPROMISO", "ESTADO", "QTY", "ENTREGADA", "CUMPLIDA", "R", "BY", "AR", "AK", "BV", "DÍAS BK", "DÍAS BV−AR", "CLASIF A", "CLASIF B"],
    ];
    programadas.forEach((j, i) => {
      const dBvAr = diasBvMenosAr(j);
      h4.push(["", i + 1, j.oc ?? "", j.posicion ?? "", j.proveedor ?? "", (j.material ?? "").slice(0, 40),
        j.fechaCompromiso ?? j.fechaEntregaContractual ?? "",
        lineStatus(j), Number(j.qty ?? 0), Number(j.qtyEntregada ?? 0),
        lineStatus(j) === "Entregado" ? "SÍ ✓" : "NO ✗",
        j.responsable ?? "", j.categoriaSeguimiento ?? "",
        j.fechaEntregaContractual ?? "", j.fechaAceptacion ?? "", j.fechaRecepcion ?? "",
        Number(j.diasIncumplimiento ?? 0),
        dBvAr === null ? "—" : dBvAr,
        clasifALabel(j), clasifBLabel(j)]);
    });
    const ws4 = XLSX.utils.aoa_to_sheet(h4);
    ws4["!cols"] = [{ wch: 3 }, { wch: 4 }, { wch: 14 }, { wch: 5 }, { wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 9 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws4, "Entregas Programadas");

    XLSX.writeFile(wb, `Reporte_Semanal_LogiControl_${today.toISOString().slice(0, 10)}.xlsx`);
    toast.success("Reporte semanal gerencial exportado");
  };

  const exportar30Dias = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activas30 = jobs.filter(j => {
      if ((j.tipoCompra ?? "") === "Importación") return false;
      const bh = norm(j.estadoAdicional);
      if (bh !== "0" && bh !== "l") return false;
      const bf = norm(j.estadoEntrega);
      if (bf !== "sin entrega" && !bf.includes("parcial")) return false;
      return true;
    });

    const lineas30 = activas30.filter(j => jobDelayDays(j) > 30).sort((a, b) => jobDelayDays(b) - jobDelayDays(a));

    if (lineas30.length === 0) { toast.error("No hay líneas con >30 días hábiles de incumplimiento"); return; }

    const wb = XLSX.utils.book_new();

    // Hoja 1: Resumen
    const resumen: (string | number)[][] = [
      ["REPORTE DE INCUMPLIMIENTO >30 DÍAS HÁBILES"],
      ["LogiControl · PSA BDP"],
      [],
      ["Fecha de generación", today.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })],
      ["Filtros aplicados", "BH=[0,L] · BF=[Sin entrega, Entrega Parcial] · Días hábiles >30"],
      [],
      ["INDICADOR", "VALOR", "DETALLE"],
      ["Total líneas >30 días", lineas30.length, `${new Set(lineas30.map(j => j.oc).filter(Boolean)).size} OC`],
      ["Rango 31-60 días", lineas30.filter(j => jobDelayDays(j) <= 60).length, `USD ${Math.round(lineas30.filter(j => jobDelayDays(j) <= 60).reduce((s, j) => s + valorPendienteUsdFn(j), 0)).toLocaleString()}`],
      ["Rango 61-90 días", lineas30.filter(j => jobDelayDays(j) > 60 && jobDelayDays(j) <= 90).length, `USD ${Math.round(lineas30.filter(j => jobDelayDays(j) > 60 && jobDelayDays(j) <= 90).reduce((s, j) => s + valorPendienteUsdFn(j), 0)).toLocaleString()}`],
      ["Rango >90 días", lineas30.filter(j => jobDelayDays(j) > 90).length, `USD ${Math.round(lineas30.filter(j => jobDelayDays(j) > 90).reduce((s, j) => s + valorPendienteUsdFn(j), 0)).toLocaleString()}`],
      ["USD Total en riesgo", "", `USD ${Math.round(lineas30.reduce((s, j) => s + valorPendienteUsdFn(j), 0)).toLocaleString()}`],
      ["Sin seguimiento (>14d)", lineas30.filter(j => !j.fechaSeguimiento || diasHabiles(j.fechaSeguimiento, today) > 14).length, "Líneas sin gestión reciente"],
      [],
      ["NOTA: Días calculados en días hábiles (lunes a viernes, excluyendo festivos Colombia)"],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(resumen);
    ws1["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Resumen");

    // Hoja 2: Detalle completo
    const detalle: (string | number)[][] = [
      ["DETALLE DE LÍNEAS CON >30 DÍAS HÁBILES DE INCUMPLIMIENTO"],
      [],
      ["#", "OC", "POS", "PROVEEDOR", "MATERIAL", "DÍAS HÁBILES", "F. COMPROMISO", "ÚLT. SEGUIMIENTO", "DÍAS SIN GESTIÓN", "USD PENDIENTE", "RESPONSABLE", "GERENCIA", "CAMPO"],
    ];
    lineas30.forEach((j, i) => {
      const diasSinG = j.fechaSeguimiento ? diasHabiles(j.fechaSeguimiento, today) : null;
      detalle.push([
        i + 1, j.oc ?? "", j.posicion ?? "", j.proveedor ?? "", (j.material ?? "").slice(0, 40),
        jobDelayDays(j), j.fechaCompromiso ?? j.fechaEntregaContractual ?? "",
        j.fechaSeguimiento ?? "SIN REGISTRO", diasSinG !== null ? diasSinG : "N/A",
        Math.round(valorPendienteUsdFn(j)), j.responsable ?? "", j.gerencia ?? "", j.campo ?? "",
      ]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(detalle);
    ws2["!cols"] = [{ wch: 4 }, { wch: 14 }, { wch: 5 }, { wch: 24 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 15 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Detalle Incumplimiento");

    XLSX.writeFile(wb, `Reporte_Incumplimiento_30dias_${today.toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Reporte >30 días exportado: ${lineas30.length} líneas`);
  };

  const reportes = [
    {
      name: "Reporte operativo",
      desc: "Estado actual de todas las operaciones",
      run: () => download(jobs, "reporte-operativo"),
    },
    {
      name: "Reporte clientes",
      desc: "Actividad agrupada por cliente",
      run: () => download([...jobs].sort((a, b) => a.cliente.localeCompare(b.cliente)), "reporte-clientes"),
    },
    {
      name: "Reporte de demoras",
      desc: "Jobs con SLA vencido o en demora",
      run: () => download(jobs.filter((j) => slaStatus(j) === "Vencido" || j.status === "Demorado"), "reporte-demoras"),
    },
    {
      name: "Reporte de facturación",
      desc: "Pendientes y emitidas",
      run: () => download(jobs.filter((j) => j.factura || j.status === "Entregado"), "reporte-facturacion"),
    },
    {
      name: "Reporte de proyecciones",
      desc: "ETAs próximas sin arribo",
      run: () => {
        const today = new Date().toISOString().slice(0, 10);
        download(jobs.filter((j) => !j.ata && j.eta >= today), "reporte-proyecciones");
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Reportes</h1>
        <p className="text-sm text-muted-foreground">Genera y exporta reportes operativos en Excel.</p>
      </div>

      {/* ═══ REPORTE SEMANAL ═══ */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Reporte Semanal de Gestión</h2>
            <p className="text-xs text-muted-foreground">Últimos 7 días · Indicadores clave de seguimiento</p>
          </div>
          <button onClick={() => exportarSemanal()} className="inline-flex items-center gap-1.5 px-4 h-9 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition">
            <Download className="h-3.5 w-3.5" /> Exportar Semanal
          </button>
        </div>

        {/* KPIs del reporte semanal */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiReport icon={FileText} label="OC en seguimiento" value={semanal.totalOCSeguimiento} sub={`${semanal.totalLineasSeguimiento} líneas`} color="#6366f1" />
          <KpiReport icon={CheckCircle2} label="Cumplimiento ANS" value={`${semanal.pctCumplimientoANS}%`} sub={`${semanal.conSeguimiento} gestionadas`} color={semanal.pctCumplimientoANS >= 80 ? "#10b981" : semanal.pctCumplimientoANS >= 60 ? "#f59e0b" : "#ef4444"} />
          <KpiReport icon={TrendingUp} label="Entregas programadas" value={semanal.totalProgramadas} sub={`${semanal.totalCumplidas} cumplidas`} color="#0ea5e9" />
          <KpiReport icon={AlertTriangle} label="Alertas emitidas (prom)" value={semanal.alertasEmitidas} sub={`${semanal.totalSeguimientosPreventivos.toLocaleString()} total / ${semanal.totalLineasAlertas} líneas`} color="#f59e0b" />
          <KpiReport icon={Clock} label="Backlog operativo" value={semanal.backlogCount} sub={`${semanal.backlogOCs} OC · ${fmtMoney(semanal.backlogUsd, "USD")}`} color="#ef4444" />
          <KpiReport icon={AlertTriangle} label="Riesgos críticos" value={semanal.totalRiesgosCriticos} sub={fmtMoney(semanal.usdRiesgo, "USD")} color="#991b1b" />
        </div>

        {/* Notas: distinción entre Cumplimiento ANS y Cumplidas */}
        <div className="text-[11px] text-muted-foreground space-y-1 border-l-2 border-border pl-3">
          <div><span className="font-semibold text-foreground">Cumplimiento ANS:</span> % de líneas pendientes con un registro de seguimiento (fecha de seguimiento) en los últimos 14 días hábiles. Mide la <em>frescura de la gestión</em>.</div>
          <div><span className="font-semibold text-foreground">Cumplidas:</span> % de las entregas programadas esta semana (por fecha contractual) cuyo estado es ENTREGADO. Mide el <em>cumplimiento de entrega de la semana</em>. No es comparable con el ANS.</div>
        </div>

        {/* Detalle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-muted/20 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Entregas programadas vs estado actual (F. Contractual últimos 7 días hábiles)</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Cumplidas</span>
                    <span>{semanal.totalProgramadas > 0 ? Math.round((semanal.totalCumplidas / semanal.totalProgramadas) * 100) : 0}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${semanal.totalProgramadas > 0 ? (semanal.totalCumplidas / semanal.totalProgramadas) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-foreground">{semanal.totalCumplidas}/{semanal.totalProgramadas}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                <div className="text-center">
                  <div className="text-lg font-bold text-success">{semanal.totalCumplidas}</div>
                  <div className="text-[10px] text-muted-foreground">Entregadas</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-info">{semanal.totalParciales}</div>
                  <div className="text-[10px] text-muted-foreground">Parciales</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-warning">{semanal.totalPendientesSem}</div>
                  <div className="text-[10px] text-muted-foreground">Sin entrega</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-muted/20 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Backlog y riesgos</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Líneas atrasadas sin entregar</span>
                <span className="text-sm font-bold text-destructive">{semanal.backlogCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Líneas activas a tiempo <span className="text-[10px] text-muted-foreground/70">(base deduplicada)</span></span>
                <span className="text-sm font-bold text-success">{weeklyBlocks.activas.aTiempo.lineas}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">USD en riesgo (backlog)</span>
                <span className="text-sm font-bold text-warning">{fmtMoney(semanal.backlogUsd, "USD")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Planes acción abiertos (riesgos críticos)</span>
                <span className="text-sm font-bold" style={{ color: "#991b1b" }}>{semanal.totalRiesgosCriticos}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CUMPLIMIENTO DE ENTREGAS — BLOQUES NUEVOS ═══ */}
      <ReportWeeklyBlocks result={weeklyBlocks} />

      {/* ═══ REPORTE >30 DÍAS HÁBILES ═══ */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Incumplimiento &gt;30 Días Hábiles</h2>
            <p className="text-xs text-muted-foreground">Líneas activas (BH=0,L + BF=Sin entrega/Parcial) con más de 30 días hábiles de atraso</p>
          </div>
          <button onClick={() => exportar30Dias()} className="inline-flex items-center gap-1.5 px-4 h-9 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition">
            <Download className="h-3.5 w-3.5" /> Exportar &gt;30 días
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiReport icon={AlertTriangle} label="Total líneas >30d" value={reporte30.totalLineas} sub={`${reporte30.totalOC} OC`} color="#ef4444" />
          <KpiReport icon={Clock} label="31-60 días" value={reporte30.rango31_60} sub={fmtMoney(reporte30.usd31_60, "USD")} color="#f59e0b" />
          <KpiReport icon={Clock} label="61-90 días" value={reporte30.rango61_90} sub={fmtMoney(reporte30.usd61_90, "USD")} color="#f97316" />
          <KpiReport icon={AlertTriangle} label=">90 días" value={reporte30.rangoMas90} sub={fmtMoney(reporte30.usdMas90, "USD")} color="#991b1b" />
          <KpiReport icon={FileText} label="USD en riesgo" value={fmtMoney(reporte30.usdTotal, "USD")} color="#ef4444" />
          <KpiReport icon={Clock} label="Sin seguimiento" value={reporte30.sinSeguimiento} sub=">14 días sin gestión" color="#dc2626" />
        </div>

        {/* Top proveedores */}
        {reporte30.topProveedores.length > 0 && (
          <div className="bg-muted/20 border border-border rounded-lg p-4">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">Top proveedores con mayor incumplimiento</h4>
            <div className="space-y-2">
              {reporte30.topProveedores.map(([prov, data]) => (
                <div key={prov} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{prov}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{data.lineas} líneas</span>
                    <span className="text-xs font-semibold text-destructive">{fmtMoney(data.usd, "USD")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ OTROS REPORTES ═══ */}
      <h3 className="text-lg font-semibold text-foreground">Exportar reportes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportes.map((r) => (
          <div key={r.name} className="bg-card border border-border rounded-lg p-5 hover:border-ring transition flex flex-col">
            <div className="h-10 w-10 rounded-md bg-accent flex items-center justify-center">
              <FileText className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">{r.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 flex-1">{r.desc}</p>
            <div className="mt-4">
              <button onClick={r.run}
                className="inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition">
                <Download className="h-3.5 w-3.5" /> Exportar Excel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function KpiReport({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-background border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function download(jobs: ReturnType<typeof useJobsStore.getState>["jobs"], baseName: string) {
  if (jobs.length === 0) { toast.error("No hay datos para este reporte"); return; }
  exportJobsToExcel(jobs, `${baseName}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast.success(`${jobs.length} registros exportados`);
}
