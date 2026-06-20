import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/configuracion")({
  component: () => (
    <AppShell>
      <Config />
    </AppShell>
  ),
});

const usuarios = [
  { nombre: "Operaciones Demo", correo: "ops@logicontrol.com", rol: "Administrador" },
  { nombre: "María González", correo: "maria@logicontrol.com", rol: "Operaciones" },
  { nombre: "Carlos Pérez", correo: "carlos@logicontrol.com", rol: "Comercial" },
  { nombre: "Cliente Andina", correo: "contacto@andina.com", rol: "Cliente" },
];

function Config() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground">Usuarios, roles y parámetros del sistema.</p>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Usuarios</h3>
          <button className="px-3 h-8 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90">+ Nuevo usuario</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide text-left">
            <tr>
              <th className="px-4 py-2.5">Nombre</th>
              <th className="px-4 py-2.5">Correo</th>
              <th className="px-4 py-2.5">Rol</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.correo} className="border-t border-border">
                <td className="px-4 py-3 text-foreground font-medium">{u.nombre}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.correo}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">{u.rol}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
