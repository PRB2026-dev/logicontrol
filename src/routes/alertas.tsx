import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { useMemo, useState } from "react";
import { slaStatus, jobLlave, jobDelayDays, valorPendienteUsdFn, fmtMoney } from "@/lib/operational";
import { AlertTriangle, Clock, FileWarning, ShieldAlert, ArrowUpRight, ChevronDown, ChevronRight, CalendarX, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useMyRole } from "@/lib/use-role";
import { useMyProfile } from "@/lib/use-profile";

export const Route = createFileRoute("/alertas")({
  component: () => (
    <AppShell>
      <Alertas />
    </AppShell>
  ),
});

const norm = (v: unknown) => String(v ?? "").toLowerCase().trim();
const TODAY = new Date();
const TODAY_STR = TODAY.toISOString().slice(0, 10);

type Job = ReturnType<typeof useJobsStore.getState>["jobs"][0];
type AlertType = "Incumplimiento crítico" | "Sin seguimiento" | "SLA vencido" | "ETA vencida" | "Escalado" | "Aduana pendiente";

interface AlertItem {
  type: AlertType;
  job: Job;
  diasIncumpl: number;
  diasSinGestion: number | null;
  usdPendiente: number;
  gerencia: string;
  campo: string;
  responsable: string;
  gestion: "FRONTERA" | "BDP" | "—";
}

const TYPE_CONFIG: Record<AlertType, { color: string; bg: string; icon: typeof AlertTriangle; prioridad: number }> = {
  "Incumplimiento crítico": { color: "#991b1b", bg: "#991b1b15", icon: AlertTriangle, prioridad: 1 },
  "Sin seguimiento":        { color: "#ef4444", bg: "#ef444415", icon: CalendarX,     prioridad: 2 },
  "SLA vencido":            { color: "#f97316", bg: "#f9731615", icon: ShieldAlert,   prioridad: 3 },
  "ETA vencida":            { color: "#eab308", bg: "#eab30815", icon: Clock,         prioridad: 4 },
  "Escalado":               { color: "#f59e0b", bg: "#f59e0b15", icon: ArrowUpRight,  prioridad: 5 },
  "Aduana pendiente":       { color: "#3b82f6", bg: "#3b82f615", icon: FileWarning,   prioridad: 6 },
};

const TIPOS = Object.keys(TYPE_CONFIG) as AlertType[];

function isPending(j: Job) {
  const s = norm(j.estadoEntrega);
  return s === "sin entrega" || s === "sin entregar" || s === "pendiente" ||
    s.includes("parcial") || s === "" || s === "entrega parcial";
}

function getGestion(j: Job): "FRONTERA" | "BDP" | "—" {
  const by = norm(j.categoriaSeguimiento);
  if (by === "revision administrativa") return "FRONTERA";
  if (by === "revision proveedor") return "BDP";
  return "—";
}

const tooltipStyle = {
  background: "var(--popover)", border: "1px solid var(--border)",
  borderRadius: "8px", fontSize: "12px", color: "var(--popover-foreground)",
};

