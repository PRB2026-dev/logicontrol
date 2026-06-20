import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useJobsStore, type Job } from "@/lib/jobs-store";
import type { JobStatus, Priority, TipoCompra } from "@/lib/jobs-data";

const statuses: JobStatus[] = ["Booking", "En tránsito", "Arribado", "Aduana", "Entregado", "Facturado", "Cerrado", "Demorado"];
const prioridades: Priority[] = ["Baja", "Media", "Alta", "Crítica"];
const modos: Job["modo"][] = ["Marítimo", "Aéreo", "Terrestre"];
const tipoCompras: TipoCompra[] = ["Nacional", "Importación"];
const incotermsList = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

const schema = z.object({
  // General
  oc: z.string().trim().max(40).optional().or(z.literal("")),
  posicion: z.string().trim().max(20).optional().or(z.literal("")),
  proveedor: z.string().trim().max(200).optional().or(z.literal("")),
  customer: z.string().trim().max(200).optional().or(z.literal("")),
  comprador: z.string().trim().max(120).optional().or(z.literal("")),
  codigoSap: z.string().trim().max(40).optional().or(z.literal("")),
  material: z.string().trim().max(300).optional().or(z.literal("")),
  um: z.string().trim().max(20).optional().or(z.literal("")),
  status: z.enum(statuses as [JobStatus, ...JobStatus[]]),
  prioridad: z.enum(prioridades as [Priority, ...Priority[]]),
  responsable: z.string().trim().max(80).optional().or(z.literal("")),
  // Orden
  qty: z.coerce.number().min(0).max(1_000_000_000),
  qtyEntregada: z.coerce.number().min(0).max(1_000_000_000),
  valorUnitario: z.coerce.number().min(0),
  fechaOrden: z.string().optional().or(z.literal("")),
  fechaCompromiso: z.string().optional().or(z.literal("")),
  fechaRecepcion: z.string().optional().or(z.literal("")),
  fechaEntregaContractual: z.string().optional().or(z.literal("")),
  // Logística
  incoterms: z.string().trim().max(40).optional().or(z.literal("")),
  modalidadImpo: z.string().trim().max(40).optional().or(z.literal("")),
  modo: z.enum(modos as [Job["modo"], ...Job["modo"][]]),
  lugarLlegada: z.string().trim().max(120).optional().or(z.literal("")),
  destino: z.string().trim().max(120).optional().or(z.literal("")),
  // Importación
  tipoCompra: z.enum(tipoCompras as [TipoCompra, ...TipoCompra[]]),
  paisOrigen: z.string().trim().max(80).optional().or(z.literal("")),
  paisProcedencia: z.string().trim().max(80).optional().or(z.literal("")),
  forwarder: z.string().trim().max(120).optional().or(z.literal("")),
  naviera: z.string().trim().max(120).optional().or(z.literal("")),
  bl: z.string().trim().max(80).optional().or(z.literal("")),
  awb: z.string().trim().max(80).optional().or(z.literal("")),
  contenedor: z.string().trim().max(80).optional().or(z.literal("")),
  etdOrigen: z.string().optional().or(z.literal("")),
  etaPuerto: z.string().optional().or(z.literal("")),
  etaCampo: z.string().optional().or(z.literal("")),
  fechaNacionalizacion: z.string().optional().or(z.literal("")),
  fechaPuerto: z.string().optional().or(z.literal("")),
  fechaBodega: z.string().optional().or(z.literal("")),
  doNum: z.string().trim().max(40).optional().or(z.literal("")),
  invoice: z.string().trim().max(40).optional().or(z.literal("")),
  // Organizacional
  sociedad: z.string().trim().max(80).optional().or(z.literal("")),
  gerencia: z.string().trim().max(80).optional().or(z.literal("")),
  centro: z.string().trim().max(80).optional().or(z.literal("")),
  cuenta: z.string().trim().max(80).optional().or(z.literal("")),
  afeProyecto: z.string().trim().max(80).optional().or(z.literal("")),
  campo: z.string().trim().max(80).optional().or(z.literal("")),
  // Seguimiento
  asuntoCorreo: z.string().trim().max(200).optional().or(z.literal("")),
  motivoRetraso: z.string().trim().max(200).optional().or(z.literal("")),
  criterioRetraso: z.string().trim().max(200).optional().or(z.literal("")),
  observaciones: z.string().max(1500).optional().or(z.literal("")),
  escalado: z.boolean(),
});

type FormValues = z.input<typeof schema>;
type TabId = "general" | "orden" | "logistica" | "importacion" | "seguimiento";

