/**
 * Bloques NUEVOS del Reporte Semanal — Cumplimiento de Entregas.
 * Presentación idéntica al grid de KPIs del reporte semanal original:
 *   bg-background · border border-border · rounded-lg · p-4
 *   label: text-[10px] font-medium uppercase tracking-wide text-muted-foreground
 *   valor: text-xl font-bold tabular-nums (en color)
 *   sub:   text-[11px] text-muted-foreground
 */
import type { WeeklyBlocksResult } from "@/lib/report-weekly-blocks";
import { fmtMoney } from "@/lib/operational";

// ─── KPI card — clon exacto de KpiReport de reportes.tsx ──────────────────────
function KpiCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-background border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

// ─── Bloque (A o B): título + nota + grid de KPI cards ────────────────────────
function Bloque({
  titulo, nota, colorNota, cards,
}: {
  titulo: string;
  nota: string;
  colorNota: string;
  cards: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {/* Título — igual a "Backlog y riesgos" / "Entregas programadas" */}
      <div>
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          {titulo}
        </h4>
        <p
          className="text-[10px] mt-1 rounded px-2 py-1 leading-snug"
          style={{
            color: colorNota,
            background: `${colorNota}12`,
            border: `1px solid ${colorNota}30`,
          }}
        >
          {nota}
        </p>
      </div>
      {/* Grid de cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards}
      </div>
    </div>
  );
}

// ─── Punto de color inline ─────────────────────────────────────────────────────
function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────
export function ReportWeeklyBlocks({ result: r }: { result: WeeklyBlocksResult }) {
  const a = r.bloqueA;
  const b = r.bloqueB;
  const act = r.activas;

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">

      {/* ── Encabezado ── */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="text-sm font-bold text-primary select-none">AB</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-foreground tracking-wide">
              NUEVO
            </span>
            <h2 className="text-lg font-semibold text-foreground">
              Cumplimiento de Entregas
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Base deduplicada por LLAVE · BK de la hoja · base completa (sin ventana de 7 días)
          </p>
        </div>
      </div>

      {/* ── Bloque A ── */}
      <Bloque
        titulo="Bloque A · Cumplimiento por fecha contractual"
        colorNota="#6366f1"
        nota="Cumplimiento medido con la fecha de aceptación frente a la fecha contractual. Es el indicador oficial."
        cards={
          <>
            <KpiCard
              icon={<Dot color="#10b981" />}
              label="Anticipadas"
              value={a.anticipadas.lineas.toLocaleString()}
              sub={`${a.anticipadas.ocs} OC · ${fmtMoney(a.anticipadas.usd, "USD")}`}
              color="#10b981"
            />
            <KpiCard
              icon={<Dot color="#3b82f6" />}
              label="En fecha"
              value={a.enFecha.lineas.toLocaleString()}
              sub={`${a.enFecha.ocs} OC · ${fmtMoney(a.enFecha.usd, "USD")}`}
              color="#3b82f6"
            />
            <KpiCard
              icon={<Dot color="#ef4444" />}
              label="Atrasadas"
              value={a.atrasadas.lineas.toLocaleString()}
              sub={`${a.atrasadas.ocs} OC · ${fmtMoney(a.atrasadas.usd, "USD")}`}
              color="#ef4444"
            />
            <KpiCard
              icon={<Dot color="#6366f1" />}
              label="Total entregadas"
              value={a.total.lineas.toLocaleString()}
              sub={`${a.total.ocs} OC · ${fmtMoney(a.total.usd, "USD")}`}
              color="#6366f1"
            />
          </>
        }
      />

      {/* ── Bloque B ── */}
      <Bloque
        titulo="Bloque B · Entrega real vs contractual"
        colorNota="#f59e0b"
        nota="Medición informativa con la fecha real de entrega frente a la fecha contractual. No reemplaza el cumplimiento oficial."
        cards={
          <>
            <KpiCard
              icon={<Dot color="#10b981" />}
              label="Anticipadas"
              value={b.anticipadas.lineas.toLocaleString()}
              sub={`${b.anticipadas.ocs} OC · ${fmtMoney(b.anticipadas.usd, "USD")}`}
              color="#10b981"
            />
            <KpiCard
              icon={<Dot color="#3b82f6" />}
              label="En fecha"
              value={b.enFecha.lineas.toLocaleString()}
              sub={`${b.enFecha.ocs} OC · ${fmtMoney(b.enFecha.usd, "USD")}`}
              color="#3b82f6"
            />
            <KpiCard
              icon={<Dot color="#ef4444" />}
              label="Atrasadas"
              value={b.atrasadas.lineas.toLocaleString()}
              sub={`${b.atrasadas.ocs} OC · ${fmtMoney(b.atrasadas.usd, "USD")}`}
              color="#ef4444"
            />
            <KpiCard
              icon={<Dot color="#6b7280" />}
              label="Sin fecha real"
              value={b.sinFechaReal.toLocaleString()}
              sub={`${b.cambiaron} cambian clasif. A→B`}
              color="#6b7280"
            />
          </>
        }
      />

      {/* ── Backlog · Líneas activas ── */}
      <div className="bg-muted/20 border border-border rounded-lg p-4">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3">
          Backlog · Líneas activas (base deduplicada)
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={<Dot color="#10b981" />}
            label="Activas a tiempo"
            value={act.aTiempo.lineas.toLocaleString()}
            sub={`${act.aTiempo.ocs} OC`}
            color="#10b981"
          />
          <KpiCard
            icon={<Dot color="#ef4444" />}
            label="Activas atrasadas"
            value={act.atrasada.lineas.toLocaleString()}
            sub={`${act.atrasada.ocs} OC`}
            color="#ef4444"
          />
          <KpiCard
            icon={<Dot color="#6366f1" />}
            label="Total activas"
            value={act.totalLineas.toLocaleString()}
            sub="líneas"
            color="#6366f1"
          />
          <KpiCard
            icon={<Dot color="#6b7280" />}
            label="OC únicas"
            value={act.unionOcs.toLocaleString()}
            sub={`intersección ${act.intersecOcs}`}
            color="#6b7280"
          />
        </div>
        <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
          Validación: a tiempo + atrasada ={" "}
          <span className="font-semibold text-foreground">
            {(act.aTiempo.lineas + act.atrasada.lineas).toLocaleString()} líneas
          </span>
          {" · "}OC a tiempo + OC atrasada − intersección ={" "}
          <span className="font-semibold text-foreground">
            {act.aTiempo.ocs + act.atrasada.ocs - act.intersecOcs} OC únicas
          </span>
        </div>
      </div>

    </div>
  );
}
