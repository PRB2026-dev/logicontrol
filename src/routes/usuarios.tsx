import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole, type AppRole } from "@/lib/use-role";
import { toast } from "sonner";
import { Shield, User as UserIcon, Eye } from "lucide-react";

export const Route = createFileRoute("/usuarios")({
  component: () => (
    <AppShell>
      <UsuariosPage />
    </AppShell>
  ),
});

type Row = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  roles: AppRole[];
};

const ALL_ROLES: AppRole[] = ["admin", "operador", "viewer"];

function UsuariosPage() {
  const { isAdmin, loading: rl } = useMyRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
      supabase.from("profiles").select("user_id, email, display_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (pe) toast.error(pe.message);
    if (re) toast.error(re.message);
    const byUser = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r) => {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      byUser.set(r.user_id, arr);
    });
    setRows(
      (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        email: p.email,
        display_name: p.display_name,
        roles: byUser.get(p.user_id) ?? [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const setUserRole = async (user_id: string, newRole: AppRole) => {
    setSavingId(user_id);
    try {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", user_id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id, role: newRole });
      if (insErr) throw insErr;
      toast.success("Rol actualizado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el rol");
    } finally {
      setSavingId(null);
    }
  };

  if (rl) return <div className="text-sm text-muted-foreground">Cargando...</div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Gestión de usuarios</h1>
        <p className="text-sm text-muted-foreground">Asigna roles para controlar el acceso al sistema.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RoleHint icon={Shield} title="Administrador" desc="Control total: usuarios, datos, configuración." tint="destructive" />
        <RoleHint icon={UserIcon} title="Operador" desc="Crea y actualiza casos, importa, gestiona operaciones." tint="info" />
        <RoleHint icon={Eye} title="Visor" desc="Solo lectura: dashboard, reportes y consultas." tint="success" />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Usuarios registrados</h3>
          <button onClick={() => load()} className="text-xs text-info hover:underline">Refrescar</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
                <th className="py-2 px-4">Nombre</th>
                <th className="py-2 px-4">Correo</th>
                <th className="py-2 px-4">Rol actual</th>
                <th className="py-2 px-4">Cambiar rol</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Cargando usuarios...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No hay usuarios registrados.</td></tr>
              ) : rows.map((r) => {
                const current: AppRole = r.roles.includes("admin") ? "admin" : r.roles.includes("operador") ? "operador" : r.roles[0] ?? "viewer";
                return (
                  <tr key={r.user_id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2 px-4 font-medium text-foreground">{r.display_name ?? "—"}</td>
                    <td className="py-2 px-4 text-muted-foreground">{r.email ?? "—"}</td>
                    <td className="py-2 px-4"><RoleBadge role={current} /></td>
                    <td className="py-2 px-4">
                      <select
                        disabled={savingId === r.user_id}
                        value={current}
                        onChange={(e) => setUserRole(r.user_id, e.target.value as AppRole)}
                        className="h-9 px-3 rounded-md border border-border bg-background text-sm disabled:opacity-50"
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  const map: Record<AppRole, { bg: string; label: string }> = {
    admin: { bg: "bg-destructive/15 text-destructive", label: "Administrador" },
    operador: { bg: "bg-info/15 text-info", label: "Operador" },
    viewer: { bg: "bg-success/15 text-success", label: "Visor" },
  };
  const m = map[role];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${m.bg}`}>{m.label}</span>;
}

function RoleHint({ icon: Icon, title, desc, tint }: { icon: typeof Shield; title: string; desc: string; tint: "destructive" | "info" | "success" }) {
  const tintCls = tint === "destructive" ? "text-destructive bg-destructive/10" : tint === "info" ? "text-info bg-info/10" : "text-success bg-success/10";
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex gap-3">
      <div className={`h-9 w-9 rounded-md flex items-center justify-center ${tintCls}`}><Icon className="h-4 w-4" /></div>
      <div>
        <div className="font-medium text-foreground text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
