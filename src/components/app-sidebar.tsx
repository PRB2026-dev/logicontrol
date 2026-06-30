import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Package, Ship, FileText, Bell, Settings, Upload, Briefcase, TrendingUp, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/use-role";

const nav = [
  
  { to: "/dashboard-gerencial", label: "Dashboard Gerencial", icon: BarChart3 },
  { to: "/casos", label: "Órdenes de Compra", icon: Briefcase },
  { to: "/operaciones", label: "Operaciones", icon: Package },
  { to: "/importaciones", label: "Importaciones", icon: Ship },
  { to: "/proyecciones", label: "Proyecciones", icon: TrendingUp },
  { to: "/importar", label: "Importar Excel", icon: Upload },
  { to: "/reportes", label: "Reportes", icon: FileText },
  { to: "/alertas", label: "Alertas", icon: Bell },
  { to: "/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
  { to: "/configuracion", label: "Configuración", icon: Settings },
] as const;

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { location } = useRouterState();
  const { isAdmin } = useMyRole();
  return (
    <>
      <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-md overflow-hidden flex items-center justify-center">
          <img src="/favicon.svg" alt="LogiControl" className="h-9 w-9" />
        </div>
        <div>
          <div className="font-semibold tracking-tight">LogiControl</div>
          <div className="text-[11px] text-sidebar-foreground/60 -mt-0.5">Tracking System</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.filter((i) => !("adminOnly" in i) || !i.adminOnly || isAdmin).map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/50">
        v1.0 · ERP operativo
      </div>
    </>
  );
}

export function AppSidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <SidebarContent />
    </aside>
  );
}
