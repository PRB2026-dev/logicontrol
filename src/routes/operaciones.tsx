import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { statusColors, priorityColors, type JobStatus, type Job, type Priority } from "@/lib/jobs-data";
import {
  computeAging,
  slaStatus,
  slaColors,
  delayDays,
  delayBucket,
  delayBucketColors,
  criticality,
  criticalityColors,
  urgencyScore,
  compliance,
  pendientePct,
  lineStatus,
  jobDelayDays,
  deriveTipoCompra,
} from "@/lib/operational";
import { jobLlave, jobMoneda, fmtMoney, valorPendienteUsdFn, valorPendienteCopFn, valorCompradoUsd } from "@/lib/operational";
import { useMemo, useState, Fragment } from "react";
import {
  Download, Plus, Search, ChevronRight, Pencil, Trash2,
  ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronLeft,
  Settings2, X, AlertTriangle, Activity, Flame, Package,
  CheckCircle2, Clock, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { JobFormDialog } from "@/components/job-form-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportJobsToExcel } from "@/lib/export-excel";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  flexRender, getCoreRowModel, getExpandedRowModel, getFacetedUniqueValues,
  getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type ColumnFiltersState, type SortingState, type ExpandedState, type VisibilityState,
} from "@tanstack/react-table";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/operaciones")({
  validateSearch: (s) => searchSchema.parse(s),
  component: () => (
    <AppShell>
      <Operaciones />
    </AppShell>
  ),
});

const allStatuses: JobStatus[] = [
  "Booking", "En tránsito", "Arribado", "Aduana", "Entregado", "Facturado", "Cerrado", "Demorado",
];
const allPriorities: Priority[] = ["Baja", "Media", "Alta", "Crítica"];
const allLineStatuses = ["Entregado", "Parcial", "Pendiente", "Vencido", "Próximo a Vencer"] as const;
const allTipoCompra = ["Nacional", "Importación"] as const;

