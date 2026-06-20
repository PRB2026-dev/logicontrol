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
} from "@/lib/operational";
import { jobLlave, jobMoneda, fmtMoney, valorPendienteUsdFn, valorPendienteCopFn } from "@/lib/operational";
import { useMemo, useState, Fragment } from "react";
import {
  Download,
  Plus,
  Search,
  ChevronRight,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  Settings2,
  X,
  AlertTriangle,
  Activity,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { JobFormDialog } from "@/components/job-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportJobsToExcel } from "@/lib/export-excel";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type ExpandedState,
  type VisibilityState,
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
  "Booking",
  "En tránsito",
  "Arribado",
  "Aduana",
  "Entregado",
  "Facturado",
  "Cerrado",
  "Demorado",
];
const allPriorities: Priority[] = ["Baja", "Media", "Alta", "Crítica"];

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
  });
  const [expanded, setExpanded] = useState<ExpandedState>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [toDelete, setToDelete] = useState<Job | null>(null);

  // KPIs over the full dataset
  const kpis = useMemo(() => {
    const total = jobs.length;
    let delayed = 0;
    let critical = 0;
    let onTime = 0;
    let compSum = 0;
    let compCount = 0;
    for (const j of jobs) {
      const d = delayDays(j);
      if (d > 0) delayed++;
      else onTime++;
      if (criticality(j) === "Crítico") critical++;
      const closed = ["Cerrado", "Facturado", "Entregado"].includes(j.status);
      if (closed) {
        compSum += compliance(j);
        compCount++;
      }
    }
    return {
      total,
      delayed,
      critical,
      onTime,
      compliance: compCount ? Math.round(compSum / compCount) : 0,
    };
  }, [jobs]);

  const columns = useMemo<ColumnDef<Job>[]>(
    () => [
      {
        id: "expander",
        header: () => null,
        cell: ({ row }) => (
          <button
            onClick={() => row.toggleExpanded()}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted"
            aria-label="Expandir"
          >
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                row.getIsExpanded() ? "rotate-90" : ""
              }`}
            />
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
          <Link
            to="/operaciones/$jobId"
            params={{ jobId: row.original.id } as any}
            className="font-mono text-xs font-semibold text-info hover:underline"
            title="Ver detalle de la línea"
          >
            {jobLlave(row.original)}
          </Link>
        ),
      },
      {
        accessorKey: "oc",
        header: "Orden de Compra",
        cell: ({ row }) => (
          <Link
            to="/operaciones/$jobId"
            params={{ jobId: row.original.id } as any}
            className="font-mono font-semibold text-info hover:underline"
            title="Ver detalle"
          >
            {row.original.oc || row.original.bdpJob || "—"}
          </Link>
        ),
      },
      { accessorKey: "posicion", header: "Pos." },
      { accessorKey: "codigoSap", header: "SAP" },
      {
        accessorKey: "proveedor",
        header: "Proveedor",
        cell: ({ row }) => (
          <div className="max-w-[220px] truncate" title={row.original.proveedor || row.original.cliente}>
            {row.original.proveedor || row.original.cliente || "—"}
          </div>
        ),
      },
      {
        accessorKey: "material",
        header: "Material",
        cell: ({ row }) => (
          <div className="max-w-[260px] truncate text-muted-foreground" title={row.original.material ?? ""}>
            {row.original.material || "—"}
          </div>
        ),
      },
      {
        accessorKey: "qty",
        header: () => <div className="text-right">QTY</div>,
        cell: ({ row }) => (
          <div className="text-right tabular">
            {Number(row.original.qty ?? 0).toLocaleString("es-CO")}{" "}
            <span className="text-xs text-muted-foreground">{row.original.um ?? ""}</span>
          </div>
        ),
      },
      {
        id: "pendiente",
        header: () => <div className="text-right">Pend.</div>,
        accessorFn: (j) => pendientePct(j),
        cell: ({ row }) => {
          const pct = pendientePct(row.original);
          return (
            <div className="flex items-center gap-2 justify-end min-w-[110px]">
              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full ${pct > 60 ? "bg-destructive" : pct > 25 ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs tabular text-muted-foreground w-8 text-right">{pct}%</span>
            </div>
          );
        },
      },
      { accessorKey: "incoterms", header: "Incoterms" },
      { accessorKey: "centro", header: "Centro" },
      {
        id: "moneda",
        header: "Moneda",
        accessorFn: (j) => jobMoneda(j),
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">{jobMoneda(row.original)}</span>
        ),
      },
      {
        id: "valorPendUsd",
        header: () => <div className="text-right">Pend. USD</div>,
        accessorFn: (j) => valorPendienteUsdFn(j),
        cell: ({ row }) => (
          <div className="text-right tabular text-xs text-foreground">
            {fmtMoney(valorPendienteUsdFn(row.original), "USD")}
          </div>
        ),
      },
      {
        id: "valorPendCop",
        header: () => <div className="text-right">Pend. COP</div>,
        accessorFn: (j) => valorPendienteCopFn(j),
        cell: ({ row }) => {
          const v = valorPendienteCopFn(row.original);
          return (
            <div className="text-right tabular text-xs text-muted-foreground">
              {v > 0 ? fmtMoney(v, "COP") : "—"}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[row.original.status]}`}>
            {row.original.status}
          </span>
        ),
        filterFn: (row, _id, value: string[]) =>
          !value?.length || value.includes(row.original.status),
      },
      {
        accessorKey: "prioridad",
        header: "Prio.",
        cell: ({ row }) => (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityColors[row.original.prioridad]}`}>
            {row.original.prioridad}
          </span>
        ),
        filterFn: (row, _id, value: string[]) =>
          !value?.length || value.includes(row.original.prioridad),
      },
      {
        id: "delay",
        header: () => <div className="text-right">Retraso</div>,
        accessorFn: (j) => delayDays(j),
        cell: ({ getValue }) => {
          const d = getValue<number>();
          const bucket = delayBucket(d);
          return (
            <div className="text-right">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${delayBucketColors[bucket]}`}>
                {d > 0 ? `+${d}d` : d === 0 ? "Hoy" : `${d}d`}
              </span>
            </div>
          );
        },
      },
      {
        id: "sla",
        header: "SLA",
        accessorFn: (j) => slaStatus(j),
        cell: ({ row }) => {
          const s = slaStatus(row.original);
          return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${slaColors[s]}`}>● {s}</span>;
        },
      },
      {
        id: "criticality",
        header: "Criticidad",
        accessorFn: (j) => criticality(j),
        cell: ({ row }) => {
          const c = criticality(row.original);
          return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${criticalityColors[c]}`}>{c}</span>;
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
            <div className="flex items-center gap-2 justify-end min-w-[110px]">
              <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${s}%` }} />
              </div>
              <span className="text-xs tabular w-8 text-right">{s}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "eta",
        id: "etaCampo",
        header: "ETA Campo",
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground tabular">
            {row.original.etaCampo || row.original.eta || "—"}
          </div>
        ),
      },
      {
        accessorKey: "responsable",
        header: "Responsable",
        cell: ({ row }) => (
          <div className="text-xs text-muted-foreground">{row.original.responsable || "—"}</div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-right">Acciones</div>,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              to="/operaciones/$jobId"
              params={{ jobId: row.original.id } as any}
              className="inline-flex items-center px-2 h-7 rounded-md text-xs text-info hover:bg-info/10"
            >
              Ver <ChevronRight className="h-3 w-3" />
            </Link>
            <button
              onClick={() => {
                setEditing(row.original);
                setFormOpen(true);
              }}
              className="h-7 w-7 rounded-md hover:bg-muted inline-flex items-center justify-center"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setToDelete(row.original)}
              className="h-7 w-7 rounded-md hover:bg-destructive/10 inline-flex items-center justify-center"
              title="Eliminar"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: jobs,
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
      ]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(v));
    },
    initialState: { pagination: { pageSize: 25 } },
  });

  const filteredJobs = table.getFilteredRowModel().rows.map((r) => r.original);

  const handleExport = () => {
    if (filteredJobs.length === 0) {
      toast.error("No hay órdenes para exportar");
      return;
    }
    exportJobsToExcel(filteredJobs, `ordenes-compra-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filteredJobs.length} órdenes exportadas`);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    deleteJob(toDelete.id);
    toast.success(`${toDelete.oc || toDelete.bdpJob} eliminado`);
    setToDelete(null);
  };

  const statusFilter = (table.getColumn("status")?.getFilterValue() as string[]) ?? [];
  const priorityFilter = (table.getColumn("prioridad")?.getFilterValue() as string[]) ?? [];

  const toggleArrayFilter = (colId: string, current: string[], value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    table.getColumn(colId)?.setFilterValue(next.length ? next : undefined);
  };

  const clearFilters = () => {
    setColumnFilters([]);
    setGlobalFilter("");
  };

  const activeFilters = columnFilters.length + (globalFilter ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gradient">Órdenes de Compra</h1>
          <p className="text-sm text-muted-foreground">
            Centro de control operativo — {filteredJobs.length} de {jobs.length} órdenes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Nueva OC
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Órdenes activas" value={kpis.total} icon={<Activity className="h-4 w-4" />} tone="info" />
        <KpiCard label="Con retraso" value={kpis.delayed} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
        <KpiCard label="Críticas" value={kpis.critical} icon={<Flame className="h-4 w-4" />} tone="destructive" />
        <KpiCard label="A tiempo" value={kpis.onTime} tone="success" />
        <KpiCard label="Cumplimiento" value={`${kpis.compliance}%`} tone="primary" />
      </div>

      {/* Toolbar */}
      <div className="surface-elevated rounded-xl border border-border">
        <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar LLAVE, OC, SAP, proveedor, material, responsable, DO, invoice…"
              className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/40 border border-transparent text-sm focus:outline-none focus:border-ring focus:bg-background transition"
            />
          </div>

          <FilterDropdown
            label="Estado"
            options={allStatuses}
            selected={statusFilter}
            onToggle={(v) => toggleArrayFilter("status", statusFilter, v)}
          />
          <FilterDropdown
            label="Prioridad"
            options={allPriorities}
            selected={priorityFilter}
            onToggle={(v) => toggleArrayFilter("prioridad", priorityFilter, v)}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings2 className="h-4 w-4" /> Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table.getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    className="capitalize"
                  >
                    {c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2 h-8 text-xs rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" /> Limpiar ({activeFilters})
            </button>
          )}
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
                      <th
                        key={h.id}
                        className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                        style={{ width: h.column.columnDef.size }}
                      >
                        {h.isPlaceholder ? null : canSort ? (
                          <button
                            onClick={h.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 hover:text-foreground transition"
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {sort === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : sort === "desc" ? (
                              <ArrowDown className="h-3 w-3" />
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40" />
                            )}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
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
                      <td key={cell.id} className="px-3 py-2.5 align-middle whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {row.getIsExpanded() && <ExpandedRow job={row.original} colSpan={row.getVisibleCells().length} />}
                </Fragment>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-16 text-center text-sm text-muted-foreground">
                    No se encontraron órdenes con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-border flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-muted-foreground">
            Página {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())} ·{" "}
            {table.getFilteredRowModel().rows.length} resultados
          </div>
          <div className="flex items-center gap-2">
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="h-8 px-2 rounded-md bg-muted/40 border border-border text-xs"
            >
              {[10, 25, 50, 100, 200].map((s) => (
                <option key={s} value={s}>
                  {s} / pág.
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <JobFormDialog open={formOpen} onOpenChange={setFormOpen} job={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {toDelete?.oc || toDelete?.bdpJob}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La orden de compra se eliminará del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============= Sub-components =============

function KpiCard({
  label,
  value,
  icon,
  tone = "info",
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: "info" | "warning" | "destructive" | "success" | "primary";
}) {
  const toneClass = {
    info: "text-info",
    warning: "text-warning",
    destructive: "text-destructive",
    success: "text-success",
    primary: "text-foreground",
  }[tone];
  return (
    <div className="surface-elevated rounded-xl border border-border p-4 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
        {icon && <span className={`${toneClass} opacity-70`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-semibold tabular ${toneClass}`}>{value}</div>
    </div>
  );
}

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
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
          <DropdownMenuCheckboxItem
            key={o}
            checked={selected.includes(o)}
            onCheckedChange={() => onToggle(o)}
          >
            {o}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ExpandedRow({ job, colSpan }: { job: Job; colSpan: number }) {
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Incoterms", value: job.incoterms || "—" },
    { label: "Modalidad", value: job.modalidadImpo || job.modo || "—" },
    { label: "Lugar de llegada", value: job.lugarLlegada || job.destino || "—" },
    { label: "ETD origen", value: job.etdOrigen || "—" },
    { label: "ETA puerto", value: job.etaPuerto || "—" },
    { label: "ETA campo", value: job.etaCampo || job.eta || "—" },
    { label: "Entrega contractual", value: job.fechaEntregaContractual || "—" },
    { label: "DO", value: job.doNum || "—" },
    { label: "Invoice", value: job.invoice || "—" },
    { label: "Aging", value: `${computeAging(job)}d` },
    { label: "Motivo retraso", value: job.motivoRetraso || "—" },
    { label: "Criterio", value: job.criterioRetraso || "—" },
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
        {job.asuntoCorreo && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Asunto correo</div>
            <div className="text-xs text-foreground mt-0.5">{job.asuntoCorreo}</div>
          </div>
        )}
        {job.observaciones && (
          <div className="mt-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">Observaciones</div>
            <div className="text-xs text-muted-foreground mt-0.5">{job.observaciones}</div>
          </div>
        )}
      </td>
    </tr>
  );
}