function Alertas() {
  const jobs = useJobsStore((s) => s.jobs);
  const { isAdmin } = useMyRole();
  const { profile } = useMyProfile();

  // FILTRO BASE: solo líneas ACTIVAS (Sin entrega / Entrega Parcial)
  // Las entregadas y borradas NO generan alertas.
  const activeJobs = useMemo(() => {
    return jobs.filter((j) => {
      const s = norm(j.estadoEntrega);
      // Si no hay datos de estado de entrega, la línea se considera activa
      if (!s) return true;
      // Solo activas: sin entrega o entrega parcial
      if (s === "sin entrega" || s === "sin entregar" || s === "pendiente" || s === "no entregado") return true;
      if (s.includes("parcial") || s === "entrega parcial" || s === "entregado parcial" || s === "incompleto") return true;
      // Borrado / Entregado / Completo → NO generar alerta
      return false;
    });
  }, [jobs]);

  // Si NO es admin, solo muestra alertas de sus líneas (por responsable)
  const myJobs = useMemo(() => {
    if (isAdmin) return activeJobs;
    if (!profile?.display_name) return [];
    // Match flexible: comparar sin acentos, case-insensitive, y también parcial
    const normalize = (s: string) => s.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const myNorm = normalize(profile.display_name);
    return activeJobs.filter((j) => {
      const resp = normalize(j.responsable ?? "");
      if (!resp || resp === "sin asignar") return false;
      // Match exacto o parcial (el nombre del usuario está contenido en responsable o viceversa)
      return resp === myNorm || resp.includes(myNorm) || myNorm.includes(resp);
    });
  }, [activeJobs, isAdmin, profile]);

  const [fGerencia,    setFGerencia]    = useState("");
  const [fCampo,       setFCampo]       = useState("");
  const [fResponsable, setFResponsable] = useState("");
  const [fGestion,     setFGestion]     = useState<"" | "FRONTERA" | "BDP">("");
  const [fTipo,        setFTipo]        = useState<AlertType | "">("");
  const [expandidos,   setExpandidos]   = useState<Record<AlertType, boolean>>({
    "Incumplimiento crítico": true,
    "Sin seguimiento":        true,
    "SLA vencido":            false,
    "ETA vencida":            false,
    "Escalado":               false,
    "Aduana pendiente":       false,
  });

  const gerenciasOpt    = useMemo(() => [...new Set(myJobs.map(j => (j.gerencia    ?? "").trim()).filter(Boolean))].sort(), [myJobs]);
  const camposOpt       = useMemo(() => [...new Set(myJobs.map(j => (j.campo       ?? "").trim()).filter(Boolean))].sort(), [myJobs]);
  const responsablesOpt = useMemo(() => [...new Set(myJobs.map(j => (j.responsable ?? "").trim()).filter(Boolean))].sort(), [myJobs]);

  // Cada línea aparece UNA SOLA VEZ en el tipo de mayor prioridad
  const allAlerts = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = [];
    for (const j of myJobs) {
      const diasIncumpl    = j.diasIncumplimiento ?? jobDelayDays(j) ?? 0;
      const usdPendiente   = valorPendienteUsdFn(j);
      const gerencia       = (j.gerencia    ?? "—").trim() || "—";
      const campo          = (j.campo       ?? "—").trim() || "—";
      const responsable    = (j.responsable ?? "—").trim() || "—";
      const gestion        = getGestion(j);
      const pending        = isPending(j);
      const diasSinGestion = j.fechaSeguimiento
        ? Math.floor((TODAY.getTime() - new Date(j.fechaSeguimiento).getTime()) / 86400000)
        : null;

      // Asignar UN solo tipo — el de mayor prioridad que aplique
      let tipo: AlertType | null = null;
      if      (pending && diasIncumpl > 30)                                tipo = "Incumplimiento crítico";
      else if (pending && (diasSinGestion === null || diasSinGestion > 7)) tipo = "Sin seguimiento";
      else if (slaStatus(j) === "Vencido")                                 tipo = "SLA vencido";
      else if (!j.ata && j.eta && j.eta < TODAY_STR)                      tipo = "ETA vencida";
      else if (j.escalado)                                                 tipo = "Escalado";
      else if (j.ata && !j.aduana)                                         tipo = "Aduana pendiente";

      if (!tipo) continue;
      result.push({ type: tipo, job: j, diasIncumpl, diasSinGestion, usdPendiente, gerencia, campo, responsable, gestion });
    }
    return result.sort((a, b) =>
      TYPE_CONFIG[a.type].prioridad - TYPE_CONFIG[b.type].prioridad ||
      b.diasIncumpl - a.diasIncumpl
    );
  }, [myJobs]);

  const filtered = useMemo(() => allAlerts.filter(a =>
    (!fGerencia    || a.gerencia    === fGerencia) &&
    (!fCampo       || a.campo       === fCampo) &&
    (!fResponsable || a.responsable === fResponsable) &&
    (!fGestion     || a.gestion     === fGestion) &&
    (!fTipo        || a.type        === fTipo)
  ), [allAlerts, fGerencia, fCampo, fResponsable, fGestion, fTipo]);

  const kpis = useMemo(() => ({
    total:    filtered.length,
    criticas: filtered.filter(a => a.type === "Incumplimiento crítico").length,
    sinSeg:   filtered.filter(a => a.type === "Sin seguimiento").length,
    usd:      filtered.reduce((s, a) => s + a.usdPendiente, 0),
    frontera: filtered.filter(a => a.gestion === "FRONTERA").length,
    bdp:      filtered.filter(a => a.gestion === "BDP").length,
  }), [filtered]);

  const chartData = useMemo(() =>
    TIPOS.map(type => ({
      name: type, fill: TYPE_CONFIG[type].color,
      count: filtered.filter(a => a.type === type).length,
    })).filter(d => d.count > 0),
  [filtered]);

  const grouped = useMemo(() => {
    const map = new Map<AlertType, AlertItem[]>();
    for (const a of filtered) {
      if (!map.has(a.type)) map.set(a.type, []);
      map.get(a.type)!.push(a);
    }
    return map;
  }, [filtered]);

  const toggle = (type: AlertType) => setExpandidos(p => ({ ...p, [type]: !p[type] }));

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Alertas Operativas</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} líneas con alerta · cada línea clasificada en su tipo de mayor urgencia
          {!isAdmin && profile?.display_name && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-info/15 text-info">
              <ShieldCheck className="h-3 w-3" /> Mis alertas: {profile.display_name}
            </span>
          )}
          {isAdmin && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-destructive/15 text-destructive">
              <ShieldAlert className="h-3 w-3" /> Vista administrador (todas las alertas)
            </span>
          )}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiAlert label="Total alertas"          value={kpis.total}                     color="var(--foreground)" />
        <KpiAlert label="Incumpl. crítico"        value={kpis.criticas}                  color="#991b1b" />
        <KpiAlert label="Sin seguimiento"         value={kpis.sinSeg}                    color="#ef4444" />
        <KpiAlert label="USD en riesgo"           value={fmtMoney(kpis.usd, "USD")}      color="#f97316" />
        <KpiAlert label="FRONTERA"                value={kpis.frontera}                  color="#3b82f6" />
        <KpiAlert label="BDP"                     value={kpis.bdp}                       color="#f59e0b" />
      </div>

      {/* Filtros + Gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filtros</div>
          <Sel label="Gerencia"    value={fGerencia}    onChange={setFGerencia}    options={gerenciasOpt} />
          <Sel label="Campo"       value={fCampo}       onChange={setFCampo}       options={camposOpt} />
          {isAdmin && <Sel label="Responsable" value={fResponsable} onChange={setFResponsable} options={responsablesOpt} />}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Gestión</span>
            <select value={fGestion} onChange={e => setFGestion(e.target.value as "" | "FRONTERA" | "BDP")}
              className="h-9 px-2 rounded-md border border-border bg-card text-sm">
              <option value="">Todas</option>
              <option value="FRONTERA">FRONTERA</option>
              <option value="BDP">BDP</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tipo de alerta</span>
            <select value={fTipo} onChange={e => setFTipo(e.target.value as AlertType | "")}
              className="h-9 px-2 rounded-md border border-border bg-card text-sm">
              <option value="">Todos</option>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          {(fGerencia || fCampo || fResponsable || fGestion || fTipo) && (
            <button onClick={() => { setFGerencia(""); setFCampo(""); setFResponsable(""); setFGestion(""); setFTipo(""); }}
              className="text-xs text-destructive hover:underline">✕ Limpiar filtros</button>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-4 lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Distribución por tipo · {filtered.length} líneas en total
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 2, right: 48, left: 8, bottom: 2 }}
                style={{ cursor: "pointer" }}
                onClick={e => {
                  if (e?.activePayload?.[0]) {
                    const t = (e.activePayload[0].payload as { name: AlertType }).name;
                    setFTipo(prev => prev === t ? "" : t);
                  }
                }}
              >
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={150} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v, "Líneas"]} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22}>
                  {chartData.map(d => <Cell key={d.name} fill={d.fill} opacity={fTipo && fTipo !== d.name ? 0.3 : 1} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grupos colapsables */}
      <div className="space-y-3">
        {TIPOS.map(type => {
          const items = grouped.get(type) ?? [];
          if (items.length === 0) return null;
          const cfg  = TYPE_CONFIG[type];
          const Icon = cfg.icon;
          const open = expandidos[type];
          const fronteraCount = items.filter(a => a.gestion === "FRONTERA").length;
          const bdpCount      = items.filter(a => a.gestion === "BDP").length;

          return (
            <div key={type} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${cfg.color}40` }}>
              <button type="button" onClick={() => toggle(type)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                style={{ backgroundColor: cfg.bg }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <Icon className="h-4 w-4 flex-shrink-0" style={{ color: cfg.color }} />
                  <span className="text-sm font-semibold" style={{ color: cfg.color }}>{type}</span>
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: cfg.color, color: "#fff" }}>{items.length}</span>
                  {fronteraCount > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f630" }}>
                      FRONTERA {fronteraCount}
                    </span>
                  )}
                  {bdpCount > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b30" }}>
                      BDP {bdpCount}
                    </span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 flex-shrink-0 transition-transform"
                  style={{ color: cfg.color, transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>

              {open && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left" style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">OC / Llave</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Material</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Proveedor</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Responsable</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Gerencia</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Campo</th>
                        <th className="py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wide">Gestión</th>
                        <th className="py-2 px-3 text-right font-semibold text-muted-foreground uppercase tracking-wide">Días incumpl.</th>
                        <th className="py-2 px-3 text-right font-semibold text-muted-foreground uppercase tracking-wide">Días sin gestión</th>
                        <th className="py-2 px-3 text-right font-semibold text-muted-foreground uppercase tracking-wide">USD pendiente</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.slice(0, 50).map((a, i) => {
                        const d = a.diasIncumpl;
                        const [uc, ub] =
                          d > 90 ? ["#991b1b", "#991b1b15"] :
                          d > 60 ? ["#ef4444", "#ef444415"] :
                          d > 30 ? ["#f97316", "#f9731615"] :
                          d > 10 ? ["#eab308", "#eab30815"] :
                                   ["#22c55e", "#22c55e15"];
                        return (
                          <tr key={`${a.job.id}_${i}`} className="border-b hover:bg-muted/20"
                            style={{ borderColor: "var(--border)" }}>
                            <td className="py-2 px-3 font-medium text-foreground font-mono">{jobLlave(a.job)}</td>
                            <td className="py-2 px-3 text-muted-foreground max-w-[140px] truncate" title={a.job.material ?? ""}>{a.job.material ?? "—"}</td>
                            <td className="py-2 px-3 text-muted-foreground max-w-[120px] truncate" title={a.job.proveedor ?? ""}>{a.job.proveedor ?? "—"}</td>
                            <td className="py-2 px-3 text-muted-foreground">{a.responsable}</td>
                            <td className="py-2 px-3 text-muted-foreground">{a.gerencia}</td>
                            <td className="py-2 px-3 text-muted-foreground">{a.campo}</td>
                            <td className="py-2 px-3">
                              {a.gestion === "FRONTERA"
                                ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f630" }}>FRONTERA</span>
                                : a.gestion === "BDP"
                                ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b30" }}>BDP</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums"
                                style={{ backgroundColor: ub, color: uc }}>
                                {d > 0 ? `+${d}d` : d === 0 ? "0d" : `${d}d`}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {a.diasSinGestion !== null
                                ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums bg-destructive/15 text-destructive">{a.diasSinGestion}d</span>
                                : <span className="text-[10px] font-semibold" style={{ color: "#ef4444" }}>Sin fecha</span>}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums font-medium">
                              {a.usdPendiente > 0 ? fmtMoney(a.usdPendiente, "USD") : "—"}
                            </td>
                            <td className="py-2 px-3">
                              <Link to="/operaciones/$jobId" params={{ jobId: a.job.id } as any}
                                className="inline-flex items-center gap-1 text-[10px] text-info hover:underline">
                                Ver <ChevronRight className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {items.length > 50 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t" style={{ borderColor: "var(--border)" }}>
                      Mostrando 50 de {items.length} líneas. Aplica filtros para reducir.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-card border border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
            No hay alertas activas con los filtros aplicados.
          </div>
        )}
      </div>
    </div>
  );
}

function KpiAlert({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-2 text-2xl font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="h-9 px-2 rounded-md border border-border bg-card text-sm text-foreground">
        <option value="">Todos</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