function Operaciones() {
  const jobs = useJobsStore((s) => s.jobs);
  const deleteJob = useJobsStore((s) => s.deleteJob);
  const { q: qParam } = Route.useSearch();

  const [globalFilter, setGlobalFilter] = useState(qParam ?? "");
  const [sorting, setSorting] = useState<SortingState>([{ id: "urgency", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    codigoSap: false,
    incoterms: false,
    centro: false,
    moneda: false,
    valorPendCop: false,
  });
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [toDelete, setToDelete] = useState<Job | null>(null);

  // Filtros adicionales
  const [fGerencia, setFGerencia] = useState("");
  const [fCampo, setFCampo] = useState("");
  const [fTipoCompra, setFTipoCompra] = useState("");
  const [fProveedor, setFProveedor] = useState("");

  // Opciones de filtro dinámicas
  const gerencias = useMemo(() => [...new Set(jobs.map(j => (j.gerencia ?? "").trim()).filter(Boolean))].sort(), [jobs]);
  const campos = useMemo(() => [...new Set(jobs.map(j => (j.campo ?? "").trim()).filter(Boolean))].sort(), [jobs]);
  const proveedores = useMemo(() => [...new Set(jobs.map(j => (j.proveedor ?? "").trim()).filter(Boolean))].sort(), [jobs]);

  // Aplicar filtros adicionales antes de la tabla
  const filteredByExtra = useMemo(() => {
    let result = jobs;
    if (fGerencia) result = result.filter(j => (j.gerencia ?? "").trim() === fGerencia);
    if (fCampo) result = result.filter(j => (j.campo ?? "").trim() === fCampo);
    if (fTipoCompra) result = result.filter(j => deriveTipoCompra(j) === fTipoCompra);
    if (fProveedor) result = result.filter(j => (j.proveedor ?? "").trim() === fProveedor);
    return result;
  }, [jobs, fGerencia, fCampo, fTipoCompra, fProveedor]);

  // KPIs sobre las líneas filtradas
  const kpis = useMemo(() => {
    const total = filteredByExtra.length;
    let entregadas = 0;
    let parciales = 0;
    let pendientes = 0;
    let vencidas = 0;
    let usdPendiente = 0;
    let usdTotal = 0;
    for (const j of filteredByExtra) {
      const ls = lineStatus(j);
      if (ls === "Entregado") entregadas++;
      else if (ls === "Parcial") parciales++;
      else if (ls === "Vencido") vencidas++;
      else pendientes++;
      usdPendiente += valorPendienteUsdFn(j);
      usdTotal += valorCompradoUsd(j);
    }
    return { total, entregadas, parciales, pendientes, vencidas, usdPendiente, usdTotal };
  }, [filteredByExtra]);

  const columns = useMemo<ColumnDef<Job>[]>(
    () => [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }) => (
          <button onClick={() => row.toggleExpanded()}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted" aria-label="Expandir">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${row.getIsExpanded() ? "rotate-90" : ""}`} />
          </button>
        ),
        size: 32,
        enableSorting: false,
      },
      {
        id: "llave",
        header: "LLAVE",
        accessorFn: (j) => jobLlave(j),
        cell: ({ row }) => (
          <Link to="/operaciones/$jobId" params={{ jobId: row.original.id } as any}
            className="font-mono text-xs font-semibold text-info hover:underline" title="Ver detalle de la línea">
            {jobLlave(row.original)}
          </Link>
        ),
      },
      {
        accessorKey: "oc",
        header: "OC",
        cell: ({ row }) => (
          <span className="font-mono text-xs text-foreground">{row.original.oc || row.original.bdpJob || "—"}</span>
        ),
      },
      { accessorKey: "posicion", header: "Pos.", cell: ({ row }) => <span className="text-xs">{row.original.posicion || "—"}</span> },
      {
        accessorKey: "proveedor",
        header: "Proveedor",
        cell: ({ row }) => (
          <div className="max-w-[180px] truncate text-xs font-medium" title={row.original.proveedor || row.original.cliente}>
            {row.original.proveedor || row.original.cliente || "—"}
          </div>
        ),
      },
      { accessorKey: "codigoSap", header: "SAP" },
      {
        accessorKey: "material",
        header: "Material",
        cell: ({ row }) => (
          <div className="max-w-[200px] truncate text-xs text-muted-foreground" title={row.original.material ?? ""}>
            {row.original.material || "—"}
          </div>
        ),
      },
      {
        accessorKey: "qty",
        header: () => <div className="text-right">QTY</div>,
        cell: ({ row }) => (
          <div className="text-right tabular text-xs">
            {Number(row.original.qty ?? 0).toLocaleString("es-CO")}{" "}
            <span className="text-muted-foreground">{row.original.um ?? ""}</span>
          </div>
        ),
      },
      {
        id: "qtyEntregada",
        header: () => <div className="text-right">Entreg.</div>,
        accessorFn: (j) => Number(j.qtyEntregada ?? 0),
        cell: ({ row }) => (
          <div className="text-right tabular text-xs">
            {Number(row.original.qtyEntregada ?? 0).toLocaleString("es-CO")}
          </div>
        ),
      },
      {
        id: "pendiente",
        header: () => <div className="text-right">Pend.%</div>,
        accessorFn: (j) => pendientePct(j),
        cell: ({ row }) => {
          const pct = pendientePct(row.original);
          return (
            <div className="flex items-center gap-2 justify-end min-w-[100px]">
              <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${pct > 60 ? "bg-destructive" : pct > 25 ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[11px] tabular text-muted-foreground w-8 text-right">{pct}%</span>
            </div>
          );
        },
      },
      {
        id: "lineStatus",
        header: "Estado Línea",
        accessorFn: (j) => lineStatus(j),
        cell: ({ row }) => {
          const ls = lineStatus(row.original);
          const c = ls === "Entregado" ? "bg-success/15 text-success" :
            ls === "Parcial" ? "bg-info/15 text-info" :
            ls === "Vencido" ? "bg-destructive/15 text-destructive" :
            ls === "Próximo a Vencer" ? "bg-warning/15 text-warning" :
            "bg-muted text-muted-foreground";
          return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${c}`}>{ls}</span>;
        },
        filterFn: (row, _id, value: string[]) => !value?.length || value.includes(lineStatus(row.original)),
      },
      {
        id: "fechaCompromiso",
        header: "F. Compromiso",
        accessorFn: (j) => j.fechaCompromiso || j.fechaEntregaContractual || "",
        cell: ({ row }) => (
          <span className="text-xs tabular text-muted-foreground">
            {row.original.fechaCompromiso || row.original.fechaEntregaContractual || "—"}
          </span>
        ),
      },
      {
        id: "delay",
        header: () => <div className="text-right">Días Incumpl.</div>,
        accessorFn: (j) => jobDelayDays(j),
        cell: ({ row }) => {
          const d = jobDelayDays(row.original);
          const color = d > 90 ? "bg-[#991b1b]/15 text-[#991b1b]" :
            d > 30 ? "bg-destructive/15 text-destructive" :
            d > 10 ? "bg-warning/15 text-warning" :
            d > 0 ? "bg-warning/10 text-warning" :
            "bg-success/15 text-success";
          return (
            <div className="text-right">
              <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${color}`}>
                {d > 0 ? `+${d}d` : d === 0 ? "0d" : `${d}d`}
              </span>
            </div>
          );
        },
      },
      {
        id: "gerencia",
        header: "Gerencia",
        accessorFn: (j) => j.gerencia || "—",
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.gerencia || "—"}</span>,
      },
      {
        id: "campo",
        header: "Campo",
        accessorFn: (j) => j.campo || "—",
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.campo || "—"}</span>,
      },
      {
        accessorKey: "responsable",
        header: "Responsable",
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.responsable || "—"}</span>,
      },
      {
        id: "tipoCompra",
        header: "Tipo",
        accessorFn: (j) => deriveTipoCompra(j),
        cell: ({ row }) => {
          const t = deriveTipoCompra(row.original);
          return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${t === "Importación" ? "bg-info/15 text-info" : "bg-muted text-muted-foreground"}`}>{t}</span>;
        },
        filterFn: (row, _id, value: string[]) => !value?.length || value.includes(deriveTipoCompra(row.original)),
      },
      {
        id: "valorPendUsd",
        header: () => <div className="text-right">USD Pend.</div>,
        accessorFn: (j) => valorPendienteUsdFn(j),
        cell: ({ row }) => (
          <div className="text-right tabular text-xs font-medium">{fmtMoney(valorPendienteUsdFn(row.original), "USD")}</div>
        ),
      },
      {
        id: "valorPendCop",
        header: () => <div className="text-right">COP Pend.</div>,
        accessorFn: (j) => valorPendienteCopFn(j),
        cell: ({ row }) => {
          const v = valorPendienteCopFn(row.original);
          return <div className="text-right tabular text-xs text-muted-foreground">{v > 0 ? fmtMoney(v, "COP") : "—"}</div>;
        },
      },
      { accessorKey: "incoterms", header: "Incoterms" },
      { accessorKey: "centro", header: "Centro" },
      {
        id: "moneda",
        header: "Moneda",
        accessorFn: (j) => jobMoneda(j),
        cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{jobMoneda(row.original)}</span>,
      },
      {
        id: "sla",
        header: "SLA",
        accessorFn: (j) => slaStatus(j),
        cell: ({ row }) => {
          const s = slaStatus(row.original);
          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${slaColors[s]}`}>● {s}</span>;
        },
      },
      {
        id: "urgency",
        header: () => <div className="text-right">Urgencia</div>,
        accessorFn: (j) => urgencyScore(j),
        cell: ({ getValue }) => {
          const s = getValue<number>();
          const color = s >= 80 ? "bg-destructive" : s >= 55 ? "bg-warning" : s >= 30 ? "bg-info" : "bg-success";
          return (
            <div className="flex items-center gap-2 justify-end min-w-[100px]">
              <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${s}%` }} />
              </div>
              <span className="text-[11px] tabular w-7 text-right">{s}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "prioridad",
        header: "Prio.",
        cell: ({ row }) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${priorityColors[row.original.prioridad]}`}>
            {row.original.prioridad}
          </span>
        ),
        filterFn: (row, _id, value: string[]) => !value?.length || value.includes(row.original.prioridad),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors[row.original.status]}`}>
            {row.original.status}
          </span>
        ),
        filterFn: (row, _id, value: string[]) => !value?.length || value.includes(row.original.status),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Link to="/operaciones/$jobId" params={{ jobId: row.original.id } as any}
              className="inline-flex items-center px-2 h-7 rounded-md text-xs text-info hover:bg-info/10">
              Ver <ChevronRight className="h-3 w-3" />
            </Link>
            <button onClick={() => { setEditing(row.original); setFormOpen(true); }}
              className="h-7 w-7 rounded-md hover:bg-muted inline-flex items-center justify-center" title="Editar">
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => setToDelete(row.original)}
              className="h-7 w-7 rounded-md hover:bg-destructive/10 inline-flex items-center justify-center" title="Eliminar">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredByExtra,
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility, expanded },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getRowId: (r) => r.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: (row, _id, value) => {
      const v = String(value ?? "").toLowerCase();
      if (!v) return true;
      const j = row.original;
      return [
        jobLlave(j), j.oc, j.bdpJob, j.proveedor, j.cliente, j.material, j.codigoSap,
        j.posicion, j.responsable, j.centro, j.incoterms, j.invoice, j.doNum,
        j.gerencia, j.campo, j.comprador, j.solicitante, j.descripcionMaterial,
      ].filter(Boolean).some((x) => String(x).toLowerCase().includes(v));
    },
    initialState: { pagination: { pageSize: 50 } },
  });

  const filteredJobs = table.getFilteredRowModel().rows.map((r) => r.original);

  const handleExport = () => {
    if (filteredJobs.length === 0) { toast.error("No hay líneas para exportar"); return; }
    exportJobsToExcel(filteredJobs, `operaciones-lineas-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filteredJobs.length} líneas exportadas`);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteJob(toDelete.id);
    toast.success(`Línea ${jobLlave(toDelete)} eliminada`);
    setToDelete(null);
  };

  const statusFilter = (table.getColumn("status")?.getFilterValue() as string[]) ?? [];
  const priorityFilter = (table.getColumn("prioridad")?.getFilterValue() as string[]) ?? [];
  const lineStatusFilter = (table.getColumn("lineStatus")?.getFilterValue() as string[]) ?? [];

  const toggleArrayFilter = (colId: string, current: string[], value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    table.getColumn(colId)?.setFilterValue(next.length ? next : undefined);
  };

  const clearFilters = () => {
    setColumnFilters([]);
    setGlobalFilter("");
    setFGerencia("");
    setFCampo("");
    setFTipoCompra("");
    setFProveedor("");
  };

  const activeFilters = columnFilters.length + (globalFilter ? 1 : 0) +
    (fGerencia ? 1 : 0) + (fCampo ? 1 : 0) + (fTipoCompra ? 1 : 0) + (fProveedor ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Operaciones · Líneas</h1>
          <p className="text-sm text-muted-foreground">
            Control operativo por línea (OC + posición) — {filteredJobs.length} de {filteredByExtra.length} líneas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva línea
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        <KpiCard label="Total líneas" value={kpis.total} icon={<Package className="h-4 w-4" />} tone="info" />
        <KpiCard label="Entregadas" value={kpis.entregadas} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <KpiCard label="Parciales" value={kpis.parciales} icon={<Activity className="h-4 w-4" />} tone="primary" />
        <KpiCard label="Pendientes" value={kpis.pendientes} icon={<Clock className="h-4 w-4" />} tone="warning" />
        <KpiCard label="Vencidas" value={kpis.vencidas} icon={<AlertTriangle className="h-4 w-4" />} tone="destructive" />
        <KpiCard label="USD Pendiente" value={fmtMoney(kpis.usdPendiente, "USD")} icon={<Wallet className="h-4 w-4" />} tone="warning" />
        <KpiCard label="USD Total" value={fmtMoney(kpis.usdTotal, "USD")} icon={<Wallet className="h-4 w-4" />} tone="primary" />
      </div>

      {/* Toolbar */}
      <div className="surface-elevated rounded-xl border border-border">
        <div className="p-4 border-b border-border space-y-3">
          {/* Row 1: Search + column dropdowns */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Buscar LLAVE, OC, proveedor, material, responsable, gerencia, campo…"
                className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/40 border border-transparent text-sm focus:outline-none focus:border-ring focus:bg-background transition" />
            </div>
            <FilterDropdown label="Estado Línea" options={[...allLineStatuses]} selected={lineStatusFilter}
              onToggle={(v) => toggleArrayFilter("lineStatus", lineStatusFilter, v)} />
            <FilterDropdown label="Status" options={allStatuses} selected={statusFilter}
              onToggle={(v) => toggleArrayFilter("status", statusFilter, v)} />
            <FilterDropdown label="Prioridad" options={allPriorities} selected={priorityFilter}
              onToggle={(v) => toggleArrayFilter("prioridad", priorityFilter, v)} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2"><Settings2 className="h-4 w-4" /> Columnas</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
                <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table.getAllLeafColumns().filter((c) => c.getCanHide()).map((c) => (
                  <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)} className="capitalize text-xs">
                    {c.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Row 2: Additional filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <SelectFilter label="Gerencia" value={fGerencia} onChange={setFGerencia} options={gerencias} />
            <SelectFilter label="Campo" value={fCampo} onChange={setFCampo} options={campos} />
            <SelectFilter label="Tipo Compra" value={fTipoCompra} onChange={setFTipoCompra} options={[...allTipoCompra]} />
            <SelectFilter label="Proveedor" value={fProveedor} onChange={setFProveedor} options={proveedores} />
            {activeFilters > 0 && (
              <button onClick={clearFilters}
                className="inline-flex items-center gap-1 px-2 h-8 text-xs rounded-md text-destructive hover:bg-destructive/10">
                <X className="h-3 w-3" /> Limpiar ({activeFilters})
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground sticky top-0">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-border">
                  {hg.headers.map((h) => {
                    const canSort = h.column.getCanSort();
                    const sort = h.column.getIsSorted();
                    return (
                      <th key={h.id} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide whitespace-nowrap"
                        style={{ width: h.column.columnDef.size }}>
                        {h.isPlaceholder ? null : canSort ? (
                          <button onClick={h.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:text-foreground transition">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {sort === "asc" ? <ArrowUp className="h-3 w-3" /> :
                              sort === "desc" ? <ArrowDown className="h-3 w-3" /> :
                              <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </button>
                        ) : flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-border/60 hover:bg-muted/20 transition">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2 align-middle whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && <ExpandedRow job={row.original} colSpan={row.getVisibleCells().length} />}
                </Fragment>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr><td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  No se encontraron líneas con esos filtros.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-border flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())} ·{" "}
            {table.getFilteredRowModel().rows.length} líneas
          </div>
          <div className="flex items-center gap-2">
            <select value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 px-2 rounded-md bg-muted/40 border border-border text-xs">
              {[25, 50, 100, 200, 500].map((s) => <option key={s} value={s}>{s} / pág.</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <JobFormDialog open={formOpen} onOpenChange={setFormOpen} job={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar línea {toDelete ? jobLlave(toDelete) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La línea se eliminará del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= Sub-components =============

function KpiCard({ label, value, icon, tone = "info" }: {
  label: string; value: string | number; icon?: React.ReactNode;
  tone?: "info" | "warning" | "destructive" | "success" | "primary";
}) {
  const toneClass = {
    info: "text-info", warning: "text-warning", destructive: "text-destructive",
    success: "text-success", primary: "text-foreground",
  }[tone];
  return (
    <div className="surface-elevated rounded-xl border border-border p-4 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        {icon && <span className={`${toneClass} opacity-70`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-xl font-semibold tabular ${toneClass}`}>{value}</div>
    </div>
  );
}

