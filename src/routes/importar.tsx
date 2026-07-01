import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, RotateCcw, Trash2, ArrowRight, Ship } from "lucide-react";
import { parseRowsToJobs, type ParseResult } from "@/lib/excel-import";
import { useJobsStore } from "@/lib/jobs-store";
import { statusColors } from "@/lib/jobs-data";
import { fmtMoney, valorComprado, valorCompradoUsd, valorPendienteCopFn, valorPendienteUsdFn } from "@/lib/operational";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useMyRole } from "@/lib/use-role";

export const Route = createFileRoute("/importar")({
  component: () => (
    <AppShell>
      <Importar />
    </AppShell>
  ),
});

// DATA FINAL es la hoja oficial. El resto se mantiene como respaldo
// para no romper compatibilidad, pero los KPIs del dashboard salen de ahí.
const DATA_FINAL_ALIASES = ["data final", "datafinal", "data_final"];
const PREFERRED_SHEETS = ["Data final", "DATA FINAL", "Data Final", "IMPORTACIONES", "Carga Actualiza", "Operaciones"];

function Importar() {
  const { role, loading: rl } = useMyRole();
  if (rl) return <div className="text-sm text-muted-foreground p-6">Cargando...</div>;
  if (role === "viewer") return <Navigate to="/" />;

  return <ImportarContent />;
}

