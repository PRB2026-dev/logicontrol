import type { Job, JobStatus, Priority } from "./jobs-data";

const STATUS_MAP: Record<string, JobStatus> = {
  booking: "Booking",
  "en transito": "En tránsito",
  "en tránsito": "En tránsito",
  transito: "En tránsito",
  transit: "En tránsito",
  "in transit": "En tránsito",
  arribado: "Arribado",
  arrived: "Arribado",
  aduana: "Aduana",
  customs: "Aduana",
  entregado: "Entregado",
  delivered: "Entregado",
  facturado: "Facturado",
  invoiced: "Facturado",
  billed: "Facturado",
  cerrado: "Cerrado",
  closed: "Cerrado",
  demorado: "Demorado",
  delayed: "Demorado",
  aceptado: "Entregado",
};

const PRIORITY_MAP: Record<string, Priority> = {
  baja: "Baja", low: "Baja",
  media: "Media", medium: "Media", normal: "Media",
  alta: "Alta", high: "Alta",
  critica: "Crítica", "crítica": "Crítica", critical: "Crítica", urgent: "Crítica",
};

type AliasField = keyof Job;
const ALIASES: Partial<Record<AliasField, string[]>> = {
  // === IMPORTACIONES ===
  numero: ["no", "no.", "n", "numero"],
  incoterms: ["incoterms"],
  descripcionIncoterms: ["descripcion incoterms", "descripción incoterms"],
  proveedor: ["nombre del proveedor", "proveedor", "acreedor", "razon social", "razón social"],
  oc: ["numero de la orden de compra", "número de la orden de compra", "no orden de compra", "n orden de compra", "orden de compra", "no oc", "n oc", "# oc", "numero oc", "número oc", "orden compra"],
  posicion: ["posicion", "posición", "pos", "item", "llave 2"],
  llave: ["llave", "key"],
  codigoSap: ["codigo sap del material", "código sap del material", "codigo sap", "código sap", "material sap", "sap"],
  material: ["texto breve del material", "texto breve", "descripcion material", "descripción material", "descripcion", "material"],
  descripcionMaterial: ["descripcion material", "descripción material", "descripcion del material"],
  um: ["u m", "um", "unidad", "uom"],
  qty: ["cantidad contractual", "cantidad", "qty", "cantidad pedida", "cantidad ordenada", "cant ordenada"],
  qtyEntregada: ["cantidad entregada", "cant entr", "cant. entr", "cant entr.", "qty entregada", "cantidad recibida"],
  qtyPendiente: ["cant pendiente por entregar", "cant. pendiente por entregar", "cantidad pendiente", "qty pendiente", "saldo", "saldo pendiente"],
  valorUnitario: ["valor unitario cop", "valor unit cop", "valor unit", "valor unitario", "precio unitario", "v unitario", "vlr unit"],
  valorTotal: ["valor total de la odc en cop", "valor total odc cop", "valor total cop", "vlr total cop", "valor total de la odc", "vlr total", "valor total", "valor", "monto", "total"],
  valorUnitUsd: ["valor unitario usd", "valor unit usd", "vlr unit usd", "precio unitario usd"],
  valorTotalUsd: ["valor total de la odc en usd", "valor total odc usd", "valor total usd", "vlr total usd", "valor comprado usd"],
  valorPendienteUsd: ["valor x entregar usd", "valor por entregar usd", "valor pendiente x entregar usd", "valor pendiente entregar usd", "valor pendiente usd"],
  valorPendienteCop: ["valor x entregar cop", "valor por entregar cop", "valor pendiente x entregar cop", "valor pendiente entregar cop", "valor pendiente cop"],
  moneda: ["moneda"],
  monedaPedido: ["moneda del pedido", "moneda pedido"],
  fechaOrden: ["fecha creacion de la odc", "fecha creación de la odc", "fecha orden", "fecha oc", "fecha de orden"],
  fechaCompromiso: ["compromiso fecha de entrega del proveedor", "fecha compromiso", "fecha de compromiso", "fecha entrega"],
  fechaRecepcion: ["fecha real de entrega", "fecha recepcion", "fecha recepción", "fecha de recepcion"],
  fechaEntregaContractual: ["fecha de entrega contractual", "fecha entrega contractual", "fecha entrega"],
  destino: ["destino", "ciudad destino"],
  modalidadImpo: ["modalidad impo", "modalidad", "modo impo"],
  lugarLlegada: ["lugar de llegada", "lugar llegada"],
  etdOrigen: ["etd", "etd (origen)", "etd origen"],
  etaPuerto: ["eta (puerto)", "eta puerto"],
  etaCampo: ["eta (campo)", "eta campo", "eta destino final"],
  observaciones: ["observaciones", "comments", "notes", "remarks"],
  doNum: ["do", "d o", "no do"],
  invoice: ["invoice", "factura", "no factura"],
  asuntoCorreo: ["asunto correo", "asunto"],
  // Organizacional
  sociedad: ["sociedad", "company code"],
  cuenta: ["cuenta", "account"],
  colectorCosto: ["colector de costo", "colector costo"],
  afeProyecto: ["afe", "proyecto", "afe proyecto", "afe & proyecto"],
  assets: ["assets", "activo"],
  gerencia: ["gerencia", "manager"],
  campo: ["campo", "field"],
  // Comercial
  customer: ["customer", "cust"],
  comprador: ["comprador", "buyer", "crictividad de la odc comprador", "criticidad de la odc comprador", "cricticidad de la odc comprador", "criticidad de la odc"],
  solicitante: ["solicitante"],
  fechaAceptacion: ["fecha aceptacion", "fecha aceptación"],
  grupoArticulo: ["grupo de articulo", "grupo de artículo", "grupo articulo"],
  nombreGrupoArticulo: ["nombre grupo articulo", "nombre grupo artículo"],
  categoria: ["categoria", "categoría"],
  subcategoria: ["subcategoria", "subcategoría"],
  nombreCentro: ["nombre del centro", "nombre centro"],
  // Seguimiento
  statusGeneral: ["status general", "status"],
  detalleStatus: ["detalle status"],
  categoriaSeguimiento: ["categorias seguimiento", "categorías seguimiento", "categoria seguimiento"],
  fechaSeguimiento: ["fecha actual de seguimiento", "fecha seguimiento"],
  diasIncumplimiento: ["dias de incumplimiento", "días de incumplimiento"],
  fechaNotificacionProveedor: ["fecha de notificacion proveedor", "fecha de notificación proveedor"],
  compromisoProveedor: ["compromiso fecha de entrega del proveedor"],
  // Importación
  tipoCompra: ["tipo compra", "tipo de compra"],
  paisOrigen: ["pais origen", "país origen", "country of origin"],
  paisProcedencia: ["pais procedencia", "país procedencia"],
  forwarder: ["forwarder", "agente carga"],
  naviera: ["naviera", "shipping line"],
  bl: ["bl", "b l", "bill of lading"],
  awb: ["awb", "air waybill"],
  contenedor: ["contenedor", "container"],
  fechaNacionalizacion: ["fecha nacionalizacion", "fecha nacionalización", "nacionalizacion"],
  fechaPuerto: ["fecha puerto"],
  fechaBodega: ["fecha bodega", "fecha entrega bodega"],
  // legacy fallback
  bdpJob: ["bdp job", "bdp", "job", "job no", "llave", "id"],
  cliente: ["cliente", "consignee"],
  status: ["status", "shipment status", "estado expediting", "estado st"],
  carrier: ["carrier", "linea"],
  eta: ["eta", "fecha eta"],
  ata: ["ata", "fecha ata"],
  aduana: ["aduana", "fecha aduana"],
  factura: ["factura", "fecha factura"],
  peso: ["peso", "weight", "kg"],
  teus: ["teus", "teu"],
  modo: ["modo", "mode", "modo transporte"],
  responsable: ["responsable", "responsable de seguimiento", "owner"],
  centro: ["centro", "nombre del centro", "nombre centro de costo", "centro de costo"],
  prioridad: ["prioridad", "priority", "criticidad"],
  fechaCreacion: ["fecha creacion", "fecha creación", "creation date"],
  motivoRetraso: ["motivo retraso", "motivo de retraso"],
  criterioRetraso: ["criterio retraso", "criterios de retraso"],
  estadoEntrega: ["estado de entrega", "estado entrega", "estado de la entrega", "estado bf", "delivery status", "estado final", "estado_entrega", "estado_bf", "estado"],
  estadoAdicional: ["estado adicional", "estado bh", "marca activa", "estado oc", "estado de oc", "clasificacion", "clasificación", "estado_adicional"],
  rangoInspeccion: ["rango inspeccion", "rango inspección", "rango de inspeccion"],
  rangoIncumplimientoInformado: ["rango incumplimiento informado", "rango de incumplimiento informado"],
  controlIncumplimiento: ["control incumplimiento", "control de incumplimiento"],
  anio: ["año", "ano", "anio", "year"],
  mes: ["mes", "month"],
  origen: ["origen", "origin", "pol"],

};

