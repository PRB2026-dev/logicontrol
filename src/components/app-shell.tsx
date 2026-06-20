import { useState, useEffect } from "react";
import { useNavigate, Navigate } from "@tanstack/react-router";
import { AppSidebar, SidebarContent } from "./app-sidebar";
import { Search, Bell, Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useJobsStore } from "@/lib/jobs-store";
import { slaStatus } from "@/lib/operational";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [q, setQ] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const jobs = useJobsStore((s) => s.jobs);
  const loadFromCloud = useJobsStore((s) => s.loadFromCloud);
  const alertCount = jobs.filter((j) => slaStatus(j) === "Vencido" || j.escalado).length;

  useEffect(() => {
    if (user) void loadFromCloud();
  }, [user, loadFromCloud]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/operaciones", search: { q } as never });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-sm text-muted-foreground">Cargando...</div>;
  }
  if (!user) return <Navigate to="/login" />;



  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/60 backdrop-blur flex items-center justify-between px-4 md:px-6 gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="md:hidden h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center" aria-label="Menú">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-sidebar text-sidebar-foreground">
                <div className="flex flex-col h-full">
                  <SidebarContent onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
            <form onSubmit={submitSearch} className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar BDP JOB, cliente, carrier..."
                className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/60 border border-transparent text-sm focus:outline-none focus:border-ring focus:bg-background transition"
              />
            </form>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/alertas" })}
              className="relative h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center"
              aria-label="Alertas"
            >
              <Bell className="h-4 w-4 text-muted-foreground" />
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
                  {alertCount > 99 ? "99+" : alertCount}
                </span>
              )}
            </button>
            <button
              onClick={() => signOut()}
              className="h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center"
              aria-label="Cerrar sesión"
              title={user.email ?? "Cerrar sesión"}
            >
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </button>
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              {(user.email ?? "U").slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