function ImportarContent() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const addJobs = useJobsStore((s) => s.addJobs);
  const resetToDemo = useJobsStore((s) => s.resetToDemo);
  const clearAll = useJobsStore((s) => s.clearAll);
  const lastImport = useJobsStore((s) => s.lastImport);
  const totalJobs = useJobsStore((s) => s.jobs.length);

  const parseSheet = (wb: XLSX.WorkBook, name: string) => {
    const sheet = wb.Sheets[name];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }) as unknown[][];
    const r = parseRowsToJobs(rows);
    setResult(r);
    if (r.jobs.length === 0) toast.error(`Sin operaciones detectadas en "${name}"`);
    else toast.success(`${r.jobs.length} operaciones detectadas en "${name}"`);
  };

  const handleFile = async (file: File) => {
    // Validación de seguridad: tamaño máximo 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("El archivo excede el tamaño máximo permitido (50MB)");
      return;
    }
    // Validación de tipo de archivo
    const validTypes = [".xlsx", ".xls", ".csv"];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!validTypes.includes(ext)) {
      toast.error("Tipo de archivo no permitido. Use .xlsx, .xls o .csv");
      return;
    }
    try {
      setFileName(file.name);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      const dataFinal = wb.SheetNames.find((n) => DATA_FINAL_ALIASES.includes(n.toLowerCase().trim()));
      const preferred = dataFinal ?? wb.SheetNames.find((n) =>
        PREFERRED_SHEETS.some((p) => p.toLowerCase().trim() === n.toLowerCase().trim()),
      );
      const first = preferred ?? wb.SheetNames[0];
      setSelectedSheet(first);
      parseSheet(wb, first);
      if (!dataFinal) {
        toast.warning('No se encontró la hoja "DATA FINAL". Verifique el archivo cargado: los KPIs del dashboard usan esa hoja como fuente oficial.');
      }
    } catch (err) {
      toast.error("Error al leer el archivo Excel");
      console.error(err);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const changeSheet = (name: string) => {
    setSelectedSheet(name);
    if (workbook) parseSheet(workbook, name);
  };

  const confirmImport = async () => {
    if (!result) return;
    // Si la hoja seleccionada es "Importaciones", marcar todas las líneas como importación
    const isImpoSheet = selectedSheet.toLowerCase().trim() === "importaciones";
    const jobsToImport = isImpoSheet
      ? result.jobs.map(j => ({ ...j, tipoCompra: "Importación" as const }))
      : result.jobs;
    toast.info(`Subiendo ${jobsToImport.length} registros a la nube...`);
    const { insertedCount, errors } = await addJobs(jobsToImport, fileName);
    if (insertedCount > 0 && errors.length === 0) {
      toast.success(`${insertedCount} registros importados correctamente${isImpoSheet ? " (marcados como Importación)" : ""}`);
    } else if (insertedCount > 0) {
      toast.success(`${insertedCount} registros importados correctamente`);
      toast.error(`Hubo ${errors.length} error(es) al insertar algunos registros.`);
    } else {
      toast.error(`No se agregaron registros. ${errors.length ? errors[0] : "Revisa conexión/permiso o el formato del archivo."}`);
    }
    if (insertedCount > 0) {
      setResult(null);
      setFileName("");
      setWorkbook(null);
      setSheetNames([]);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const headers = ["No.", "INCOTERMS", "PROVEEDOR", "# OC", "POSICIÓN", "CÓDIGO SAP", "TEXTO BREVE DEL MATERIAL", "U/M", "QTY", "FECHA DE ENTREGA CONTRACTUAL", "DESTINO", "MODALIDAD IMPO", "LUGAR DE LLEGADA", "ETD (origen)", "ETA (puerto)", "ETA (campo)", "QTY ENTREGADA", "QTY PENDIENTE", "OBSERVACIONES", "DO", "INVOICE", "ASUNTO CORREO"];
    const sample = [
      [1, "CIP", "PROVEEDOR DEMO S.A.", "4500001234", "10", "401416", "VÁLVULA MECÁNICA 2\"", "UN", 10, "2026-07-15", "CAMPO NORTE", "AÉREO", "BOG-AEROPUERTO", "2026-06-10", "2026-06-20", "2026-06-28", 0, 10, "Pendiente DO", "DO-001", "FAC-9001", "Seguimiento OC 4500001234"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "IMPORTACIONES");
    XLSX.writeFile(wb, "plantilla-seguimiento.xlsx");
    toast.success("Plantilla descargada");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Importar desde Excel</h1>
          <p className="text-sm text-muted-foreground">
            Sube tu archivo de seguimiento. {totalJobs} registros en el sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={downloadTemplate} className="inline-flex items-center gap-2 px-3 h-9 text-sm rounded-md border border-border bg-card hover:bg-muted">
            <Download className="h-4 w-4" /> Descargar plantilla
          </button>
          <button onClick={() => { resetToDemo(); setResult(null); toast.success("Base limpia"); }} className="inline-flex items-center gap-2 px-3 h-9 text-sm rounded-md border border-border bg-card hover:bg-muted">
            <RotateCcw className="h-4 w-4" /> Limpiar y reiniciar
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="inline-flex items-center gap-2 px-3 h-9 text-sm rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" /> Vaciar
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Borrar todos los registros?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán {totalJobs} registros del sistema. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { clearAll(); toast.success("Base de datos vaciada"); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Sí, borrar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {lastImport && (
        <div className="bg-success/10 border border-success/30 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-medium text-foreground">Última importación: {lastImport.fileName}</div>
            <div className="text-muted-foreground text-xs mt-0.5">
              {lastImport.count} registros agregados · {new Date(lastImport.date).toLocaleString("es")}
            </div>
          </div>
          <Link to="/" className="text-xs text-info hover:underline inline-flex items-center gap-1">
            Ver dashboard <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={`bg-card border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
          dragOver ? "border-info bg-info/5" : "border-border hover:border-muted-foreground/50"
        }`}
      >
        <div className="h-14 w-14 rounded-full bg-accent mx-auto flex items-center justify-center">
          <Upload className="h-7 w-7 text-accent-foreground" />
        </div>
        <h3 className="mt-4 font-semibold text-foreground">Arrastra tu archivo Excel aquí</h3>
        <p className="text-sm text-muted-foreground mt-1">o haz click para seleccionar (.xlsx, .xls, .csv) · hojas soportadas: DATA FINAL, IMPORTACIONES, Carga Actualiza</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {sheetNames.length > 1 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Hojas detectadas — selecciona la que quieres importar</div>
          <div className="flex gap-1.5 flex-wrap">
            {sheetNames.map((n) => (
              <button
                key={n}
                onClick={() => changeSheet(n)}
                className={`px-3 h-8 rounded-md text-xs font-medium border transition ${selectedSheet === n ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}
              >
                {n}
              </button>
            ))}
          </div>
          {selectedSheet.toLowerCase().trim() === "importaciones" && (
            <div className="mt-3 flex items-center gap-2 text-xs text-info bg-info/10 border border-info/20 rounded-md px-3 py-2">
              <Ship className="h-4 w-4" />
              Las líneas de esta hoja se marcarán automáticamente como <strong>Importación</strong> y aparecerán en el módulo Importaciones.
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="h-5 w-5 text-info" />
              <div className="flex-1">
                <div className="font-semibold text-foreground">{fileName} <span className="text-xs text-muted-foreground">· hoja: {selectedSheet}</span></div>
                <div className="text-xs text-muted-foreground">
                  {result.totalRows} filas leídas · {result.jobs.length} registros válidos · {result.errors.length} errores
                </div>
              </div>
              <button
                onClick={confirmImport}
                disabled={result.jobs.length === 0}
                className="px-4 h-9 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar e importar {result.jobs.length}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Campos detectados ({result.mappedFields.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.mappedFields.map((f) => (
                    <span key={f} className="px-2 py-0.5 rounded-full text-xs bg-success/15 text-success border border-success/30">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              {result.unmappedHeaders.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Columnas no mapeadas ({result.unmappedHeaders.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.unmappedHeaders.map((h, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border">
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4 bg-destructive/10 border border-destructive/30 rounded-md p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" /> {result.errors.length} filas con problemas
                </div>
                <ul className="mt-2 text-xs text-destructive/80 space-y-0.5 max-h-32 overflow-auto">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>Fila {e.row}: {e.message}</li>
                  ))}
                  {result.errors.length > 10 && <li>… y {result.errors.length - 10} más</li>}
                </ul>
              </div>
            )}
          </div>

          {result.jobs.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border text-sm font-semibold text-foreground">
                Vista previa (primeras 8 filas)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                    <tr>
                      <th className="px-3 py-2 text-left">OC</th>
                      <th className="px-3 py-2 text-left">Proveedor</th>
                      <th className="px-3 py-2 text-left">Material</th>
                      <th className="px-3 py-2 text-left">Estado</th>
                      <th className="px-3 py-2 text-right">QTY</th>
                      <th className="px-3 py-2 text-right">Entreg.</th>
                      <th className="px-3 py-2 text-right">Compra USD</th>
                      <th className="px-3 py-2 text-right">Pend. USD</th>
                      <th className="px-3 py-2 text-right">Compra COP</th>
                      <th className="px-3 py-2 text-right">Pend. COP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.jobs.slice(0, 8).map((j) => (
                      <tr key={j.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{j.oc ?? j.bdpJob}</td>
                        <td className="px-3 py-2">{j.proveedor ?? j.cliente}</td>
                        <td className="px-3 py-2 text-xs">{j.material ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs ${statusColors[j.status]}`}>{j.status}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{j.qty ?? 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{j.qtyEntregada ?? 0}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtMoney(valorCompradoUsd(j), "USD")}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtMoney(valorPendienteUsdFn(j), "USD")}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtMoney(valorComprado(j), "COP")}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs">{fmtMoney(valorPendienteCopFn(j), "COP")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
