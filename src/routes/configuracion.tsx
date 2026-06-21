import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { useMyRole, type AppRole } from "@/lib/use-role";
import { toast } from "sonner";
import {
  UserPlus, Trash2, Shield, User as UserIcon, Eye,
  X, Loader2, Users, RefreshCw,
} from "lucide-react";
import {
  listUsersAdmin, createUserAdmin, updateRoleAdmin, deleteUserAdmin,
  type UserRow,
} from "@/lib/api/users.functions";

export const Route = createFileRoute("/configuracion")({
  component: () => (
    <AppShell>
      <ConfigPage />
    </AppShell>
  ),
});

// ─── Constantes de roles ──────────────────────────────────────────────────────
const ALL_ROLES: { value: AppRole; label: string }[] = [
  { value: "admin",    label: "Administrador" },
  { value: "operador", label: "Operador" },
  { value: "viewer",   label: "Visor" },
];
const ROLE_STYLE: Record<string, string> = {
  admin:    "bg-destructive/15 text-destructive",
  operador: "bg-info/15 text-info",
  viewer:   "bg-success/15 text-success",
};
const ROLE_LABEL: Record<string, string> = {
  admin:    "Administrador",
  operador: "Operador",
  viewer:   "Visor",
};

// ─── Componentes utilitarios ──────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${ROLE_STYLE[role] ?? "bg-muted text-muted-foreground"}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}

function RoleCard({ icon: Icon, title, desc, color }: {
  icon: typeof Shield; title: string; desc: string; color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex gap-3">
      <div className={`h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="font-medium text-foreground text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}{" "}
        {required && <span className="text-destructive">*</span>}
        {hint && <span className="text-xs font-normal text-muted-foreground ml-1">({hint})</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
type FormState = {
  display_name: string;
  email: string;
  password: string;
  confirm_password: string;
  role: AppRole;
};
const EMPTY_FORM: FormState = {
  display_name: "", email: "", password: "", confirm_password: "", role: "viewer",
};

function ConfigPage() {
  const { isAdmin, loading: rl } = useMyRole();
  const [users, setUsers]           = useState<UserRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsersAdmin();
      setUsers(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);

  useEffect(() => {
    if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [showForm]);

  const openForm = () => { setForm(EMPTY_FORM); setShowForm(true); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSaving(true);
    try {
      await createUserAdmin({
        data: {
          email: form.email,
          password: form.password,
          display_name: form.display_name,
          role: form.role,
        },
      });
      toast.success(`Usuario "${form.display_name}" creado correctamente`);
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleChangeRole = async (user_id: string, role: AppRole) => {
    setSavingRoleId(user_id);
    try {
      await updateRoleAdmin({ data: { user_id, role } });
      toast.success("Rol actualizado");
      setUsers((prev) => prev.map((u) => (u.user_id === user_id ? { ...u, role } : u)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al actualizar rol");
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`¿Eliminar el usuario "${u.display_name || u.email}"?\nEsta acción no se puede deshacer.`)) return;
    setDeletingId(u.user_id);
    try {
      await deleteUserAdmin({ data: { user_id: u.user_id } });
      toast.success("Usuario eliminado");
      setUsers((prev) => prev.filter((x) => x.user_id !== u.user_id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar usuario");
    } finally {
      setDeletingId(null);
    }
  };

  const pwMismatch = !!form.confirm_password && form.password !== form.confirm_password;

  if (rl) return <div className="text-sm text-muted-foreground p-6">Cargando...</div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-muted-foreground" />
            Configuración · Usuarios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crea, edita y elimina usuarios del sistema. Solo los administradores tienen acceso.
          </p>
        </div>
        <button
          onClick={openForm}
          className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </div>

      {/* Leyenda de roles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RoleCard icon={Shield}   title="Administrador" desc="Control total: usuarios, datos, configuración."               color="text-destructive bg-destructive/10" />
        <RoleCard icon={UserIcon} title="Operador"      desc="Crea y actualiza casos, importa, gestiona operaciones."       color="text-info bg-info/10" />
        <RoleCard icon={Eye}      title="Visor"         desc="Solo lectura: dashboard, reportes y consultas."               color="text-success bg-success/10" />
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">
            Usuarios registrados
            {!loading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({users.length})</span>
            )}
          </h3>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border bg-muted/30">
                <th className="py-2.5 px-4">Nombre</th>
                <th className="py-2.5 px-4">Correo</th>
                <th className="py-2.5 px-4">Rol actual</th>
                <th className="py-2.5 px-4">Cambiar rol</th>
                <th className="py-2.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Cargando usuarios...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-muted-foreground">
                    No hay usuarios registrados. Crea el primero con el botón "Nuevo usuario".
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-foreground">{u.display_name || "—"}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{u.email || "—"}</td>
                    <td className="py-2.5 px-4"><RoleBadge role={u.role} /></td>
                    <td className="py-2.5 px-4">
                      <select
                        value={u.role}
                        disabled={savingRoleId === u.user_id}
                        onChange={(e) => void handleChangeRole(u.user_id, e.target.value as AppRole)}
                        className="h-8 px-2 rounded-md border border-border bg-background text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => void handleDelete(u)}
                        disabled={!!deletingId}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-colors disabled:opacity-50"
                      >
                        {deletingId === u.user_id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />
                        }
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Crear usuario */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">

            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Crear nuevo usuario</h2>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={(e) => void handleCreate(e)} className="px-6 py-5 space-y-4">
              <Field label="Nombre completo" required>
                <input
                  ref={firstInputRef}
                  type="text"
                  required
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="Ej: María González"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </Field>

              <Field label="Correo electrónico" required>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </Field>

              <Field label="Contraseña" required hint="mínimo 8 caracteres">
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </Field>

              <Field label="Confirmar contraseña" required>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.confirm_password}
                  onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
                  placeholder="••••••••"
                  className={`w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 ${
                    pwMismatch
                      ? "border-destructive focus:ring-destructive/30"
                      : "border-border focus:ring-primary/30"
                  }`}
                />
                {pwMismatch && (
                  <p className="text-xs text-destructive mt-1">Las contraseñas no coinciden</p>
                )}
              </Field>

              <Field label="Rol" required>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {ALL_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving || pwMismatch}
                  className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</>
                    : <><UserPlus className="h-4 w-4" /> Crear usuario</>
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted/50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

