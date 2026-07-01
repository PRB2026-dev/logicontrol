import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { useMyRole, type AppRole } from "@/lib/use-role";
import { toast } from "sonner";
import {
  UserPlus, Trash2, Shield, User as UserIcon, Eye,
  X, Loader2, Users, RefreshCw, Info, Scale, Ship, Code2, BookOpen,
} from "lucide-react";
import {
  listUsersAdmin, createUserAdmin, updateRoleAdmin, deleteUserAdmin,
  changePasswordAdmin,
  type UserRow,
} from "@/lib/api/users.functions";

export const Route = createFileRoute("/configuracion")({
  component: () => (
    <AppShell>
      <ConfigPage />
    </AppShell>
  ),
});

// ─── Constantes ───────────────────────────────────────────────────────────────
type TabId = "usuarios" | "manual" | "acerca" | "legal";

const ALL_ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "operador", label: "Operador" },
  { value: "viewer", label: "Visor" },
];
const ROLE_STYLE: Record<string, string> = {
  admin: "bg-destructive/15 text-destructive",
  operador: "bg-info/15 text-info",
  viewer: "bg-success/15 text-success",
};
const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  operador: "Operador",
  viewer: "Visor",
};

// ─── Componentes utilitarios ──────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${ROLE_STYLE[role] ?? "bg-muted text-muted-foreground"}`}>
      {ROLE_LABEL[role] ?? role}
    </span>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
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
  const [activeTab, setActiveTab] = useState<TabId>("acerca");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [pwUser, setPwUser] = useState<UserRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!rl && isAdmin) setActiveTab("usuarios"); }, [rl, isAdmin]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listUsersAdmin();
      setUsers(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar usuarios");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, load]);
  useEffect(() => { if (showForm) setTimeout(() => firstInputRef.current?.focus(), 50); }, [showForm]);

  const openForm = () => { setForm(EMPTY_FORM); setShowForm(true); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) { toast.error("Las contraseñas no coinciden"); return; }
    setSaving(true);
    try {
      await createUserAdmin({ data: { email: form.email, password: form.password, display_name: form.display_name, role: form.role } });
      toast.success(`Usuario "${form.display_name}" creado correctamente`);
      setShowForm(false); setForm(EMPTY_FORM); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error al crear usuario"); }
    finally { setSaving(false); }
  };

  const handleChangeRole = async (user_id: string, role: AppRole) => {
    setSavingRoleId(user_id);
    try {
      await updateRoleAdmin({ data: { user_id, role } });
      toast.success("Rol actualizado");
      setUsers((prev) => prev.map((u) => (u.user_id === user_id ? { ...u, role } : u)));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error al actualizar rol"); }
    finally { setSavingRoleId(null); }
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`¿Eliminar el usuario "${u.display_name || u.email}"?\nEsta acción no se puede deshacer.`)) return;
    setDeletingId(u.user_id);
    try {
      await deleteUserAdmin({ data: { user_id: u.user_id } });
      toast.success("Usuario eliminado");
      setUsers((prev) => prev.filter((x) => x.user_id !== u.user_id));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error al eliminar usuario"); }
    finally { setDeletingId(null); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwUser) return;
    if (newPw !== confirmPw) { toast.error("Las contraseñas no coinciden"); return; }
    setSavingPw(true);
    try {
      await changePasswordAdmin({ data: { user_id: pwUser.user_id, new_password: newPw } });
      toast.success(`Contraseña actualizada para "${pwUser.display_name || pwUser.email}"`);
      setPwUser(null); setNewPw(""); setConfirmPw("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error al cambiar contraseña"); }
    finally { setSavingPw(false); }
  };

  const pwMismatch = !!form.confirm_password && form.password !== form.confirm_password;

  if (rl) return <div className="text-sm text-muted-foreground p-6">Cargando...</div>;

  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    ...(isAdmin ? [{ id: "usuarios" as TabId, label: "Usuarios", icon: Users }] : []),
    { id: "manual", label: "Manual de Usuario", icon: BookOpen },
    { id: "acerca", label: "Acerca de", icon: Info },
    { id: "legal", label: "Legal", icon: Scale },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground">Administración del sistema, información y términos legales.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB: USUARIOS ═══ */}
      {activeTab === "usuarios" && isAdmin && (
        <div className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" /> Gestión de Usuarios
              </h2>
              <p className="text-sm text-muted-foreground mt-1">Crea, edita y elimina usuarios del sistema.</p>
            </div>
            <button onClick={openForm}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
              <UserPlus className="h-4 w-4" /> Nuevo usuario
            </button>
          </div>

          {/* Roles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-lg p-4 flex gap-3">
              <div className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 text-destructive bg-destructive/10"><Shield className="h-4 w-4" /></div>
              <div><div className="font-medium text-foreground text-sm">Administrador</div><div className="text-xs text-muted-foreground">Control total: usuarios, datos, configuración.</div></div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 flex gap-3">
              <div className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 text-info bg-info/10"><UserIcon className="h-4 w-4" /></div>
              <div><div className="font-medium text-foreground text-sm">Operador</div><div className="text-xs text-muted-foreground">Crea y actualiza casos, importa, gestiona operaciones.</div></div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 flex gap-3">
              <div className="h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 text-success bg-success/10"><Eye className="h-4 w-4" /></div>
              <div><div className="font-medium text-foreground text-sm">Visor</div><div className="text-xs text-muted-foreground">Solo lectura: dashboard, reportes y consultas.</div></div>
            </div>
          </div>

          {/* Tabla usuarios */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">
                Usuarios registrados{!loading && <span className="ml-2 text-sm font-normal text-muted-foreground">({users.length})</span>}
              </h3>
              <button onClick={() => void load()} disabled={loading}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refrescar
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
                    <tr><td colSpan={5} className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />Cargando usuarios...</td></tr>
                  ) : users.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No hay usuarios registrados.</td></tr>
                  ) : users.map((u) => (
                    <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-4 font-medium text-foreground">{u.display_name || "—"}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{u.email || "—"}</td>
                      <td className="py-2.5 px-4"><RoleBadge role={u.role} /></td>
                      <td className="py-2.5 px-4">
                        <select value={u.role} disabled={savingRoleId === u.user_id}
                          onChange={(e) => void handleChangeRole(u.user_id, e.target.value as AppRole)}
                          className="h-8 px-2 rounded-md border border-border bg-background text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/30">
                          {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setPwUser(u); setNewPw(""); setConfirmPw(""); }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-info hover:bg-info/10 border border-transparent hover:border-info/20 transition-colors">
                            🔑 Contraseña
                          </button>
                          <button onClick={() => void handleDelete(u)} disabled={!!deletingId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-colors disabled:opacity-50">
                            {deletingId === u.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: MANUAL DE USUARIO ═══ */}
      {activeTab === "manual" && <ManualUsuario />}

      {/* ═══ TAB: ACERCA DE ═══ */}
      {activeTab === "acerca" && (
        <div className="space-y-6">
          {/* App info */}
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                <Ship className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">LogiControl</h2>
                <p className="text-sm text-muted-foreground">Sistema de seguimiento logístico y control de operaciones</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">v1.2.0</span>
                  <span className="text-xs text-muted-foreground">ERP Operativo</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow label="Nombre del sistema" value="LogiControl" />
              <InfoRow label="Versión" value="1.2.0" />
              <InfoRow label="Tipo" value="Sistema ERP de seguimiento logístico" />
              <InfoRow label="Plataforma" value="Aplicación web (SaaS)" />
              <InfoRow label="Desarrollado por" value="Misael Becerra" />
              <InfoRow label="Año de desarrollo" value="2026" />
              <InfoRow label="País" value="Colombia" />
              <InfoRow label="Contacto" value="soporte@logicontrol.co" />
            </div>
          </div>

          {/* Descripción */}
          <Section title="Descripción del Sistema">
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">LogiControl</strong> es una plataforma centralizada para el control
                y seguimiento de operaciones de compras, importaciones y logística empresarial. Permite gestionar el ciclo
                completo de una orden de compra desde su creación hasta la entrega final en campo.
              </p>
              <p>El sistema ofrece:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Dashboard gerencial con KPIs en tiempo real (USD comprado, pendiente, cumplimiento)</li>
                <li>Seguimiento por línea de orden de compra (OC + posición)</li>
                <li>Control de incumplimiento y alertas operativas por responsable</li>
                <li>Proyecciones de entrega por semana y proveedor</li>
                <li>Importación masiva desde archivos Excel</li>
                <li>Exportación de reportes operativos</li>
                <li>Gestión de usuarios con roles (Admin, Operador, Visor)</li>
                <li>Clasificación automática Nacional / Importación</li>
              </ul>
            </div>
          </Section>

          {/* Stack técnico */}
          <Section title="Tecnologías">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <TechBadge name="React 19" desc="Interfaz de usuario" />
              <TechBadge name="TanStack Router" desc="Enrutamiento" />
              <TechBadge name="Supabase" desc="Base de datos y auth" />
              <TechBadge name="Zustand" desc="Estado global" />
              <TechBadge name="Tailwind CSS v4" desc="Estilos" />
              <TechBadge name="Recharts" desc="Gráficos y dashboards" />
              <TechBadge name="Vite" desc="Build y dev server" />
              <TechBadge name="TypeScript" desc="Tipado estático" />
              <TechBadge name="shadcn/ui" desc="Componentes UI" />
            </div>
          </Section>
        </div>
      )}

      {/* ═══ TAB: LEGAL ═══ */}
      {activeTab === "legal" && (
        <div className="space-y-6">

          <Section title="Derechos de Autor y Propiedad Intelectual">
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                <strong className="text-foreground">© 2026 LogiControl.</strong> Todos los derechos reservados.
              </p>
              <p>
                Este software, incluyendo pero no limitado a su código fuente, diseño de interfaz,
                lógica de negocio, algoritmos, documentación, gráficos, iconos y cualquier otro
                material contenido en el sistema, es propiedad exclusiva de sus desarrolladores
                y está protegido por las leyes de derechos de autor de la República de Colombia
                (Ley 23 de 1982, Decisión Andina 351 de 1993) y tratados internacionales aplicables.
              </p>
              <p>
                Queda estrictamente prohibida la reproducción, distribución, modificación,
                ingeniería inversa, descompilación o cualquier uso no autorizado del software
                sin el consentimiento previo y por escrito del titular de los derechos.
              </p>
            </div>
          </Section>

          <Section title="Licencia de Uso">
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                El uso de LogiControl se otorga bajo una <strong className="text-foreground">licencia de uso privada y no transferible</strong>.
                Esta licencia permite únicamente:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>El acceso y uso del sistema por parte de los usuarios autorizados de la organización licenciataria.</li>
                <li>La visualización y exportación de datos operativos propios ingresados en el sistema.</li>
                <li>El uso de las funcionalidades del sistema conforme al rol asignado.</li>
              </ul>
              <p className="font-medium text-foreground mt-4">Queda expresamente prohibido:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Copiar, reproducir o redistribuir el software total o parcialmente.</li>
                <li>Realizar ingeniería inversa, descompilar o desensamblar el código.</li>
                <li>Sublicenciar, arrendar o transferir el acceso a terceros.</li>
                <li>Remover o alterar avisos de propiedad intelectual o marcas del sistema.</li>
                <li>Utilizar el sistema para desarrollar productos competidores o derivados.</li>
                <li>Extraer de forma masiva datos o estructura de la base de datos.</li>
              </ul>
            </div>
          </Section>

          <Section title="Política de Privacidad y Datos">
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                LogiControl recopila y almacena datos necesarios para la operación del sistema,
                incluyendo información de usuarios (nombre, correo electrónico) y datos operativos
                de las órdenes de compra importadas por la organización.
              </p>
              <p className="font-medium text-foreground">Tratamiento de datos:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Los datos se almacenan en servidores seguros con cifrado en reposo y en tránsito.</li>
                <li>El acceso a los datos está controlado por roles y permisos definidos en el sistema.</li>
                <li>No se comparten datos con terceros sin autorización expresa de la organización.</li>
                <li>Los datos operativos pertenecen a la organización que los ingresa al sistema.</li>
                <li>Se implementan medidas de seguridad conformes a estándares de la industria.</li>
              </ul>
              <p className="font-medium text-foreground mt-4">Retención de datos:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Los datos operativos se conservan mientras la organización mantenga la licencia activa.</li>
                <li>Al finalizar la relación contractual, los datos pueden ser exportados o eliminados según solicitud.</li>
                <li>Los logs de acceso se conservan por un período mínimo de 12 meses por seguridad.</li>
              </ul>
            </div>
          </Section>

          <Section title="Términos de Uso">
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>Al utilizar LogiControl, el usuario acepta:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Usar el sistema exclusivamente para fines operativos legítimos de la organización.</li>
                <li>Mantener la confidencialidad de sus credenciales de acceso.</li>
                <li>No intentar acceder a datos o funcionalidades fuera de su rol asignado.</li>
                <li>Reportar inmediatamente cualquier vulnerabilidad o uso no autorizado detectado.</li>
                <li>No utilizar el sistema para almacenar contenido ilegal o no relacionado con la operación.</li>
              </ul>
              <p className="mt-4">
                El incumplimiento de estos términos puede resultar en la suspensión o terminación
                del acceso al sistema, sin perjuicio de las acciones legales que correspondan.
              </p>
            </div>
          </Section>

          <Section title="Limitación de Responsabilidad">
            <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>
                LogiControl se proporciona "tal cual" y "según disponibilidad". Si bien se realizan
                esfuerzos razonables para mantener la precisión y disponibilidad del sistema:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>No se garantiza que el sistema esté libre de errores o interrupciones.</li>
                <li>Las decisiones de negocio basadas en la información del sistema son responsabilidad exclusiva del usuario.</li>
                <li>No se asume responsabilidad por pérdidas derivadas de indisponibilidad temporal del servicio.</li>
                <li>Los cálculos y proyecciones son estimaciones basadas en los datos ingresados y pueden variar.</li>
              </ul>
            </div>
          </Section>

          <div className="bg-muted/30 border border-border rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Última actualización de términos: Junio 2026 · Estos términos pueden ser actualizados periódicamente.
              El uso continuado del sistema después de una actualización constituye aceptación de los nuevos términos.
            </p>
          </div>
        </div>
      )}

      {/* Modal: Cambiar contraseña */}
      {pwUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setPwUser(null); }}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Cambiar contraseña</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{pwUser.display_name || pwUser.email}</p>
              </div>
              <button onClick={() => setPwUser(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleChangePassword(e)} className="px-6 py-5 space-y-4">
              <Field label="Nueva contraseña" required hint="mínimo 8 caracteres">
                <input type="password" required minLength={8} value={newPw}
                  onChange={(e) => setNewPw(e.target.value)} placeholder="••••••••"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </Field>
              <Field label="Confirmar contraseña" required>
                <input type="password" required minLength={8} value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••"
                  className={`w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 ${confirmPw && newPw !== confirmPw ? "border-destructive focus:ring-destructive/30" : "border-border focus:ring-primary/30"}`} />
                {confirmPw && newPw !== confirmPw && <p className="text-xs text-destructive mt-1">Las contraseñas no coinciden</p>}
              </Field>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={savingPw || (!!confirmPw && newPw !== confirmPw)}
                  className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {savingPw ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</> : "Cambiar contraseña"}
                </button>
                <button type="button" onClick={() => setPwUser(null)}
                  className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted/50 transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear usuario */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Crear nuevo usuario</h2>
              </div>
              <button onClick={() => setShowForm(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted/50 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(e) => void handleCreate(e)} className="px-6 py-5 space-y-4">
              <Field label="Nombre completo" required>
                <input ref={firstInputRef} type="text" required value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                  placeholder="Ej: María González"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </Field>
              <Field label="Correo electrónico" required>
                <input type="email" required value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </Field>
              <Field label="Contraseña" required hint="mínimo 8 caracteres">
                <input type="password" required minLength={8} value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </Field>
              <Field label="Confirmar contraseña" required>
                <input type="password" required minLength={8} value={form.confirm_password}
                  onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
                  placeholder="••••••••"
                  className={`w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 ${pwMismatch ? "border-destructive focus:ring-destructive/30" : "border-border focus:ring-primary/30"}`} />
                {pwMismatch && <p className="text-xs text-destructive mt-1">Las contraseñas no coinciden</p>}
              </Field>
              <Field label="Rol" required>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AppRole }))}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                  {ALL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </Field>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving || pwMismatch}
                  className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando...</> : <><UserPlus className="h-4 w-4" /> Crear usuario</>}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 h-9 rounded-md border border-border text-sm hover:bg-muted/50 transition-colors">
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

// ─── Componentes auxiliares de las tabs ────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function TechBadge({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="bg-muted/30 border border-border rounded-lg p-3">
      <div className="text-sm font-medium text-foreground">{name}</div>
      <div className="text-[11px] text-muted-foreground">{desc}</div>
    </div>
  );
}