const empty: FormValues = {
  oc: "", posicion: "", proveedor: "", customer: "", comprador: "",
  codigoSap: "", material: "", um: "UN",
  status: "Booking", prioridad: "Media", responsable: "",
  qty: 0, qtyEntregada: 0, valorUnitario: 0,
  fechaOrden: "", fechaCompromiso: "", fechaRecepcion: "", fechaEntregaContractual: "",
  incoterms: "", modalidadImpo: "", modo: "Marítimo", lugarLlegada: "", destino: "",
  tipoCompra: "Nacional", paisOrigen: "", paisProcedencia: "",
  forwarder: "", naviera: "", bl: "", awb: "", contenedor: "",
  etdOrigen: "", etaPuerto: "", etaCampo: "",
  fechaNacionalizacion: "", fechaPuerto: "", fechaBodega: "",
  doNum: "", invoice: "",
  sociedad: "", gerencia: "", centro: "", cuenta: "", afeProyecto: "", campo: "",
  asuntoCorreo: "", motivoRetraso: "", criterioRetraso: "",
  observaciones: "", escalado: false,
};

export function JobFormDialog({ open, onOpenChange, job }: { open: boolean; onOpenChange: (v: boolean) => void; job?: Job | null }) {
  const addJob = useJobsStore((s) => s.addJob);
  const updateJob = useJobsStore((s) => s.updateJob);
  const [values, setValues] = useState<FormValues>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabId>("general");

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTab("general");
    if (!job) { setValues(empty); return; }
    setValues({
      oc: job.oc ?? "", posicion: job.posicion ?? "",
      proveedor: job.proveedor ?? job.cliente ?? "",
      customer: job.customer ?? "", comprador: job.comprador ?? "",
      codigoSap: job.codigoSap ?? "", material: job.material ?? job.descripcionMaterial ?? "",
      um: job.um ?? "UN",
      status: job.status, prioridad: job.prioridad, responsable: job.responsable ?? "",
      qty: job.qty ?? 0, qtyEntregada: job.qtyEntregada ?? 0,
      valorUnitario: job.valorUnitario ?? 0,
      fechaOrden: job.fechaOrden ?? "", fechaCompromiso: job.fechaCompromiso ?? "",
      fechaRecepcion: job.fechaRecepcion ?? "",
      fechaEntregaContractual: job.fechaEntregaContractual ?? "",
      incoterms: job.incoterms ?? "", modalidadImpo: job.modalidadImpo ?? "",
      modo: job.modo, lugarLlegada: job.lugarLlegada ?? "", destino: job.destino ?? "",
      tipoCompra: (job.tipoCompra as TipoCompra) ?? "Nacional",
      paisOrigen: job.paisOrigen ?? "", paisProcedencia: job.paisProcedencia ?? "",
      forwarder: job.forwarder ?? "", naviera: job.naviera ?? job.carrier ?? "",
      bl: job.bl ?? "", awb: job.awb ?? "", contenedor: job.contenedor ?? "",
      etdOrigen: job.etdOrigen ?? "", etaPuerto: job.etaPuerto ?? "",
      etaCampo: job.etaCampo ?? job.eta ?? "",
      fechaNacionalizacion: job.fechaNacionalizacion ?? "",
      fechaPuerto: job.fechaPuerto ?? "", fechaBodega: job.fechaBodega ?? "",
      doNum: job.doNum ?? "", invoice: job.invoice ?? "",
      sociedad: job.sociedad ?? "", gerencia: job.gerencia ?? "",
      centro: job.centro ?? "", cuenta: job.cuenta ?? "",
      afeProyecto: job.afeProyecto ?? "", campo: job.campo ?? "",
      asuntoCorreo: job.asuntoCorreo ?? "",
      motivoRetraso: job.motivoRetraso ?? "", criterioRetraso: job.criterioRetraso ?? "",
      observaciones: job.observaciones ?? "", escalado: job.escalado,
    });
  }, [open, job]);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => setValues((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as string] = issue.message;
      setErrors(errs);
      toast.error("Revisa los campos del formulario");
      return;
    }
    const v = parsed.data;
    const qty = Number(v.qty || 0);
    const qtyEntr = Number(v.qtyEntregada || 0);
    const vu = Number(v.valorUnitario || 0);
    const payload: Job = {
      id: job?.id ?? `job-${Date.now()}`,
      bdpJob: job?.bdpJob ?? v.oc ?? `OC-${Date.now()}`,
      cliente: v.customer || v.proveedor || job?.cliente || "—",
      status: v.status,
      origen: v.paisOrigen || job?.origen || "",
      destino: v.destino || v.lugarLlegada || "",
      carrier: v.naviera || job?.carrier || "",
      eta: v.etaCampo || v.etaPuerto || v.fechaCompromiso || job?.eta || new Date().toISOString().slice(0, 10),
      ata: job?.ata ?? null, aduana: job?.aduana ?? null, factura: job?.factura ?? null,
      peso: job?.peso ?? 0, teus: job?.teus ?? 0,
      modo: v.modo, responsable: v.responsable || "Sin asignar", centro: v.centro || "",
      prioridad: v.prioridad,
      fechaCreacion: job?.fechaCreacion ?? new Date().toISOString().slice(0, 10),
      observaciones: v.observaciones ?? "", escalado: v.escalado,
      oc: v.oc || null, posicion: v.posicion || null, proveedor: v.proveedor || null,
      codigoSap: v.codigoSap || null, material: v.material || null, um: v.um || null,
      qty, qtyEntregada: qtyEntr, qtyPendiente: Math.max(0, qty - qtyEntr),
      incoterms: v.incoterms || null, modalidadImpo: v.modalidadImpo || null,
      lugarLlegada: v.lugarLlegada || null,
      etdOrigen: v.etdOrigen || null, etaPuerto: v.etaPuerto || null, etaCampo: v.etaCampo || null,
      fechaEntregaContractual: v.fechaEntregaContractual || null,
      doNum: v.doNum || null, invoice: v.invoice || null, asuntoCorreo: v.asuntoCorreo || null,
      motivoRetraso: v.motivoRetraso || null, criterioRetraso: v.criterioRetraso || null,
      // nuevos
      sociedad: v.sociedad || null, gerencia: v.gerencia || null, cuenta: v.cuenta || null,
      afeProyecto: v.afeProyecto || null, campo: v.campo || null,
      customer: v.customer || null, comprador: v.comprador || null,
      descripcionMaterial: v.material || null,
      valorUnitario: vu, valorTotal: qty * vu,
      fechaOrden: v.fechaOrden || null, fechaCompromiso: v.fechaCompromiso || null,
      fechaRecepcion: v.fechaRecepcion || null,
      tipoCompra: v.tipoCompra,
      paisOrigen: v.paisOrigen || null, paisProcedencia: v.paisProcedencia || null,
      forwarder: v.forwarder || null, naviera: v.naviera || null,
      bl: v.bl || null, awb: v.awb || null, contenedor: v.contenedor || null,
      fechaNacionalizacion: v.fechaNacionalizacion || null,
      fechaPuerto: v.fechaPuerto || null, fechaBodega: v.fechaBodega || null,
    };
    if (job) { await updateJob(job.id, payload); toast.success(`${payload.oc ?? payload.bdpJob} actualizado`); }
    else { await addJob(payload); toast.success(`${payload.oc ?? payload.bdpJob} creado`); }
    onOpenChange(false);
  };

  const tabBtn = (id: TabId, label: string) => (
    <button type="button" onClick={() => setTab(id)} className={`px-3 h-8 text-xs font-medium rounded-md border transition ${tab === id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted text-muted-foreground"}`}>{label}</button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? "Editar orden de compra" : "Nueva orden de compra"}</DialogTitle>
          <DialogDescription>Captura toda la información de la línea de OC, importación y seguimiento.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
          {tabBtn("general", "General")}
          {tabBtn("orden", "Orden")}
          {tabBtn("logistica", "Logística")}
          {tabBtn("importacion", "Importación")}
          {tabBtn("seguimiento", "Seguimiento")}
        </div>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tab === "general" && (<>
            <Field label="# OC" error={errors.oc}><Input value={values.oc ?? ""} onChange={(v) => set("oc", v)} placeholder="4500001234" /></Field>
            <Field label="Posición" error={errors.posicion}><Input value={values.posicion ?? ""} onChange={(v) => set("posicion", v)} placeholder="10" /></Field>
            <Field label="Proveedor" error={errors.proveedor}><Input value={values.proveedor ?? ""} onChange={(v) => set("proveedor", v)} /></Field>
            <Field label="Customer" error={errors.customer}><Input value={values.customer ?? ""} onChange={(v) => set("customer", v)} /></Field>
            <Field label="Comprador" error={errors.comprador}><Input value={values.comprador ?? ""} onChange={(v) => set("comprador", v)} /></Field>
            <Field label="Responsable" error={errors.responsable}><Input value={values.responsable ?? ""} onChange={(v) => set("responsable", v)} /></Field>
            <Field label="Código SAP" error={errors.codigoSap}><Input value={values.codigoSap ?? ""} onChange={(v) => set("codigoSap", v)} /></Field>
            <Field label="U/M" error={errors.um}><Input value={values.um ?? ""} onChange={(v) => set("um", v)} placeholder="UN" /></Field>
            <div className="md:col-span-2">
              <Field label="Material (texto breve)" error={errors.material}><Input value={values.material ?? ""} onChange={(v) => set("material", v)} /></Field>
            </div>
            <Field label="Estado" error={errors.status}><Select value={values.status} onChange={(v) => set("status", v as JobStatus)} options={statuses} /></Field>
            <Field label="Prioridad" error={errors.prioridad}><Select value={values.prioridad} onChange={(v) => set("prioridad", v as Priority)} options={prioridades} /></Field>
            <Field label="Sociedad" error={errors.sociedad}><Input value={values.sociedad ?? ""} onChange={(v) => set("sociedad", v)} /></Field>
            <Field label="Gerencia" error={errors.gerencia}><Input value={values.gerencia ?? ""} onChange={(v) => set("gerencia", v)} /></Field>
            <Field label="Centro de costo" error={errors.centro}><Input value={values.centro ?? ""} onChange={(v) => set("centro", v)} /></Field>
            <Field label="Campo" error={errors.campo}><Input value={values.campo ?? ""} onChange={(v) => set("campo", v)} /></Field>
            <Field label="Cuenta" error={errors.cuenta}><Input value={values.cuenta ?? ""} onChange={(v) => set("cuenta", v)} /></Field>
            <Field label="AFE / Proyecto" error={errors.afeProyecto}><Input value={values.afeProyecto ?? ""} onChange={(v) => set("afeProyecto", v)} /></Field>
          </>)}

          {tab === "orden" && (<>
            <Field label="Cantidad ordenada" error={errors.qty}><Input type="number" value={String(values.qty)} onChange={(v) => set("qty", v as unknown as number)} /></Field>
            <Field label="Cantidad recibida" error={errors.qtyEntregada}><Input type="number" value={String(values.qtyEntregada)} onChange={(v) => set("qtyEntregada", v as unknown as number)} /></Field>
            <Field label="Valor unitario (USD)" error={errors.valorUnitario}><Input type="number" value={String(values.valorUnitario)} onChange={(v) => set("valorUnitario", v as unknown as number)} /></Field>
            <Field label="Valor total calculado">
              <div className="h-9 px-3 rounded-md bg-muted/40 text-sm flex items-center text-foreground">
                {(Number(values.qty || 0) * Number(values.valorUnitario || 0)).toLocaleString("es-CO", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
              </div>
            </Field>
            <Field label="Fecha de orden" error={errors.fechaOrden}><Input type="date" value={values.fechaOrden ?? ""} onChange={(v) => set("fechaOrden", v)} /></Field>
            <Field label="Fecha compromiso" error={errors.fechaCompromiso}><Input type="date" value={values.fechaCompromiso ?? ""} onChange={(v) => set("fechaCompromiso", v)} /></Field>
            <Field label="Fecha entrega contractual" error={errors.fechaEntregaContractual}><Input type="date" value={values.fechaEntregaContractual ?? ""} onChange={(v) => set("fechaEntregaContractual", v)} /></Field>
            <Field label="Fecha de recepción" error={errors.fechaRecepcion}><Input type="date" value={values.fechaRecepcion ?? ""} onChange={(v) => set("fechaRecepcion", v)} /></Field>
          </>)}

          {tab === "logistica" && (<>
            <Field label="INCOTERMS" error={errors.incoterms}><Select value={values.incoterms ?? ""} onChange={(v) => set("incoterms", v)} options={["", ...incotermsList]} /></Field>
            <Field label="Modalidad IMPO" error={errors.modalidadImpo}><Select value={values.modalidadImpo ?? ""} onChange={(v) => set("modalidadImpo", v)} options={["", "MARÍTIMO", "AÉREO", "TERRESTRE"]} /></Field>
            <Field label="Modo" error={errors.modo}><Select value={values.modo} onChange={(v) => set("modo", v as Job["modo"])} options={modos} /></Field>
            <Field label="Lugar de llegada" error={errors.lugarLlegada}><Input value={values.lugarLlegada ?? ""} onChange={(v) => set("lugarLlegada", v)} /></Field>
            <Field label="Destino (campo)" error={errors.destino}><Input value={values.destino ?? ""} onChange={(v) => set("destino", v)} /></Field>
            <Field label="DO" error={errors.doNum}><Input value={values.doNum ?? ""} onChange={(v) => set("doNum", v)} /></Field>
            <Field label="Invoice" error={errors.invoice}><Input value={values.invoice ?? ""} onChange={(v) => set("invoice", v)} /></Field>
          </>)}

          {tab === "importacion" && (<>
            <Field label="Tipo de compra" error={errors.tipoCompra}><Select value={values.tipoCompra} onChange={(v) => set("tipoCompra", v as TipoCompra)} options={tipoCompras} /></Field>
            <Field label="País origen" error={errors.paisOrigen}><Input value={values.paisOrigen ?? ""} onChange={(v) => set("paisOrigen", v)} /></Field>
            <Field label="País procedencia" error={errors.paisProcedencia}><Input value={values.paisProcedencia ?? ""} onChange={(v) => set("paisProcedencia", v)} /></Field>
            <Field label="Forwarder" error={errors.forwarder}><Input value={values.forwarder ?? ""} onChange={(v) => set("forwarder", v)} /></Field>
            <Field label="Naviera" error={errors.naviera}><Input value={values.naviera ?? ""} onChange={(v) => set("naviera", v)} /></Field>
            <Field label="BL" error={errors.bl}><Input value={values.bl ?? ""} onChange={(v) => set("bl", v)} /></Field>
            <Field label="AWB" error={errors.awb}><Input value={values.awb ?? ""} onChange={(v) => set("awb", v)} /></Field>
            <Field label="Contenedor" error={errors.contenedor}><Input value={values.contenedor ?? ""} onChange={(v) => set("contenedor", v)} /></Field>
            <Field label="ETD (origen)" error={errors.etdOrigen}><Input type="date" value={values.etdOrigen ?? ""} onChange={(v) => set("etdOrigen", v)} /></Field>
            <Field label="ETA (puerto)" error={errors.etaPuerto}><Input type="date" value={values.etaPuerto ?? ""} onChange={(v) => set("etaPuerto", v)} /></Field>
            <Field label="ETA (campo)" error={errors.etaCampo}><Input type="date" value={values.etaCampo ?? ""} onChange={(v) => set("etaCampo", v)} /></Field>
            <Field label="Fecha nacionalización" error={errors.fechaNacionalizacion}><Input type="date" value={values.fechaNacionalizacion ?? ""} onChange={(v) => set("fechaNacionalizacion", v)} /></Field>
            <Field label="Fecha puerto" error={errors.fechaPuerto}><Input type="date" value={values.fechaPuerto ?? ""} onChange={(v) => set("fechaPuerto", v)} /></Field>
            <Field label="Fecha bodega" error={errors.fechaBodega}><Input type="date" value={values.fechaBodega ?? ""} onChange={(v) => set("fechaBodega", v)} /></Field>
          </>)}

          {tab === "seguimiento" && (<>
            <div className="md:col-span-2"><Field label="Asunto correo" error={errors.asuntoCorreo}><Input value={values.asuntoCorreo ?? ""} onChange={(v) => set("asuntoCorreo", v)} /></Field></div>
            <Field label="Motivo de retraso" error={errors.motivoRetraso}><Input value={values.motivoRetraso ?? ""} onChange={(v) => set("motivoRetraso", v)} /></Field>
            <Field label="Criterio de retraso" error={errors.criterioRetraso}><Input value={values.criterioRetraso ?? ""} onChange={(v) => set("criterioRetraso", v)} /></Field>
            <div className="md:col-span-2">
              <Field label="Observaciones" error={errors.observaciones}>
                <textarea value={values.observaciones ?? ""} onChange={(e) => set("observaciones", e.target.value)} rows={5}
                  className="w-full px-3 py-2 rounded-md bg-muted/60 border border-transparent text-sm focus:outline-none focus:border-ring focus:bg-background" />
              </Field>
            </div>
            <label className="md:col-span-2 inline-flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={values.escalado} onChange={(e) => set("escalado", e.target.checked)} className="h-4 w-4 rounded border-border" />
              Escalado a gerencia
            </label>
          </>)}

          <DialogFooter className="md:col-span-2 mt-4">
            <button type="button" onClick={() => onOpenChange(false)} className="px-4 h-9 text-sm rounded-md border border-border hover:bg-muted">Cancelar</button>
            <button type="submit" className="px-4 h-9 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">{job ? "Guardar cambios" : "Crear OC"}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <div className="text-[11px] text-destructive mt-1">{error}</div>}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-md bg-muted/60 border border-transparent text-sm focus:outline-none focus:border-ring focus:bg-background" />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-2 rounded-md bg-muted/60 border border-transparent text-sm focus:outline-none focus:border-ring focus:bg-background">
      {options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
    </select>
  );
}
