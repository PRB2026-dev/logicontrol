export type JobStatus =
  | "Booking"
  | "En tránsito"
  | "Arribado"
  | "Aduana"
  | "Entregado"
  | "Facturado"
  | "Cerrado"
  | "Demorado";

export type Priority = "Baja" | "Media" | "Alta" | "Crítica";

export type TipoCompra = "Nacional" | "Importación";

export type Moneda = "USD" | "COP" | "EUR";

/** Estado derivado de la línea según el documento (Módulo 1). */
export type LineStatus = "Entregado" | "Parcial" | "Pendiente" | "Vencido" | "Próximo a Vencer";

export interface Job {
  id: string;
  /** Llave compuesta: OC + posición (LLAVE 1 + LLAVE 2). */
  llave?: string | null;
  // Legacy / display
  bdpJob: string;
  cliente: string;
  status: JobStatus;
  origen: string;
  destino: string;
  carrier: string;
  eta: string;
  ata: string | null;
  aduana: string | null;
  factura: string | null;
  peso: number;
  teus: number;
  modo: "Marítimo" | "Aéreo" | "Terrestre";
  responsable: string;
  centro: string;
  prioridad: Priority;
  fechaCreacion: string;
  observaciones: string;
  escalado: boolean;
  // === IMPORTACIONES / Seguimiento ===
  numero?: number | null;
  incoterms?: string | null;
  proveedor?: string | null;
  oc?: string | null;
  posicion?: string | null;
  codigoSap?: string | null;
  material?: string | null;
  um?: string | null;
  qty?: number | null;
  qtyEntregada?: number | null;
  qtyPendiente?: number | null;
  fechaEntregaContractual?: string | null;
  modalidadImpo?: string | null;
  lugarLlegada?: string | null;
  etdOrigen?: string | null;
  etaPuerto?: string | null;
  etaCampo?: string | null;
  doNum?: string | null;
  invoice?: string | null;
  asuntoCorreo?: string | null;
  motivoRetraso?: string | null;
  criterioRetraso?: string | null;
  // === Organizacional ===
  sociedad?: string | null;
  cuenta?: string | null;
  colectorCosto?: string | null;
  afeProyecto?: string | null;
  assets?: string | null;
  gerencia?: string | null;
  campo?: string | null;
  // === Comercial ===
  customer?: string | null;
  comprador?: string | null;
  solicitante?: string | null;
  fechaAceptacion?: string | null;
  grupoArticulo?: string | null;
  nombreGrupoArticulo?: string | null;
  categoria?: string | null;
  subcategoria?: string | null;
  nombreCentro?: string | null;
  // === Orden ===
  descripcionMaterial?: string | null;
  valorUnitario?: number | null;
  valorTotal?: number | null;
  valorUnitUsd?: number | null;
  valorTotalUsd?: number | null;
  valorPendienteUsd?: number | null;
  valorPendienteCop?: number | null;
  moneda?: Moneda | string | null;
  monedaPedido?: Moneda | string | null;
  fechaOrden?: string | null;
  fechaCompromiso?: string | null;
  fechaRecepcion?: string | null;
  descripcionIncoterms?: string | null;
  // === Seguimiento ===
  statusGeneral?: string | null;
  detalleStatus?: string | null;
  categoriaSeguimiento?: string | null;
  fechaSeguimiento?: string | null;
  diasIncumplimiento?: number | null;
  fechaNotificacionProveedor?: string | null;
  compromisoProveedor?: string | null;
  // === Importación ===
  tipoCompra?: TipoCompra | null;
  paisOrigen?: string | null;
  paisProcedencia?: string | null;
  forwarder?: string | null;
  naviera?: string | null;
  bl?: string | null;
  awb?: string | null;
  contenedor?: string | null;
  fechaNacionalizacion?: string | null;
  fechaPuerto?: string | null;
  fechaBodega?: string | null;
  // === Filtros operativos OC activa (BF, BH del consolidado) ===
  estadoEntrega?: string | null;   // Columna BF
  estadoAdicional?: string | null; // Columna BH (Clasificación L/0/B)
  // === Dashboard gerencial (Data Final) ===
  rangoInspeccion?: string | null;             // Columna BL
  rangoIncumplimientoInformado?: string | null; // Columna BM
  controlIncumplimiento?: string | null;        // Columna BN
  anio?: number | null;                          // Columna CO
  mes?: number | null;                           // Columna CP (1-12)
}

