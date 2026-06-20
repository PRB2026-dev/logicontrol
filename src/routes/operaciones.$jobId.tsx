import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { statusColors, lineStatusColors, type Job } from "@/lib/jobs-data";
import { useJobsStore } from "@/lib/jobs-store";
import { lineStatus, diasRetraso, saldoPendiente, valorComprado, valorRecibido, valorPendiente, valorCompradoUsd, valorRecibidoUsd, valorPendienteUsdFn, valorPendienteCopFn, tieneCop, fmtMoney, deriveTipoCompra } from "@/lib/operational";
import { ArrowLeft, Ship, MapPin, Calendar, Package, Building2, FileText, AlertTriangle, Layers, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrackingEditDialog } from "@/components/tracking-edit-dialog";

export const Route = createFileRoute("/operaciones/$jobId")({
  component: () => (<AppShell><Detail /></AppShell>),
});

function Detail() {
  const { jobId } = Route.useParams();
  const allJobs = useJobsStore((s) => s.jobs);
  const job = allJobs.find((j) => j.id === jobId) as Job | undefined;
  const [editing, setEditing] = useState<Job | null>(null);

  if (!job) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Orden no encontrada.</p>
        <Link to="/operaciones" className="inline-flex items-center gap-1 text-sm text-info hover:underline mt-3">
          <ArrowLeft className="h-4 w-4" /> Volver a operaciones
        </Link>
      </div>
    );
  }

  const ls = lineStatus(job);
  const dr = diasRetraso(job);
  const tipo = deriveTipoCompra(job);
  const isImpo = tipo === "Importación";

  const timeline = [
    { label: "Fecha de orden", date: job.fechaOrden, done: !!job.fechaOrden, icon: FileText },
    { label: "Fecha compromiso", date: job.fechaCompromiso ?? job.fechaEntregaContractual, done: !!(job.fechaCompromiso || job.fechaEntregaContractual), icon: Calendar },
    ...(isImpo ? [
      { label: "ETD origen", date: job.etdOrigen, done: !!job.etdOrigen, icon: Ship },
      { label: "ETA puerto", date: job.etaPuerto ?? job.fechaPuerto, done: !!(job.etaPuerto || job.fechaPuerto), icon: MapPin },
      { label: "Nacionalización", date: job.fechaNacionalizacion, done: !!job.fechaNacionalizacion, icon: Building2 },
      { label: "Llegada bodega", date: job.fechaBodega ?? job.etaCampo, done: !!(job.fechaBodega || job.etaCampo), icon: Package },
    ] : []),
    { label: "Fecha de recepción", date: job.fechaRecepcion, done: !!job.fechaRecepcion, icon: Package },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link to="/operaciones" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Operaciones
        </Link>
        <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">OC {job.oc ?? job.bdpJob}{job.posicion ? ` · pos ${job.posicion}` : ""}</h1>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lineStatusColors[ls]}`}>{ls}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status]}`}>{job.status}</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground border border-border">{tipo}</span>
              {dr > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/15 text-destructive border border-destructive/30">
                  <AlertTriangle className="h-3 w-3" /> {dr} días de retraso
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {job.proveedor ?? "—"}{job.customer ? ` · ${job.customer}` : ""}{job.comprador ? ` · comprador ${job.comprador}` : ""}
            </p>
            {job.material && <p className="text-sm text-foreground mt-1">{job.codigoSap ? `${job.codigoSap} — ` : ""}{job.material}</p>}
          </div>
          <Button onClick={() => setEditing(job)} className="gap-2">
            <Pencil className="h-4 w-4" /> Actualizar seguimiento
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Cantidad ordenada" value={`${Number(job.qty ?? 0).toLocaleString()} ${job.um ?? ""}`} />
        <KPI label="Recibida" value={`${Number(job.qtyEntregada ?? 0).toLocaleString()} ${job.um ?? ""}`} accent="success" />
        <KPI label="Saldo pendiente" value={`${saldoPendiente(job).toLocaleString()} ${job.um ?? ""}`} accent={saldoPendiente(job) > 0 ? "warning" : "success"} />
        <KPI label="Días de retraso" value={String(dr)} accent={dr > 0 ? "destructive" : "success"} />
      </div>

      {/* === Valores en USD === */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Valores en USD</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Valor comprado" value={fmtMoney(valorCompradoUsd(job), "USD")} />
          <KPI label="Valor recibido" value={fmtMoney(valorRecibidoUsd(job), "USD")} accent="success" />
          <KPI label="Valor pendiente" value={fmtMoney(valorPendienteUsdFn(job), "USD")} accent={valorPendienteUsdFn(job) > 0 ? "warning" : "muted"} />
          <KPI label="Valor unitario" value={fmtMoney(Number(job.valorUnitUsd ?? 0), "USD")} />
        </div>
      </div>

      {/* === Valores en COP === */}
      {(tieneCop(job) || Number(job.valorTotal ?? 0) > 0) && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Valores en COP {job.monedaPedido && job.monedaPedido !== "COP" ? <span className="text-muted-foreground/70 normal-case">· moneda pedido: {job.monedaPedido}</span> : null}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPI label="Valor comprado" value={fmtMoney(valorComprado(job), "COP")} />
            <KPI label="Valor recibido" value={fmtMoney(valorRecibido(job), "COP")} accent="success" />
            <KPI label="Valor pendiente" value={fmtMoney(valorPendienteCopFn(job) || valorPendiente(job), "COP")} accent="warning" />
            <KPI label="Valor unitario" value={fmtMoney(Number(job.valorUnitario ?? 0), "COP")} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h3 className="font-semibold text-foreground mb-5">Línea de tiempo de la orden</h3>
          <ol className="space-y-5">
            {timeline.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 ${step.done ? "bg-success text-success-foreground border-success" : "bg-muted text-muted-foreground border-border"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {i < timeline.length - 1 && <div className={`w-px flex-1 mt-1 ${step.done ? "bg-success/40" : "bg-border"}`} />}
                  </div>
                  <div className="pb-1 flex-1">
                    <div className="font-medium text-foreground text-sm">{step.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{step.date ?? "Pendiente"}</div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="space-y-4">
          {isImpo && (
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold text-foreground mb-3">Importación</h3>
              <DL rows={[
                ["INCOTERMS", job.incoterms],
                ["País origen", job.paisOrigen],
                ["País procedencia", job.paisProcedencia],
                ["Forwarder", job.forwarder],
                ["Naviera", job.naviera],
                ["BL", job.bl],
                ["AWB", job.awb],
                ["Contenedor", job.contenedor],
                ["Lugar llegada", job.lugarLlegada],
                ["DO", job.doNum],
                ["Invoice", job.invoice],
              ]} />
            </div>
          )}

          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-semibold text-foreground mb-3">Organizacional</h3>
            <DL rows={[
              ["Sociedad", job.sociedad],
              ["Gerencia", job.gerencia],
              ["Centro de costo", job.centro],
              ["Campo", job.campo],
              ["Cuenta", job.cuenta],
              ["AFE / Proyecto", job.afeProyecto],
              ["Responsable", job.responsable],
            ]} />
          </div>

          {(job.motivoRetraso || job.criterioRetraso || job.asuntoCorreo || job.observaciones) && (
            <div className="bg-card border border-border rounded-lg p-5">
              <h3 className="font-semibold text-foreground mb-3">Seguimiento</h3>
              <DL rows={[
                ["Asunto correo", job.asuntoCorreo],
                ["Motivo retraso", job.motivoRetraso],
                ["Criterio retraso", job.criterioRetraso],
              ]} />
              {job.observaciones && (
                <p className="text-sm text-foreground mt-3 whitespace-pre-wrap">{job.observaciones}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* === Líneas / Ítems de la OC === */}
      <OcLines allJobs={allJobs} oc={job.oc} currentId={job.id} onEdit={setEditing} />

      <TrackingEditDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} job={editing} />
    </div>
  );
}

function OcLines({ allJobs, oc, currentId, onEdit }: { allJobs: Job[]; oc: string | null | undefined; currentId: string; onEdit: (j: Job) => void }) {
  if (!oc) return null;
  const siblings = allJobs.filter((j) => (j.oc ?? "").trim() === oc.trim());
  if (siblings.length === 0) return null;

  const totals = siblings.reduce(
    (acc, j) => {
      acc.qty += Number(j.qty ?? 0);
      acc.rec += Number(j.qtyEntregada ?? 0);
      acc.falt += saldoPendiente(j);
      acc.vpUsd += valorPendienteUsdFn(j);
      acc.vpCop += valorPendienteCopFn(j) || (((j.monedaPedido || j.moneda || "").toString().toUpperCase() === "COP") ? valorPendiente(j) : 0);
      return acc;
    },
    { qty: 0, rec: 0, falt: 0, vpUsd: 0, vpCop: 0 },
  );
  const cumpl = totals.qty > 0 ? Math.round((totals.rec / totals.qty) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-foreground">Líneas de la OC {oc}</h3>
          <span className="text-xs text-muted-foreground">· {siblings.length} ítem(s)</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">Qty {totals.qty.toLocaleString()}</span>
          <span className="px-2 py-1 rounded-md bg-success/10 text-success">Recibido {totals.rec.toLocaleString()}</span>
          <span className="px-2 py-1 rounded-md bg-warning/10 text-warning">Faltante {totals.falt.toLocaleString()}</span>
          <span className="px-2 py-1 rounded-md bg-info/10 text-info">{cumpl}% cumplimiento</span>
        </div>
      </div>

      <div className="mb-4 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-success" style={{ width: `${cumpl}%` }} />
      </div>

      <div className="overflow-x-auto -mx-2 px-2">
        <table className="w-full text-sm min-w-[1200px] border-separate border-spacing-0">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
              <th className="py-2 px-3 whitespace-nowrap">Pos</th>
              <th className="py-2 px-3 whitespace-nowrap">Material</th>
              <th className="py-2 px-3 whitespace-nowrap">UM</th>
              <th className="py-2 px-3 whitespace-nowrap text-right">Qty</th>
              <th className="py-2 px-3 whitespace-nowrap text-right">Recibida</th>
              <th className="py-2 px-3 whitespace-nowrap text-right">Faltante</th>
              <th className="py-2 px-3 whitespace-nowrap">F. compromiso</th>
              <th className="py-2 px-3 whitespace-nowrap">F. llegada</th>
              <th className="py-2 px-3 whitespace-nowrap text-right">Retraso</th>
              <th className="py-2 px-3 whitespace-nowrap">Estado</th>
              <th className="py-2 px-3 whitespace-nowrap text-right">Pend. USD</th>
              <th className="py-2 px-3 whitespace-nowrap text-right">Pend. COP</th>
              <th className="py-2 px-3 whitespace-nowrap text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {siblings.map((j) => {
              const ls = lineStatus(j);
              const dr = diasRetraso(j);
              const isCurrent = j.id === currentId;
              const llegada = j.fechaRecepcion ?? j.fechaBodega ?? j.etaCampo ?? j.fechaPuerto ?? null;
              return (
                <tr key={j.id} className={`border-b border-border/50 hover:bg-muted/30 ${isCurrent ? "bg-info/5" : ""}`}>
                  <td className="py-2 px-3 font-medium text-foreground whitespace-nowrap">{j.posicion ?? "—"}</td>
                  <td className="py-2 px-3 max-w-[280px]">
                    <div className="text-foreground truncate" title={`${j.codigoSap ?? ""} ${j.material ?? j.descripcionMaterial ?? ""}`}>
                      {j.codigoSap ? `${j.codigoSap} — ` : ""}{j.material ?? j.descripcionMaterial ?? "—"}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{j.um ?? "—"}</td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{Number(j.qty ?? 0).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-success whitespace-nowrap">{Number(j.qtyEntregada ?? 0).toLocaleString()}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-warning whitespace-nowrap">{saldoPendiente(j).toLocaleString()}</td>
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{j.fechaCompromiso ?? j.fechaEntregaContractual ?? "—"}</td>
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{llegada ?? "—"}</td>
                  <td className={`py-2 px-3 text-right tabular-nums whitespace-nowrap ${dr > 0 ? "text-destructive font-semibold" : dr === 0 ? "text-muted-foreground" : "text-success"}`}>
                    {dr > 0 ? `+${dr}` : dr === 0 ? "0" : dr}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lineStatusColors[ls]}`}>{ls}</span>
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{fmtMoney(valorPendienteUsdFn(j), "USD")}</td>
                  <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap text-muted-foreground">{(valorPendienteCopFn(j) > 0 || ((j.monedaPedido || j.moneda || "").toString().toUpperCase() === "COP")) ? fmtMoney(valorPendienteCopFn(j) || valorPendiente(j), "COP") : "—"}</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => onEdit(j)} className="inline-flex items-center gap-1 text-xs text-info hover:underline">
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                      {!isCurrent && (
                        <Link to="/operaciones/$jobId" params={{ jobId: j.id } as any} className="text-muted-foreground hover:text-foreground text-xs">Ver</Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold text-foreground">
              <td colSpan={3} className="py-2 pr-3">Totales</td>
              <td className="py-2 pr-3 text-right tabular-nums">{totals.qty.toLocaleString()}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-success">{totals.rec.toLocaleString()}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-warning">{totals.falt.toLocaleString()}</td>
              <td colSpan={4}></td>
              <td className="py-2 pr-3 text-right tabular-nums">{fmtMoney(totals.vpUsd, "USD")}</td>
              <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{totals.vpCop > 0 ? fmtMoney(totals.vpCop, "COP") : "—"}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, accent = "muted" }: { label: string; value: string; accent?: "muted" | "success" | "warning" | "destructive" }) {
  const tone = accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`mt-1.5 text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function DL({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="text-foreground text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