function normHeader(s: unknown): string {
  return String(s ?? "").toLowerCase().trim().replace(/[._\-()/]+/g, " ").replace(/\s+/g, " ");
}

function buildHeaderMap(headers: unknown[]): Partial<Record<AliasField, number>> {
  const map: Partial<Record<AliasField, number>> = {};
  const normalized = headers.map(normHeader);
  const taken = new Set<number>();
  (Object.keys(ALIASES) as AliasField[]).forEach((field) => {
    const aliases = ALIASES[field]!;
    // Iterate aliases in priority order: first alias listed wins.
    let idx = -1;
    for (const a of aliases) {
      const found = normalized.findIndex((h, i) => h === a && !taken.has(i));
      if (found >= 0) { idx = found; break; }
    }
    if (idx < 0) {
      for (const a of aliases) {
        if (!a.includes(" ")) continue;
        const found = normalized.findIndex((h, i) => h && h.includes(a) && !taken.has(i));
        if (found >= 0) { idx = found; break; }
      }
    }
    if (idx >= 0) { map[field] = idx; taken.add(idx); }
  });
  if (map.valorTotal !== undefined && normalized[map.valorTotal]?.includes("usd") && map.valorTotal === map.valorTotalUsd) {
    delete map.valorTotal;
  }
  return map;
}

