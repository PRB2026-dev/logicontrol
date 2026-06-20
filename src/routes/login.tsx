import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Package } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user && !loading) navigate({ to: "/" });
  }, [user, loading, navigate]);

  if (user) return <Navigate to="/" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email },
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revisa tu correo para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Sesión iniciada");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de autenticación";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">LogiControl</h1>
            <p className="text-xs text-muted-foreground">ERP Operativo Corporativo</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-1">
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Accede a tu panel operativo." : "Regístrate para comenzar."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                placeholder="Tu nombre"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="tu@empresa.com"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? "¿Sin cuenta?" : "¿Ya tienes cuenta?"}{" "}
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-primary hover:underline font-medium"
          >
            {mode === "login" ? "Registrarse" : "Iniciar sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