export const jobs: Job[] = [
  {
    id: "demo-1",
    bdpJob: "OC-001",
    cliente: "CLIENTE DEMO",
    status: "En tránsito",
    origen: "China",
    destino: "Bogotá",
    carrier: "APL",
    eta: "2026-07-15",
    ata: null,
    aduana: null,
    factura: null,
    peso: 1000,
    teus: 2,
    modo: "Marítimo",
    responsable: "Demo User",
    centro: "Operaciones",
    prioridad: "Media",
    fechaCreacion: "2026-06-01",
    observaciones: "Demostración",
    escalado: false,
    oc: "OC-001",
    material: "Material Demo",
    qty: 100,
    qtyEntregada: 50,
    estadoEntrega: "Entregado Parcial",
    estadoAdicional: "L",
    gerencia: "Gerencia Demo",
    campo: "Campo Demo",
    cuenta: "Cuenta Demo",
    valorTotalUsd: 10000,
    anio: 2026,
    mes: 6,
  },
  {
    id: "demo-2",
    bdpJob: "OC-002",
    cliente: "CLIENTE DEMO 2",
    status: "Entregado",
    origen: "USA",
    destino: "Cali",
    carrier: "MSC",
    eta: "2026-06-10",
    ata: "2026-06-10",
    aduana: "2026-06-11",
    factura: "2026-06-12",
    peso: 500,
    teus: 1,
    modo: "Marítimo",
    responsable: "Demo User",
    centro: "Operaciones",
    prioridad: "Alta",
    fechaCreacion: "2026-05-01",
    observaciones: "Entregado a tiempo",
    escalado: false,
    oc: "OC-002",
    material: "Material Demo 2",
    qty: 200,
    qtyEntregada: 200,
    estadoEntrega: "Entregado",
    estadoAdicional: "0",
    gerencia: "Gerencia Demo",
    campo: "Campo Demo",
    cuenta: "Cuenta Demo",
    valorTotalUsd: 15000,
    anio: 2026,
    mes: 5,
  },
  {
    id: "demo-3",
    bdpJob: "OC-003",
    cliente: "CLIENTE DEMO 3",
    status: "En tránsito",
    origen: "Europa",
    destino: "Medellín",
    carrier: "Maersk",
    eta: "2026-07-20",
    ata: null,
    aduana: null,
    factura: null,
    peso: 800,
    teus: 1.5,
    modo: "Marítimo",
    responsable: "Demo User",
    centro: "Operaciones",
    prioridad: "Crítica",
    fechaCreacion: "2026-06-05",
    observaciones: "Pendiente de entrega",
    escalado: false,
    oc: "OC-003",
    material: "Material Demo 3",
    qty: 150,
    qtyEntregada: 0,
    estadoEntrega: "Sin entrega",
    estadoAdicional: "L",
    gerencia: "Gerencia Demo",
    campo: "Campo Demo",
    cuenta: "Cuenta Demo",
    valorTotalUsd: 20000,
    anio: 2026,
    mes: 6,
  },
];

export const statusColors: Record<JobStatus, string> = {
  Booking: "bg-muted text-muted-foreground",
  "En tránsito": "bg-info/15 text-info border border-info/30",
  Arribado: "bg-chart-1/15 text-chart-1 border border-chart-1/30",
  Aduana: "bg-warning/15 text-warning border border-warning/40",
  Entregado: "bg-success/15 text-success border border-success/30",
  Facturado: "bg-chart-2/15 text-chart-2 border border-chart-2/30",
  Cerrado: "bg-secondary text-secondary-foreground border border-border",
  Demorado: "bg-destructive/15 text-destructive border border-destructive/30",
};

export const priorityColors: Record<Priority, string> = {
  Baja: "bg-muted text-muted-foreground border border-border",
  Media: "bg-info/15 text-info border border-info/30",
  Alta: "bg-warning/15 text-warning border border-warning/40",
  Crítica: "bg-destructive/15 text-destructive border border-destructive/30",
};

export const lineStatusColors: Record<LineStatus, string> = {
  Entregado: "bg-success/15 text-success border border-success/30",
  Parcial: "bg-info/15 text-info border border-info/30",
  Pendiente: "bg-muted text-muted-foreground border border-border",
  "Próximo a Vencer": "bg-warning/15 text-warning border border-warning/40",
  Vencido: "bg-destructive/15 text-destructive border border-destructive/30",
};
