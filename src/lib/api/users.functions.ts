import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Context provided by requireSupabaseAuth middleware
type AuthContext = { userId: string };

/** Lanza un error si el usuario autenticado no tiene rol admin */
async function assertAdmin(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.role !== "admin") {
    throw new Error("Solo los administradores pueden realizar esta acción");
  }
}

export type UserRow = {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
};

// ─── Listar usuarios ──────────────────────────────────────────────────────────
export const listUsersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as unknown as AuthContext;
    await assertAdmin(userId);
    const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, email, display_name, created_at")
        .order("created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (pe) throw new Error(pe.message);
    if (re) throw new Error(re.message);
    const roleMap = new Map<string, string>();
    (roles ?? []).forEach((r) => roleMap.set(r.user_id, r.role));
    return (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      email: p.email ?? "",
      display_name: p.display_name ?? "",
      role: roleMap.get(p.user_id) ?? "viewer",
      created_at: p.created_at,
    })) as UserRow[];
  });

// ─── Crear usuario ────────────────────────────────────────────────────────────
export const createUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().email("Correo inválido").max(254),
      password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
      display_name: z.string().min(1, "El nombre es requerido").max(100)
        .transform(v => v.replace(/[<>'"&]/g, "")),
      role: z.enum(["admin", "operador", "viewer"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context as unknown as AuthContext;
    await assertAdmin(userId);

    // Crear en auth.users usando service role (bypasa confirmación de email)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (authErr) throw new Error("Error al crear el usuario. Verifique que el correo no esté registrado.");
    const newId = authData.user.id;

    // Crear perfil
    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      user_id: newId,
      email: data.email,
      display_name: data.display_name,
    });
    if (profErr) throw new Error(profErr.message);

    // Asignar rol
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: newId, role: data.role });
    if (roleErr) throw new Error(roleErr.message);

    return { success: true, user_id: newId };
  });

// ─── Actualizar rol ───────────────────────────────────────────────────────────
export const updateRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["admin", "operador", "viewer"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context as unknown as AuthContext;
    await assertAdmin(userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Eliminar usuario ─────────────────────────────────────────────────────────
export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ user_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { userId } = context as unknown as AuthContext;
    await assertAdmin(userId);
    if (data.user_id === userId) {
      throw new Error("No puedes eliminar tu propia cuenta");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("profiles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

// ─── Cambiar contraseña ───────────────────────────────────────────────────────
export const changePasswordAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      user_id: z.string().uuid(),
      new_password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = context as unknown as AuthContext;
    await assertAdmin(userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.new_password,
    });
    if (error) throw new Error(error.message);
    return { success: true };
  });