function SelectFilter({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="h-8 px-2 rounded-md border border-border bg-card text-xs text-foreground min-w-[120px]">
      <option value="">{label}: Todos</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function FilterDropdown({ label, options, selected, onToggle }: {
  label: string; options: readonly string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {label}
          {selected.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-primary text-primary-foreground">
              {selected.length}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Filtrar por {label.toLowerCase()}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem key={o} checked={selected.includes(o)} onCheckedChange={() => onToggle(o)}>
            {o}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExpandedRow({ job, colSpan }: { job: Job; colSpan: number }) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Descripción Material", value: job.descripcionMaterial || job.material || "—" },
    { label: "Código SAP", value: job.codigoSap || "—" },
    { label: "Incoterms", value: `${job.incoterms || "—"} ${job.descripcionIncoterms || ""}`.trim() },
    { label: "Modalidad", value: job.modalidadImpo || job.modo || "—" },
    { label: "Lugar llegada", value: job.lugarLlegada || job.destino || "—" },
    { label: "País origen", value: job.paisOrigen || "—" },
    { label: "ETD origen", value: job.etdOrigen || "—" },
    { label: "ETA puerto", value: job.etaPuerto || "—" },
    { label: "ETA campo", value: job.etaCampo || job.eta || "—" },
    { label: "Fecha compromiso", value: job.fechaCompromiso || job.fechaEntregaContractual || "—" },
    { label: "Fecha recepción", value: job.fechaRecepcion || "—" },
    { label: "Fecha orden", value: job.fechaOrden || "—" },
    { label: "Carrier / Naviera", value: job.naviera || job.carrier || "—" },
    { label: "Forwarder", value: job.forwarder || "—" },
    { label: "BL", value: job.bl || "—" },
    { label: "AWB", value: job.awb || "—" },
    { label: "Contenedor", value: job.contenedor || "—" },
    { label: "DO", value: job.doNum || "—" },
    { label: "Invoice", value: job.invoice || "—" },
    { label: "Comprador", value: job.comprador || "—" },
    { label: "Solicitante", value: job.solicitante || "—" },
    { label: "Sociedad", value: job.sociedad || "—" },
    { label: "AFE / Proyecto", value: job.afeProyecto || "—" },
    { label: "Valor Unit. USD", value: job.valorUnitUsd ? fmtMoney(Number(job.valorUnitUsd), "USD") : "—" },
    { label: "Valor Total USD", value: job.valorTotalUsd ? fmtMoney(Number(job.valorTotalUsd), "USD") : "—" },
    { label: "Aging", value: `${computeAging(job)}d` },
    { label: "Motivo retraso", value: job.motivoRetraso || "—" },
    { label: "Criterio retraso", value: job.criterioRetraso || "—" },
    { label: "Categoría seguimiento", value: job.categoriaSeguimiento || "—" },
    { label: "Fecha seguimiento", value: job.fechaSeguimiento || "—" },
  ];
  return (
    <tr className="bg-muted/10 border-b border-border/60">
      <td colSpan={colSpan} className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3">
          {fields.map((f) => (
            <div key={f.label}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">{f.label}</div>
              <div className="text-xs text-foreground mt-0.5">{f.value}</div>
            </div>
          ))}
        </div>
        {job.observaciones && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Observaciones</div>
            <div className="text-xs text-muted-foreground mt-0.5">{job.observaciones}</div>
          </div>
        )}
      </td>
    </tr>
  );
}
