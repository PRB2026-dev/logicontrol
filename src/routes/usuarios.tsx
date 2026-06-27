import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/app-shell";
import { useMyRole, type AppRole } from "@/lib/use-role";
import { toast } from "sonner";
import { Shield, User as UserIcon, Eye, Plus, Trash2, X } from "lucide-react";
import {
  listUsersAdmin,
  createUserAdmin,
  updateRoleAdmin,
  deleteUserAdmin,
  type UserRow,
} from "@/lib/api/users.functions";

export const Route = createFileRoute("/usuarios")({
  component: () => (
    <AppShell>
      <UsuariosPage />
    </AppShell>
  ),
});

const ALL_ROLES: AppRole[] = ["admin", "operador", "viewer"];

function UsuariosPage() {
  const { isAdmin, loading: rl } = useMyRole();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", display_name: "", role: "operador" as AppRole });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsersAdmin();
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  const handleRoleChange = async (user_id: string, role: AppRole) => {
    setSavingId(user_id);
    try {
      await updateRoleAdmin({ data: { user_id, role } });
      toast.success("Rol actualizado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar el rol");
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    if (!form.email || !form.password || !form.display_name) {
      toast.error("Completa todos los campos");
      return;
    }
    setCreating(true);
    try {
      await createUserAdmin({ data: form });
      toast.success(`Usuario ${form.email} creado correctamente`);
      setForm({ email: "", password: "", display_name: "", role: "operador" });
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el usuario");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user_id: string, email: string) => {
    if (!confirm(`¿Eliminar el usuario ${email}? Esta acción no se puede deshacer.`)) return;
    setSavingId(user_id);
    try {
      await deleteUserAdmin({ data: { user_id } });
      toast.success("Usuario eliminado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar el usuario");
    } finally {
      setSavingId(null);
    }
  };

  if (rl) return <div className="text-sm text-muted-foreground">Cargando...</div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Gestión de usuarios</h1>
          <p className="text-sm text-muted-foreground">Administra accesos y roles del sistema.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 px-4 h-9 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancelar" : "Nuevo usuario"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RoleHint icon={Shield}   title="Administrador" desc="Control total: usuarios, datos, configuración." tint="destructive" />
        <RoleHint icon={UserIcon} title="Operador"      desc="Crea y actualiza casos, importa, gestiona operaciones." tint="info" />
        <RoleHint icon={Eye}      title="Visor"         desc="Solo lectura: dashboard, reportes y consultas." tint="success" />
      </div>

      {/* Formulario nuevo usuario */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Crear nuevo usuario</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre completo</span>
              <input
                type="text"
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Ej: Juan Pérez"
                className="h-9 px-3 rounded-md border border-border bg-background text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Correo electrónico</span>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="correo@empresa.com"
                className="h-9 px-3 rounded-md border border-border bg-background text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contraseña temporal</span>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                className="h-9 px-3 rounded-md border border-border bg-background text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rol</span>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value as AppRole }))}
                className="h-9 px-3 rounded-md border border-border bg-background text-sm"
              >
                {ALL_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-5 h-9 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </div>
      )}

      {/* Tabla de usuarios */}
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
                <th className="py-2 px-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Cargando usuarios...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No hay usuarios registrados.</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-2 px-4 font-medium text-foreground">{r.display_name || "—"}</td>
                  <td className="py-2 px-4 text-muted-foreground">{r.email}</td>
                  <td className="py-2 px-4"><RoleBadge role={r.role as AppRole} /></td>
                  <td className="py-2 px-4">
                    <select
                      disabled={savingId === r.user_id}
                      value={r.role}
                      onChange={e => handleRoleChange(r.user_id, e.target.value as AppRole)}
                      className="h-9 px-3 rounded-md border border-border bg-background text-sm disabled:opacity-50"
                    >
                      {ALL_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </td>
                  <td className="py-2 px-4">
                    <button
                      onClick={() => handleDelete(r.user_id, r.email)}
                      disabled={savingId === r.user_id}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" /> Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  const map: Record<AppRole, { bg: string; label: string }> = {
    admin:    { bg: "bg-destructive/15 text-destructive", label: "Administrador" },
    operador: { bg: "bg-info/15 text-info",              label: "Operador" },
    viewer:   { bg: "bg-success/15 text-success",        label: "Visor" },
  };
  const m = map[role] ?? map.viewer;
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
