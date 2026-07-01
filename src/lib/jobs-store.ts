import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { jobs as seedJobs, type Job, type JobStatus, type TipoCompra } from "./jobs-data";

interface JobsState {
  jobs: Job[];
  loading: boolean;
  lastImport: { date: string; count: number; fileName: string } | null;
  loadFromCloud: () => Promise<void>;
  setJobs: (jobs: Job[]) => void;
  addJobs: (jobs: Job[], fileName: string) => Promise<{ insertedCount: number; errors: string[] }>;
  addJob: (job: Job) => Promise<void>;
  updateJob: (id: string, patch: Partial<Job>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  resetToDemo: () => Promise<void>;
  clearAll: () => Promise<void>;
}

type Row = Record<string, unknown>;

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const n = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
const d = (v: unknown): string | null => (v ? String(v) : null);

function rowToJob(r: Row): Job {
  const oc = s(r.oc);
  const pos = s(r.posicion);
  const llave = s(r.llave) || (oc ? (pos ? `${oc}-${pos.padStart(2, "0")}` : oc) : "");
  return {
    id: String(r.id),
    llave: llave || null,
    bdpJob: s(r.bdp_job) || oc || s(r.codigo_sap),
    cliente: s(r.cliente) || s(r.customer) || s(r.proveedor) || "—",
    status: (r.status as JobStatus) ?? "Booking",
    origen: s(r.origen) || s(r.pais_origen),
    destino: s(r.destino) || s(r.lugar_llegada),
    carrier: s(r.carrier) || s(r.naviera),
    eta: s(r.eta) || s(r.eta_campo) || s(r.eta_puerto) || s(r.fecha_compromiso),
    ata: d(r.ata),
    aduana: d(r.aduana),
    factura: d(r.factura),
    peso: Number(r.peso ?? 0),
    teus: Number(r.teus ?? 0),
    modo: (r.modo as Job["modo"]) ?? "Marítimo",
    responsable: s(r.responsable),
    centro: s(r.centro),
    prioridad: (r.prioridad as Job["prioridad"]) ?? "Media",
    fechaCreacion: r.fecha_creacion ? String(r.fecha_creacion) : new Date().toISOString().slice(0, 10),
    observaciones: s(r.observaciones),
    escalado: Boolean(r.escalado),
    numero: n(r.numero),
    incoterms: s(r.incoterms) || null,
    proveedor: s(r.proveedor) || null,
    oc: oc || null,
    posicion: pos || null,
    codigoSap: s(r.codigo_sap) || null,
    material: s(r.material) || null,
    um: s(r.um) || null,
    qty: n(r.qty),
    qtyEntregada: n(r.qty_entregada),
    qtyPendiente: n(r.qty_pendiente),
    fechaEntregaContractual: d(r.fecha_entrega_contractual),
    modalidadImpo: s(r.modalidad_impo) || null,
    lugarLlegada: s(r.lugar_llegada) || null,
    etdOrigen: d(r.etd_origen),
    etaPuerto: d(r.eta_puerto),
    etaCampo: d(r.eta_campo),
    doNum: s(r.do_num) || null,
    invoice: s(r.invoice) || null,
    asuntoCorreo: s(r.asunto_correo) || null,
    motivoRetraso: s(r.motivo_retraso) || null,
    criterioRetraso: s(r.criterio_retraso) || null,
    sociedad: s(r.sociedad) || null,
    cuenta: s(r.cuenta) || null,
    colectorCosto: s(r.colector_costo) || null,
    afeProyecto: s(r.afe_proyecto) || null,
    assets: s(r.assets) || null,
    gerencia: s(r.gerencia) || null,
    campo: s(r.campo) || null,
    equipo: s(r.equipo) || null,
    customer: s(r.customer) || null,
    comprador: s(r.comprador) || null,
    solicitante: s(r.solicitante) || null,
    fechaAceptacion: d(r.fecha_aceptacion),
    grupoArticulo: s(r.grupo_articulo) || null,
    nombreGrupoArticulo: s(r.nombre_grupo_articulo) || null,
    categoria: s(r.categoria) || null,
    subcategoria: s(r.subcategoria) || null,
    nombreCentro: s(r.nombre_centro) || null,
    descripcionMaterial: s(r.descripcion_material) || null,
    valorUnitario: n(r.valor_unitario),
    valorTotal: n(r.valor_total),
    valorUnitUsd: n(r.valor_unit_usd),
    valorTotalUsd: n(r.valor_total_usd),
    valorPendienteUsd: n(r.valor_pendiente_usd),
    valorPendienteCop: n(r.valor_pendiente_cop),
    moneda: s(r.moneda) || null,
    monedaPedido: s(r.moneda_pedido) || null,
    fechaOrden: d(r.fecha_orden),
    fechaCompromiso: d(r.fecha_compromiso),
    fechaRecepcion: d(r.fecha_recepcion),
    descripcionIncoterms: s(r.descripcion_incoterms) || null,
    tipoCompra: (s(r.tipo_compra) as TipoCompra) || "Nacional",
    paisOrigen: s(r.pais_origen) || null,
    paisProcedencia: s(r.pais_procedencia) || null,
    forwarder: s(r.forwarder) || null,
    naviera: s(r.naviera) || null,
    bl: s(r.bl) || null,
    awb: s(r.awb) || null,
    contenedor: s(r.contenedor) || null,
    fechaNacionalizacion: d(r.fecha_nacionalizacion),
    fechaPuerto: d(r.fecha_puerto),
    fechaBodega: d(r.fecha_bodega),
    statusGeneral: s(r.status_general) || null,
    detalleStatus: s(r.detalle_status) || null,
    categoriaSeguimiento: s(r.categoria_seguimiento) || s((r as any)["b y"]) || s((r as any).by) || null,
    fechaSeguimiento: d(r.fecha_seguimiento),
    diasIncumplimiento: n(r.dias_incumplimiento),
    fechaNotificacionProveedor: d(r.fecha_notificacion_proveedor),
    compromisoProveedor: d(r.compromiso_proveedor),
    estadoEntrega: (() => {
      const direct = s(r.estado_entrega) || null;
      if (direct) return direct;
      // Fallback: si status_general tiene un valor BF (rescatado durante el import),
      // usarlo como estadoEntrega para sobrevivir recargas de página.
      const sg = s(r.status_general).toLowerCase().trim();
      const isBF = sg === "borrado" || sg.startsWith("borr") || sg.includes("parcial")
        || sg === "entregado" || sg === "sin entrega" || sg === "sin entregar";
      return isBF ? s(r.status_general) : null;
    })(),
    estadoAdicional: s(r.estado_adicional) || null,
    rangoInspeccion: s(r.rango_inspeccion) || null,
    rangoIncumplimientoInformado: s(r.rango_incumplimiento_informado) || null,
    controlIncumplimiento: s(r.control_incumplimiento) || null,
    anio: n(r.anio),
    mes: n(r.mes),
  };
}

function jobToRow(j: Partial<Job>): Row {
  const r: Row = {};
  const set = (k: string, v: unknown) => { if (v !== undefined && v !== null) r[k] = v === "" ? null : v; };
  set("bdp_job", j.bdpJob);
  set("cliente", j.cliente);
  set("status", j.status);
  set("origen", j.origen);
  set("destino", j.destino);
  set("carrier", j.carrier);
  set("eta", j.eta || null);
  set("ata", j.ata || null);
  set("aduana", j.aduana || null);
  set("factura", j.factura || null);
  set("peso", j.peso);
  set("teus", j.teus);
  set("modo", j.modo);
  set("responsable", j.responsable);
  set("centro", j.centro);
  set("prioridad", j.prioridad);
  set("fecha_creacion", j.fechaCreacion || null);
  set("observaciones", j.observaciones);
  set("escalado", j.escalado);
  set("numero", j.numero ?? null);
  set("incoterms", j.incoterms);
  set("proveedor", j.proveedor);
  set("oc", j.oc);
  set("posicion", j.posicion);
  set("codigo_sap", j.codigoSap);
  set("material", j.material);
  set("um", j.um);
  set("qty", j.qty ?? null);
  set("qty_entregada", j.qtyEntregada ?? null);
  set("qty_pendiente", j.qtyPendiente ?? null);
  set("fecha_entrega_contractual", j.fechaEntregaContractual || null);
  set("modalidad_impo", j.modalidadImpo);
  set("lugar_llegada", j.lugarLlegada);
  set("etd_origen", j.etdOrigen || null);
  set("eta_puerto", j.etaPuerto || null);
  set("eta_campo", j.etaCampo || null);
  set("do_num", j.doNum);
  set("invoice", j.invoice);
  set("asunto_correo", j.asuntoCorreo);
  set("motivo_retraso", j.motivoRetraso);
  set("criterio_retraso", j.criterioRetraso);
  set("sociedad", j.sociedad);
  set("cuenta", j.cuenta);
  set("colector_costo", j.colectorCosto);
  set("afe_proyecto", j.afeProyecto);
  set("assets", j.assets);
  set("gerencia", j.gerencia);
  set("campo", j.campo);
  set("equipo", j.equipo);
  set("customer", j.customer);
  set("comprador", j.comprador);
  set("descripcion_material", j.descripcionMaterial);
  set("valor_unitario", j.valorUnitario ?? null);
  set("valor_total", j.valorTotal ?? null);
  set("fecha_orden", j.fechaOrden || null);
  set("fecha_compromiso", j.fechaCompromiso || null);
  set("fecha_recepcion", j.fechaRecepcion || null);
  set("descripcion_incoterms", j.descripcionIncoterms);
  set("tipo_compra", j.tipoCompra);
  set("pais_origen", j.paisOrigen);
  set("pais_procedencia", j.paisProcedencia);
  set("forwarder", j.forwarder);
  set("naviera", j.naviera);
  set("bl", j.bl);
  set("awb", j.awb);
  set("contenedor", j.contenedor);
  set("fecha_nacionalizacion", j.fechaNacionalizacion || null);
  set("fecha_puerto", j.fechaPuerto || null);
  set("fecha_bodega", j.fechaBodega || null);
  set("solicitante", j.solicitante);
  set("fecha_aceptacion", j.fechaAceptacion || null);
  set("grupo_articulo", j.grupoArticulo);
  set("nombre_grupo_articulo", j.nombreGrupoArticulo);
  set("categoria", j.categoria);
  set("subcategoria", j.subcategoria);
  set("nombre_centro", j.nombreCentro);
  set("valor_unit_usd", j.valorUnitUsd ?? null);
  set("valor_total_usd", j.valorTotalUsd ?? null);
  set("valor_pendiente_usd", j.valorPendienteUsd ?? null);
  set("valor_pendiente_cop", j.valorPendienteCop ?? null);
  set("moneda", j.moneda);
  set("moneda_pedido", j.monedaPedido);
  set("status_general", j.statusGeneral);
  set("detalle_status", j.detalleStatus);
  set("categoria_seguimiento", j.categoriaSeguimiento);
  set("fecha_seguimiento", j.fechaSeguimiento || null);
  set("dias_incumplimiento", j.diasIncumplimiento ?? null);
  set("fecha_notificacion_proveedor", j.fechaNotificacionProveedor || null);
  set("compromiso_proveedor", j.compromisoProveedor || null);

  // Dashboard Gerencial
  set("estado_entrega", j.estadoEntrega);
  set("estado_adicional", j.estadoAdicional);
  set("rango_inspeccion", j.rangoInspeccion);
  set("rango_incumplimiento_informado", j.rangoIncumplimientoInformado);
  set("control_incumplimiento", j.controlIncumplimiento);
  set("anio", j.anio ?? null);
  set("mes", j.mes ?? null);

  // LLAVE compuesta
  if (j.oc !== undefined || j.posicion !== undefined || j.llave !== undefined) {
    const oc = (j.oc ?? "").toString().trim();
    const pos = (j.posicion ?? "").toString().trim();
    set("llave", j.llave ?? (oc ? (pos ? `${oc}-${pos.padStart(2, "0")}` : oc) : null));
  }
  return r;
}

export const useJobsStore = create<JobsState>()((set, get) => ({
  jobs: [],
  loading: false,
  lastImport: null,

  loadFromCloud: async () => {
    set({ loading: true });
    // Paginar: PostgREST limita por defecto a 1000 filas por request,
    // así que recorremos en bloques hasta agotar la tabla.
    const pageSize = 1000;
    const all: Row[] = [];
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) { console.error(error); set({ loading: false }); return; }
      const rows = (data ?? []) as Row[];
      all.push(...rows);
      if (rows.length < pageSize) break;
      if (all.length > 200000) break; // tope de seguridad
    }
    set({ jobs: all.map((r) => rowToJob(r)), loading: false });
  },

  setJobs: (jobs) => set({ jobs }),

  addJobs: async (newJobs, fileName) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const inserted: Job[] = [];
    const errors: string[] = [];
    const chunkSize = 500;

    const extractMissingColumns = (message: string) => {
      const matches = [...message.matchAll(/Could not find the ['"]([^'"]+)['"] column of ['"]jobs['"] in the schema cache/gi)];
      return matches.map((m) => m[1]);
    };

    const stripColumns = (rows: Row[], columns: string[]) => {
      return rows.map((row) => {
        const copy = { ...row };
        columns.forEach((column) => {
          if (column in copy) {
            delete copy[column];
          }
        });
        return copy;
      });
    };

    for (let i = 0; i < newJobs.length; i += chunkSize) {
      const chunk = newJobs.slice(i, i + chunkSize);
      const rows = chunk.map((j) => {
        const row = jobToRow(j);
        if (userId) row.created_by = userId;
        return row;
      });
      // Conservar las filas originales (con todos los campos) para el estado local,
      // incluso si Supabase elimina columnas que aún no están en su schema cache.
      const originalRows = rows.map((r) => ({ ...r }));

      let attempt = 0;
      let currentRows = rows;
      while (attempt < 20) {
        const { data, error } = await supabase.from("jobs").insert(currentRows as never).select();
        if (!error) {
          const returnedRows = (data ?? []) as Row[];
          for (let k = 0; k < returnedRows.length; k++) {
            // Usar originalRows para preservar campos que Supabase pudo haber ignorado.
            // returnedRows va primero (trae id, created_at, etc.), luego originalRow
            // sobreescribe para que los nulos de Supabase no borren valores importados.
            const originalRow = originalRows[k] ?? {};
            const mergedRow = { ...returnedRows[k], ...originalRow };
            inserted.push(rowToJob(mergedRow));
          }
          break;
        }

        const missing = extractMissingColumns(error.message);
        if (!missing.length) {
          console.error("Error inserting jobs chunk:", error);
          errors.push(error.message);
          break;
        }

        currentRows = stripColumns(currentRows, missing);
        attempt++;
      }
    }

    if (inserted.length > 0) {
      // Recargar desde Supabase para tener datos exactos (sin merge local con fallbacks)
      set({ lastImport: { date: new Date().toISOString(), count: inserted.length, fileName } });
      await get().loadFromCloud();
    }
    return { insertedCount: inserted.length, errors };
  },

  addJob: async (job) => {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const row = jobToRow(job);
    if (userId) row.created_by = userId;

    const insertWithFallback = async (currentRow: Row) => {
      let attempt = 0;
      let payload = { ...currentRow };
      while (attempt < 20) {
        const { data, error } = await supabase.from("jobs").insert(payload as never).select().single();
        if (!error) return data as Row;
        const missing = [...error.message.matchAll(/Could not find the ['"]([^'"]+)['"] column of ['"]jobs['"] in the schema cache/gi)].map((m) => m[1]);
        if (!missing.length) {
          console.error(error);
          return null;
        }
        missing.forEach((column) => delete payload[column]);
        attempt++;
      }
      return null;
    };

    const data = await insertWithFallback(row);
    if (!data) return;
    const mergedRow = { ...row, ...(data as Row) };
    set((st) => ({ jobs: [rowToJob(mergedRow), ...st.jobs] }));
  },

  updateJob: async (id, patch) => {
    const patchRow = jobToRow(patch);

    const updateWithFallback = async (currentRow: Row) => {
      let attempt = 0;
      let payload = { ...currentRow };
      while (attempt < 20) {
        const { data, error } = await supabase.from("jobs").update(payload as never).eq("id", id).select().single();
        if (!error) return data as Row;
        const missing = [...error.message.matchAll(/Could not find the ['"]([^'"]+)['"] column of ['"]jobs['"] in the schema cache/gi)].map((m) => m[1]);
        if (!missing.length) {
          console.error(error);
          return null;
        }
        missing.forEach((column) => delete payload[column]);
        attempt++;
      }
      return null;
    };

    const data = await updateWithFallback(patchRow);
    if (!data) return;
    const existing = get().jobs.find((j) => j.id === id);
    const existingRow = existing ? jobToRow(existing) : {};
    const mergedRow = { ...existingRow, ...patchRow, ...(data as Row) };
    const updated = rowToJob(mergedRow);
    set((st) => ({ jobs: st.jobs.map((j) => (j.id === id ? updated : j)) }));
  },

  deleteJob: async (id) => {
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) { console.error(error); return; }
    set((st) => ({ jobs: st.jobs.filter((j) => j.id !== id) }));
  },

  resetToDemo: async () => {
    await supabase.from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    set({ jobs: [], lastImport: null });
    void seedJobs;
  },

  clearAll: async () => {
    await supabase.from("jobs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    set({ jobs: [], lastImport: null });
    void get();
  },
}));

export type { Job, JobStatus };