function parseDate(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s || /missing|no revised|^-$|n\/a/i.test(s)) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const m = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (m) {
    const [, dd, mm, yy] = m;
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    const dt = new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  return null;
}

function parseNum(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let cleaned = String(v).replace(/[^\d.,-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    cleaned = lastComma > lastDot ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    const decimals = cleaned.length - lastComma - 1;
    cleaned = decimals === 3 ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".");
  } else if ((cleaned.match(/\./g) ?? []).length > 1) {
    cleaned = cleaned.replace(/\./g, "");
  } else if (lastDot >= 0 && cleaned.length - lastDot - 1 === 3) {
    cleaned = cleaned.replace(/\./g, "");
  }
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseStatus(v: unknown): JobStatus {
  const key = String(v ?? "").toLowerCase().trim();
  if (!key) return "Booking";
  return STATUS_MAP[key] ?? STATUS_MAP[key.replace(/\s+/g, " ")] ?? "Booking";
}

function parseModo(v: unknown): Job["modo"] {
  const s = String(v ?? "").toLowerCase().trim();
  if (s.startsWith("aer") || s.startsWith("air")) return "Aéreo";
  if (s.includes("truck") || s.startsWith("ter") || s.startsWith("road") || s.startsWith("land")) return "Terrestre";
  return "Marítimo";
}

function parsePriority(v: unknown, aging: number): Priority {
  const key = String(v ?? "").toLowerCase().trim();
  if (PRIORITY_MAP[key]) return PRIORITY_MAP[key];
  if (aging > 10) return "Crítica";
  if (aging > 5) return "Alta";
  if (aging > 2) return "Media";
  return "Baja";
}

function deriveStatus(raw: unknown, etaCampo: string | null, qty: number, qtyEntregada: number): JobStatus {
  const s = parseStatus(raw);
  if (raw && String(raw).trim()) return s;
  if (qty > 0 && qtyEntregada >= qty) return "Entregado";
  if (etaCampo) {
    const today = new Date();
    const eta = new Date(etaCampo);
    if (eta < today && qtyEntregada < qty) return "Demorado";
    return "En tránsito";
  }
  return "Booking";
}

export interface ParseResult {
  jobs: Job[];
  totalRows: number;
  mappedFields: AliasField[];
  unmappedHeaders: string[];
  errors: { row: number; message: string }[];
}

export function parseRowsToJobs(rows: unknown[][]): ParseResult {
  if (rows.length === 0) {
    return { jobs: [], totalRows: 0, mappedFields: [], unmappedHeaders: [], errors: [{ row: 0, message: "Archivo vacío" }] };
  }
  const headerIndex = rows
    .slice(0, 20)
    .map((candidate, i) => ({ i, score: Object.keys(buildHeaderMap(candidate as unknown[])).length }))
    .sort((a, b) => b.score - a.score)[0]?.i ?? 0;
  const headers = rows[headerIndex] as unknown[];
  const map = buildHeaderMap(headers);
  // Fallback por POSICIÓN de columna (0-indexed) cuando los encabezados no
  // coinciden con los alias conocidos. BC=54 (Valor OC USD), BF=57 (Estado
  // de entrega), BH=59 (Estado adicional). Solo se asignan si la celda
  // del encabezado existe en esa posición.
  const COL = { G: 6, K: 10, M: 12, T: 19, AO: 40, BC: 54, BF: 57, BH: 59, BK: 62, BL: 63, BM: 64, BN: 65, BY: 76, CE: 82, CO: 92, CP: 93 } as const;
  if (map.cuenta === undefined && headers.length > COL.G) map.cuenta = COL.G;
  if (map.gerencia === undefined && headers.length > COL.K) map.gerencia = COL.K;
  if (map.campo === undefined && headers.length > COL.M) map.campo = COL.M;
  if (map.oc === undefined && headers.length > COL.T) map.oc = COL.T;
  if (map.qty === undefined && headers.length > COL.AO) map.qty = COL.AO;
  if (map.valorTotalUsd === undefined && headers.length > COL.BC) map.valorTotalUsd = COL.BC;
  if (map.estadoAdicional === undefined && headers.length > COL.BH) map.estadoAdicional = COL.BH;
  if (map.diasIncumplimiento === undefined && headers.length > COL.BK) map.diasIncumplimiento = COL.BK;
  if (map.rangoInspeccion === undefined && headers.length > COL.BL) map.rangoInspeccion = COL.BL;
  if (map.rangoIncumplimientoInformado === undefined && headers.length > COL.BM) map.rangoIncumplimientoInformado = COL.BM;
  if (map.controlIncumplimiento === undefined && headers.length > COL.BN) map.controlIncumplimiento = COL.BN;
  if (map.categoriaSeguimiento === undefined && headers.length > COL.BY) map.categoriaSeguimiento = COL.BY;
  if (map.fechaSeguimiento === undefined && headers.length > COL.CE) map.fechaSeguimiento = COL.CE;
  if (map.anio === undefined && headers.length > COL.CO) map.anio = COL.CO;
  if (map.mes === undefined && headers.length > COL.CP) map.mes = COL.CP;

  // Detección inteligente de la columna BF (Estado Entrega):
  // Escanea todas las columnas buscando la que tenga ≥50% de sus valores
  // como uno de los 4 estados conocidos, sin depender de la posición fija.
  if (map.estadoEntrega === undefined) {
    // Función que detecta si un valor es un estado BF válido (incluye variantes)
    const isBFVal = (v: string) =>
      v === "borrado" || v.startsWith("borr") ||
      v.includes("parcial") ||
      v === "entregado" || v === "completo" || v === "completado" || v === "delivered" ||
      v === "sin entrega" || v === "sin entregar" || v === "pendiente" || v === "no entregado";
    const sampleRows = rows.slice(headerIndex + 1, Math.min(headerIndex + 51, rows.length));
    let bestCol = -1;
    let bestMatch = 0;
    for (let col = 0; col < headers.length; col++) {
      const vals = sampleRows
        .map((r) => String(((r as unknown[])[col]) ?? "").toLowerCase().trim())
        .filter((v) => v.length > 0);
      if (vals.length < 2) continue;
      const matchCount = vals.filter((v) => isBFVal(v)).length;
      const ratio = matchCount / vals.length;
      if (ratio >= 0.5 && matchCount > bestMatch) {
        bestMatch = matchCount;
        bestCol = col;
      }
    }
    if (bestCol >= 0) {
      map.estadoEntrega = bestCol;
    } else if (headers.length > COL.BF) {
      // Fallback a posición fija BF=57 si el escaneo no encontró nada
      map.estadoEntrega = COL.BF;
    }
  }
  const mappedFields = Object.keys(map) as AliasField[];
  const unmappedHeaders = headers
    .map((h, i) => ({ h: String(h ?? ""), i }))
    .filter(({ i }) => !Object.values(map).includes(i))
    .map(({ h }) => h)
    .filter(Boolean);

  // Also expose the BY column header if present as helpful info
  if (headers[COL.BY]) unmappedHeaders.push(String(headers[COL.BY] ?? ""));

  const errors: { row: number; message: string }[] = [];
  const jobs: Job[] = [];
  const today = new Date();

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === null || c === undefined || c === "")) continue;
    const get = (k: AliasField) => (map[k] !== undefined ? row[map[k]!] : undefined);

    const oc = String(get("oc") ?? "").trim();
    const bdpJob = String(get("bdpJob") ?? "").trim() || oc;
    if (!bdpJob && !oc && !get("codigoSap")) {
      continue; // fila vacía sin identificador
    }

    // Si el campo status trae un valor BF (BORRADO/ENTREGA PARCIAL/etc.),
    // se preserva en estadoEntrega y se deriva el status operativo desde qty/fechas.
    const BF_DELIVERY = new Set(["borrado", "entrega parcial", "entregado", "sin entrega", "sin entregar"]);
    const rawStatusText = String(get("status") ?? "").trim();
    const rawStatusLower = rawStatusText.toLowerCase().trim();
    const statusIsBFValue = BF_DELIVERY.has(rawStatusLower) || rawStatusLower.includes("parcial") || rawStatusLower.startsWith("borr");

    const fechaCreacion = parseDate(get("fechaCreacion")) ?? today.toISOString().slice(0, 10);
    const ata = parseDate(get("ata"));
    const aduana = parseDate(get("aduana"));
    const factura = parseDate(get("factura"));
    const etaCampo = parseDate(get("etaCampo"));
    const etaPuerto = parseDate(get("etaPuerto"));
    const etdOrigen = parseDate(get("etdOrigen"));
    const qty = parseNum(get("qty"));
    const qtyEntregada = parseNum(get("qtyEntregada"));
    const qtyPendiente = get("qtyPendiente") !== undefined ? parseNum(get("qtyPendiente")) : Math.max(0, qty - qtyEntregada);
    const aging = Math.max(0, Math.floor((today.getTime() - new Date(fechaCreacion).getTime()) / 86400000));

    // Calcular estadoEntrega antes del push para usarlo como respaldo en statusGeneral
    const estadoEntregaVal = (() => {
      const explicit = String(get("estadoEntrega") ?? "").trim() || null;
      if (explicit) return explicit;
      if (statusIsBFValue) return rawStatusText;
      return null;
    })();

    jobs.push({
      id: `imp-${Date.now()}-${r}`,
      bdpJob: bdpJob || oc || `ROW-${r}`,
      cliente: String(get("cliente") ?? get("proveedor") ?? "—").trim() || "—",
      status: statusIsBFValue
        ? deriveStatus(null, etaCampo, qty, qtyEntregada)   // derivar de qty/fechas cuando la columna tiene valor BF
        : deriveStatus(rawStatusText, etaCampo, qty, qtyEntregada),
      origen: String(get("origen") ?? "").trim(),
      destino: String(get("destino") ?? get("lugarLlegada") ?? "").trim(),
      carrier: String(get("carrier") ?? "").trim(),
      eta: etaCampo ?? etaPuerto ?? today.toISOString().slice(0, 10),
      ata,
      aduana,
      factura,
      peso: parseNum(get("peso")),
      teus: parseNum(get("teus")),
      modo: parseModo(get("modo") ?? get("modalidadImpo")),
      responsable: String(get("responsable") ?? "Sin asignar").trim() || "Sin asignar",
      centro: String(get("centro") ?? "").trim(),
      prioridad: parsePriority(get("prioridad"), aging),
      fechaCreacion,
      observaciones: String(get("observaciones") ?? "").trim(),
      escalado: false,
      // IMPORTACIONES
      numero: get("numero") != null ? Number(parseNum(get("numero"))) || null : null,
      incoterms: String(get("incoterms") ?? "").trim() || null,
      proveedor: String(get("proveedor") ?? "").trim() || null,
      oc: oc || null,
      posicion: String(get("posicion") ?? "").trim() || null,
      codigoSap: String(get("codigoSap") ?? "").trim() || null,
      material: String(get("material") ?? "").trim() || null,
      um: String(get("um") ?? "").trim() || null,
      qty,
      qtyEntregada,
      qtyPendiente,
      fechaEntregaContractual: parseDate(get("fechaEntregaContractual")),
      modalidadImpo: String(get("modalidadImpo") ?? "").trim() || null,
      lugarLlegada: String(get("lugarLlegada") ?? "").trim() || null,
      etdOrigen,
      etaPuerto,
      etaCampo,
      doNum: String(get("doNum") ?? "").trim() || null,
      invoice: String(get("invoice") ?? "").trim() || null,
      asuntoCorreo: String(get("asuntoCorreo") ?? "").trim() || null,
      motivoRetraso: String(get("motivoRetraso") ?? "").trim() || null,
      criterioRetraso: String(get("criterioRetraso") ?? "").trim() || null,
      // Organizacional
      sociedad: String(get("sociedad") ?? "").trim() || null,
      cuenta: String(get("cuenta") ?? "").trim() || null,
      colectorCosto: String(get("colectorCosto") ?? "").trim() || null,
      afeProyecto: String(get("afeProyecto") ?? "").trim() || null,
      assets: String(get("assets") ?? "").trim() || null,
      gerencia: String(get("gerencia") ?? "").trim() || null,
      campo: String(get("campo") ?? "").trim() || null,
      // Comercial
      customer: String(get("customer") ?? "").trim() || null,
      comprador: String(get("comprador") ?? "").trim() || null,
      solicitante: String(get("solicitante") ?? "").trim() || null,
      fechaAceptacion: parseDate(get("fechaAceptacion")),
      grupoArticulo: String(get("grupoArticulo") ?? "").trim() || null,
      nombreGrupoArticulo: String(get("nombreGrupoArticulo") ?? "").trim() || null,
      categoria: String(get("categoria") ?? "").trim() || null,
      subcategoria: String(get("subcategoria") ?? "").trim() || null,
      nombreCentro: String(get("nombreCentro") ?? "").trim() || null,
      // Orden
      descripcionMaterial: String(get("descripcionMaterial") ?? "").trim() || null,
      valorUnitario: get("valorUnitario") !== undefined ? parseNum(get("valorUnitario")) : null,
      valorTotal: get("valorTotal") !== undefined ? parseNum(get("valorTotal")) : null,
      valorUnitUsd: get("valorUnitUsd") !== undefined ? parseNum(get("valorUnitUsd")) : null,
      valorTotalUsd: get("valorTotalUsd") !== undefined ? parseNum(get("valorTotalUsd")) : null,
      valorPendienteUsd: get("valorPendienteUsd") !== undefined ? parseNum(get("valorPendienteUsd")) : null,
      valorPendienteCop: get("valorPendienteCop") !== undefined ? parseNum(get("valorPendienteCop")) : null,
      moneda: (String(get("moneda") ?? "").trim().toUpperCase() || null) as "USD" | "COP" | null,
      monedaPedido: (String(get("monedaPedido") ?? "").trim().toUpperCase() || null) as "USD" | "COP" | null,
      fechaOrden: parseDate(get("fechaOrden")),
      fechaCompromiso: parseDate(get("fechaCompromiso")),
      fechaRecepcion: parseDate(get("fechaRecepcion")),
      descripcionIncoterms: String(get("descripcionIncoterms") ?? "").trim() || null,
      // Importación
      tipoCompra: (String(get("tipoCompra") ?? "").trim() as "Nacional" | "Importación") || null,
      paisOrigen: String(get("paisOrigen") ?? "").trim() || null,
      paisProcedencia: String(get("paisProcedencia") ?? "").trim() || null,
      forwarder: String(get("forwarder") ?? "").trim() || null,
      naviera: String(get("naviera") ?? "").trim() || null,
      bl: String(get("bl") ?? "").trim() || null,
      awb: String(get("awb") ?? "").trim() || null,
      contenedor: String(get("contenedor") ?? "").trim() || null,
      fechaNacionalizacion: parseDate(get("fechaNacionalizacion")),
      fechaPuerto: parseDate(get("fechaPuerto")),
      fechaBodega: parseDate(get("fechaBodega")),
      // Seguimiento
      // Si el Excel no tiene columna statusGeneral propia, guardar el valor BF aquí como respaldo
      // (status_general SÍ existe en Supabase aunque estado_entrega aún no esté migrado)
      statusGeneral: (() => {
        const explicit = String(get("statusGeneral") ?? "").trim() || null;
        return explicit ?? estadoEntregaVal;
      })(),
      detalleStatus: String(get("detalleStatus") ?? "").trim() || null,
      categoriaSeguimiento: String(get("categoriaSeguimiento") ?? "").trim() || null,
      fechaSeguimiento: parseDate(get("fechaSeguimiento")),
      diasIncumplimiento: get("diasIncumplimiento") !== undefined ? parseNum(get("diasIncumplimiento")) : null,
      fechaNotificacionProveedor: parseDate(get("fechaNotificacionProveedor")),
      compromisoProveedor: parseDate(get("compromisoProveedor")),
      // LLAVE: del archivo, o computada como OC + Posición
      llave: (String(get("llave") ?? "").trim() || (oc ? `${oc}${String(get("posicion") ?? "").trim() ? `-${String(get("posicion")).trim().padStart(2, "0")}` : ""}` : null)) || null,
      // Filtros operativos (BF / BH)
      estadoEntrega: estadoEntregaVal,
      estadoAdicional: String(get("estadoAdicional") ?? "").trim() || null,
      // Data Final (BL, BM, BN, CO, CP)
      rangoInspeccion: String(get("rangoInspeccion") ?? "").trim() || null,
      rangoIncumplimientoInformado: String(get("rangoIncumplimientoInformado") ?? "").trim() || null,
      controlIncumplimiento: String(get("controlIncumplimiento") ?? "").trim() || null,
      anio: (() => {
        const v = get("anio") !== undefined ? (Number(parseNum(get("anio"))) || null) : null;
        if (v) return v;
        const refDate = parseDate(get("fechaOrden")) ?? fechaCreacion;
        const d = new Date(refDate);
        return isNaN(d.getTime()) ? null : d.getUTCFullYear();
      })(),
      mes: (() => {
        const v = get("mes") !== undefined ? (Number(parseNum(get("mes"))) || null) : null;
        if (v) return v;
        const refDate = parseDate(get("fechaOrden")) ?? fechaCreacion;
        const d = new Date(refDate);
        return isNaN(d.getTime()) ? null : d.getUTCMonth() + 1;
      })(),
    });
  }

  return { jobs, totalRows: Math.max(0, rows.length - headerIndex - 1), mappedFields, unmappedHeaders, errors };
}
