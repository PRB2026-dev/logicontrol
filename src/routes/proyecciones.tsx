import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useJobsStore } from "@/lib/jobs-store";
import { statusColors } from "@/lib/jobs-data";
import { jobLlave } from "@/lib/operational";
import { CalendarClock, TrendingUp, AlertOctagon, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell } from "recharts";

export const Route = createFileRoute("/proyecciones")({
  component: () => (
    <AppShell>
      <Proyecciones />
    </AppShell>
  ),
});

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "12px",
  color: "var(--popover-foreground)",
};

function Proyecciones() {
  const jobs = useJobsStore((s) => s.jobs);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const data = useMemo(() => {
    const activos = jobs.filter((j) => !j.ata);
    const vencidas = activos.filter((j) => j.eta < todayStr);
    const proximas = activos.filter((j) => j.eta >= todayStr);

    const en7 = proximas.filter((j) => daysUntil(j.eta) <= 7).length;
    const en30 = proximas.filter((j) => daysUntil(j.eta) <= 30).length;
    const arribadasMes = jobs.filter((j) => j.ata && daysUntil(j.ata) >= -30 && daysUntil(j.ata) <= 0).length;

    // Forecast día a día, próximos 30 días
    const forecast = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const count = activos.filter((j) => j.eta === key).length;
      return { day: key.slice(5), eta: count };
    });

    // Por carrier (top 6)
    const carrierMap = new Map<string, number>();
    proximas.forEach((j) => carrierMap.set(j.carrier, (carrierMap.get(j.carrier) ?? 0) + 1));
    const topCarriers = Array.from(carrierMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, value]) => ({ name, value }));

    const proximasOrden = proximas
      .map((j) => ({ ...j, _d: daysUntil(j.eta) }))
      .sort((a, b) => a._d - b._d)
      .slice(0, 12);

    return { activos, vencidas, proximas, en7, en30, arribadasMes, forecast, topCarriers, proximasOrden };
  }, [jobs, todayStr, today]);

  const colors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--info)"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Proyecciones y entregas</h1>
        <p className="text-sm text-muted-foreground">Forecast de arribos, ETAs próximas y seguimiento de cumplimiento.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={CalendarClock} label="ETA en 7 días" value={data.en7} tint="info" />
        <Kpi icon={TrendingUp} label="ETA en 30 días" value={data.en30} tint="chart-1" />
        <Kpi icon={AlertOctagon} label="ETAs vencidas" value={data.vencidas.length} tint="destructive" />
        <Kpi icon={CheckCircle2} label="Arribadas (30d)" value={data.arribadasMes} tint="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Forecast de arribos · 30 días" subtitle="Cantidad de ETAs proyectadas por día" />
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={data.forecast} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="eta" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--info)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Area type="monotone" dataKey="eta" stroke="var(--info)" fill="url(#eta)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Top carriers · próximas entregas" />
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.topCarriers} layout="vertical" margin={{ top: 6, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={11} width={80} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {data.topCarriers.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {data.topCarriers.length === 0 && <div className="text-xs text-muted-foreground text-center mt-8">Sin entregas próximas.</div>}
          </div>
        </Card>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Próximas entregas</h3>
          <p className="text-xs text-muted-foreground">Ordenadas por proximidad de ETA.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide text-left">
              <tr>
                <th className="px-4 py-2.5">LLAVE</th>
                <th className="px-4 py-2.5">OC</th>
                <th className="px-4 py-2.5">Proveedor</th>
                <th className="px-4 py-2.5">Ruta</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">ETA</th>
                <th className="px-4 py-2.5 text-right">Días</th>
              </tr>
            </thead>
            <tbody>
              {data.proximasOrden.map((j) => (
                <tr key={j.id} className="border-t border-border hover:bg-muted/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-info">{jobLlave(j)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{j.oc || j.bdpJob}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]" title={j.proveedor ?? j.cliente}>{j.proveedor || j.cliente}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{j.origen} → {j.destino}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[j.status]}`}>{j.status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{j.eta}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${j._d <= 3 ? "text-destructive font-semibold" : j._d <= 7 ? "text-warning" : ""}`}>
                    {j._d === 0 ? "Hoy" : `${j._d}d`}
                  </td>
                </tr>
              ))}
              {data.proximasOrden.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No hay entregas próximas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function daysUntil(date: string): number {
  const d = new Date(date);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

function Kpi({ icon: Icon, label, value, tint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; tint: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`h-8 w-8 rounded-md flex items-center justify-center bg-${tint}/10`}>
          <Icon className={`h-4 w-4 text-${tint}`} />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-lg p-5 ${className}`}>{children}</div>;
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  );
}
