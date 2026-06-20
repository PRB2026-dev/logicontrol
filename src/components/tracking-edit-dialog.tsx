import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useJobsStore } from "@/lib/jobs-store";
import type { Job, JobStatus } from "@/lib/jobs-data";
import { toast } from "sonner";

const STATUSES: JobStatus[] = ["Booking", "En tránsito", "Arribado", "Aduana", "Entregado", "Facturado", "Cerrado", "Demorado"];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  job: Job | null;
}

export function TrackingEditDialog({ open, onOpenChange, job }: Props) {
  const updateJob = useJobsStore((s) => s.updateJob);
  const [form, setForm] = useState<Partial<Job>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (job) {
      setForm({
        qtyEntregada: job.qtyEntregada ?? 0,
        fechaRecepcion: job.fechaRecepcion ?? "",
        etdOrigen: job.etdOrigen ?? "",
        etaPuerto: job.etaPuerto ?? "",
        fechaNacionalizacion: job.fechaNacionalizacion ?? "",
        fechaBodega: job.fechaBodega ?? "",
        etaCampo: job.etaCampo ?? "",
        status: job.status,
        motivoRetraso: job.motivoRetraso ?? "",
        criterioRetraso: job.criterioRetraso ?? "",
        observaciones: job.observaciones ?? "",
      });
    }
  }, [job]);

  if (!job) return null;

  const set = <K extends keyof Job>(k: K, v: Job[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const qty = Number(job.qty ?? 0);
      const qe = Number(form.qtyEntregada ?? 0);
      const qp = Math.max(0, qty - qe);
      let status = form.status as JobStatus;
      if (qty > 0 && qe >= qty) status = "Entregado";
      const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
      const trace = `[${stamp}] Actualización: recibido ${qe}/${qty}${form.fechaRecepcion ? ` · recepción ${form.fechaRecepcion}` : ""}${form.fechaBodega ? ` · bodega ${form.fechaBodega}` : ""}`;
      const prevObs = job.observaciones ?? "";
      const newObs = (form.observaciones ?? "").trim();
      const obs = newObs && newObs !== prevObs
        ? `${trace} — ${newObs}\n${prevObs}`.trim()
        : `${trace}\n${prevObs}`.trim();
      await updateJob(job.id, {
        ...form,
        qtyPendiente: qp,
        status,
        observaciones: obs,
      });
      toast.success("Seguimiento actualizado");
      onOpenChange(false);
    } catch (e) {
      toast.error("No se pudo actualizar");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Actualizar seguimiento</DialogTitle>
          <DialogDescription>
            OC {job.oc ?? job.bdpJob}{job.posicion ? ` · pos ${job.posicion}` : ""} · {job.material ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <Field label={`Cantidad recibida (de ${Number(job.qty ?? 0).toLocaleString()} ${job.um ?? ""})`}>
            <Input
              type="number"
              min={0}
              max={Number(job.qty ?? 0) || undefined}
              value={String(form.qtyEntregada ?? 0)}
              onChange={(e) => set("qtyEntregada", Number(e.target.value))}
            />
          </Field>
          <Field label="Estado">
            <Select value={form.status} onValueChange={(v) => set("status", v as JobStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field label="ETD origen"><Input type="date" value={form.etdOrigen ?? ""} onChange={(e) => set("etdOrigen", e.target.value)} /></Field>
          <Field label="ETA puerto"><Input type="date" value={form.etaPuerto ?? ""} onChange={(e) => set("etaPuerto", e.target.value)} /></Field>
          <Field label="Nacionalización"><Input type="date" value={form.fechaNacionalizacion ?? ""} onChange={(e) => set("fechaNacionalizacion", e.target.value)} /></Field>
          <Field label="Llegada a bodega"><Input type="date" value={form.fechaBodega ?? ""} onChange={(e) => set("fechaBodega", e.target.value)} /></Field>
          <Field label="ETA campo"><Input type="date" value={form.etaCampo ?? ""} onChange={(e) => set("etaCampo", e.target.value)} /></Field>
          <Field label="Fecha recepción real"><Input type="date" value={form.fechaRecepcion ?? ""} onChange={(e) => set("fechaRecepcion", e.target.value)} /></Field>

          <Field label="Motivo de retraso" className="md:col-span-2">
            <Input value={form.motivoRetraso ?? ""} onChange={(e) => set("motivoRetraso", e.target.value)} placeholder="Ej: demora en aduana, falta de transporte..." />
          </Field>
          <Field label="Criterio de retraso" className="md:col-span-2">
            <Input value={form.criterioRetraso ?? ""} onChange={(e) => set("criterioRetraso", e.target.value)} />
          </Field>

          <Field label="Nueva nota de seguimiento" className="md:col-span-2">
            <Textarea
              rows={3}
              value={form.observaciones ?? ""}
              onChange={(e) => set("observaciones", e.target.value)}
              placeholder="Describe la actualización (se guardará con fecha y hora en la trazabilidad)"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Guardando…" : "Guardar trazabilidad"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