// ─── Manual de Usuario ────────────────────────────────────────────────────────
function ManualUsuario() {
  return (
    <div className="space-y-6">
      <Section title="1. Inicio de Sesión">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Para acceder al sistema, ingrese a la URL proporcionada e introduzca su correo y contraseña.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Si olvidó su contraseña, contacte al administrador para restablecerla.</li>
            <li>Cada usuario tiene un rol asignado (Administrador, Operador o Visor) que define sus permisos.</li>
          </ul>
        </div>
      </Section>

      <Section title="2. Dashboard Gerencial">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>El Dashboard Gerencial muestra indicadores de las <strong className="text-foreground">órdenes nacionales</strong>. No incluye importaciones.</p>
          <p className="font-medium text-foreground">Filtros disponibles:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Año</strong> — Filtra por el año de la columna AL del Excel.</li>
            <li><strong>Semestre / Trimestre / Mes</strong> — Periodos específicos.</li>
            <li><strong>Gerencia / Campo / Cuenta</strong> — Organizacional.</li>
            <li><strong>Proveedor</strong> — Filtrar por proveedor específico.</li>
            <li><strong>Equipo</strong> — Columna Q del Excel.</li>
            <li><strong>Liberación (BH)</strong> — Multi-selección: 0=Activas, L=Liberadas, B=Bloqueadas.</li>
            <li><strong>Estado</strong> — Multi-selección: Borrado, Entregado, Entrega Parcial, Sin entrega.</li>
          </ul>
          <p className="mt-3 font-medium text-foreground">Secciones del dashboard:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>USD Comprado / Recibido / Pendiente</strong> — Valores económicos totales.</li>
            <li><strong>Órdenes de Compra</strong> — Conteo por OC y cumplimiento.</li>
            <li><strong>Líneas</strong> — Total, entregadas, a tiempo, con retraso, pendientes.</li>
            <li><strong>Cumplimiento</strong> — Distribución pie (anticipado, a tiempo, retrasado, pendiente).</li>
            <li><strong>Semáforo</strong> — Clasificación por días de incumplimiento.</li>
            <li><strong>Proveedores</strong> — Top 5 por líneas y USD, ranking de cumplimiento.</li>
            <li><strong>Seguimiento 14 días hábiles</strong> — Líneas con/sin gestión reciente.</li>
            <li><strong>Pendientes por Categoría</strong> — Desglose FRONTERA / BDP.</li>
          </ul>
          <p className="mt-3 text-xs text-info">Todos los cálculos de días son en días hábiles (lunes a viernes, sin festivos Colombia).</p>
        </div>
      </Section>

      <Section title="3. Órdenes de Compra">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Muestra las órdenes agrupadas por número de OC. Cada OC se puede expandir para ver sus líneas.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Paginación de 25 OC por página.</li>
            <li>Filtro rápido: Todas, Con pendientes, Completadas.</li>
            <li>Búsqueda por OC, proveedor, gerencia o campo.</li>
            <li>Barra de progreso de cumplimiento por OC.</li>
          </ul>
        </div>
      </Section>

      <Section title="4. Operaciones (Líneas)">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Centro de control por <strong className="text-foreground">línea</strong> (LLAVE = OC + Posición). Muestra TODAS las líneas (nacionales + importaciones).</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Tabla con TanStack Table: ordenar, filtrar, paginar.</li>
            <li>Columnas: LLAVE, OC, Pos, Proveedor, Material, QTY, Estado, Días incumplimiento, USD, etc.</li>
            <li>Filtros: Gerencia, Campo, Tipo Compra, Proveedor, Estado Línea, Status, Prioridad.</li>
            <li>Exportar a Excel con los filtros aplicados.</li>
            <li>Expandir fila para ver detalle completo (fechas, logística, valores).</li>
            <li>Click en LLAVE para ir al detalle completo de la línea.</li>
          </ul>
        </div>
      </Section>

      <Section title="5. Módulo de Importaciones">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Dashboard independiente para el seguimiento de <strong className="text-foreground">órdenes internacionales</strong>.</p>
          <p className="font-medium text-foreground">Indicadores propios:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Total líneas, OC, proveedores, entregadas, pendientes, vencidas, USD pendiente.</li>
            <li>Gráficos: estado de importaciones, modalidad, incoterms, top proveedores.</li>
          </ul>
          <p className="font-medium text-foreground mt-3">Filtros:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Proveedor, Incoterms, Modalidad, Destino, Estado.</li>
          </ul>
          <p className="font-medium text-foreground mt-3">Tabla:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>LLAVE, OC, Proveedor, Material, Incoterms, Modalidad, QTY, Fechas logísticas (ETD, ETA Puerto, ETA Campo), Estado, USD.</li>
            <li>Paginación 25 por página, exportar a Excel.</li>
          </ul>
          <p className="mt-3 text-xs text-info">Las importaciones NO aparecen en el Dashboard Gerencial. Se gestionan desde este módulo y desde Operaciones.</p>
        </div>
      </Section>

      <Section title="6. Importar Excel">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Permite cargar datos desde archivos Excel (.xlsx, .xls).</p>
          <p className="font-medium text-foreground">Pasos:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Arrastre o seleccione su archivo Excel.</li>
            <li>El sistema detecta las hojas disponibles — seleccione la correcta:
              <ul className="list-disc pl-5 mt-1">
                <li><strong>"Data Final"</strong> — Para órdenes nacionales (Dashboard Gerencial).</li>
                <li><strong>"Importaciones"</strong> — Para órdenes internacionales (Módulo Importaciones).</li>
              </ul>
            </li>
            <li>Revise la vista previa con campos detectados.</li>
            <li>Click en <strong>"Confirmar e importar"</strong>.</li>
          </ol>
          <p className="mt-3 text-xs text-warning">⚠️ Si necesita actualizar los datos, primero use "Vaciar" para limpiar la base y luego reimporte.</p>
        </div>
      </Section>

      <Section title="7. Proyecciones">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Muestra las líneas pendientes de entrega organizadas por semana y proveedor.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Forecast semanal: próximas 8 semanas de entregas esperadas.</li>
            <li>Top proveedores con más líneas pendientes.</li>
            <li>Tabla paginada con fecha compromiso, días restantes, estado.</li>
            <li>Filtro por proveedor y semana.</li>
          </ul>
        </div>
      </Section>

      <Section title="8. Alertas Operativas">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Muestra alertas automáticas solo para <strong className="text-foreground">líneas activas</strong> (Sin entrega + Entrega Parcial).</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Incumplimiento crítico</strong> — Líneas pendientes con más de 30 días de incumplimiento.</li>
            <li><strong>Sin seguimiento</strong> — Líneas sin gestión en más de 14 días hábiles.</li>
            <li><strong>SLA vencido</strong> — Líneas con SLA vencido.</li>
            <li><strong>ETA vencida</strong> — Líneas con ETA pasada sin arribo.</li>
          </ul>
          <p className="mt-3 text-xs text-info">Los usuarios no administradores solo ven las alertas de sus líneas (por responsable).</p>
        </div>
      </Section>

      <Section title="9. Reportes">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Genera y exporta reportes en formato Excel:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Reporte operativo (todas las operaciones).</li>
            <li>Reporte por clientes.</li>
            <li>Reporte mensual.</li>
            <li>Reporte de demoras (SLA vencido).</li>
            <li>Reporte de facturación.</li>
            <li>Reporte de proyecciones.</li>
          </ul>
        </div>
      </Section>

      <Section title="10. Configuración">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p>Solo accesible para <strong className="text-foreground">administradores</strong>:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Crear, editar y eliminar usuarios.</li>
            <li>Cambiar roles (Admin, Operador, Visor).</li>
            <li>Cambiar contraseñas de usuarios.</li>
          </ul>
          <p className="mt-3">Todos los usuarios pueden ver: Manual de Usuario, Acerca de, y Legal.</p>
        </div>
      </Section>

      <Section title="Glosario">
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><strong className="text-foreground">LLAVE</strong> — Identificador único: OC + Posición.</div>
            <div><strong className="text-foreground">OC</strong> — Orden de Compra.</div>
            <div><strong className="text-foreground">BF</strong> — Estado de entrega (Borrado, Entregado, Parcial, Sin entrega).</div>
            <div><strong className="text-foreground">BH</strong> — Indicador de liberación (0=Activa, L=Liberada, B=Bloqueada).</div>
            <div><strong className="text-foreground">BC</strong> — Valor total USD de la línea.</div>
            <div><strong className="text-foreground">ETD</strong> — Fecha estimada de salida (origen).</div>
            <div><strong className="text-foreground">ETA</strong> — Fecha estimada de llegada.</div>
            <div><strong className="text-foreground">SLA</strong> — Acuerdo de nivel de servicio.</div>
            <div><strong className="text-foreground">Días hábiles</strong> — Lunes a viernes, sin festivos Colombia.</div>
            <div><strong className="text-foreground">FRONTERA / BDP</strong> — Categorías de seguimiento operativo.</div>
          </div>
        </div>
      </Section>
    </div>
  );
}
