import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Ship, Package, TrendingUp, Globe2 } from "lucide-react";

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
    <div className="min-h-screen flex">
      {/* ═══ Panel izquierdo: Visual / Branding ═══ */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative items-center justify-center p-12 overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <img src="/login-bg.png" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-blue-950/60 to-black/80" />
        </div>

        {/* Animated particles overlay */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-2 h-2 rounded-full bg-blue-400/40 animate-ping" style={{ animationDuration: "3s" }} />
          <div className="absolute top-2/3 right-1/3 w-1.5 h-1.5 rounded-full bg-emerald-400/40 animate-ping" style={{ animationDuration: "4s", animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-2/3 w-2 h-2 rounded-full bg-cyan-400/30 animate-ping" style={{ animationDuration: "5s", animationDelay: "2s" }} />
          <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 rounded-full bg-blue-300/30 animate-ping" style={{ animationDuration: "3.5s", animationDelay: "0.5s" }} />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center max-w-lg">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <img src="/logo-main.png" alt="LogiControl" className="h-28 w-28 drop-shadow-2xl" />
          </div>

          <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">LogiControl</h2>
          
          <p className="text-lg text-blue-100/90 font-medium mb-3 italic">
            Transformando la gestión logística en decisiones inteligentes.
          </p>
          
          <p className="text-sm text-blue-200/70 leading-relaxed mb-8">
            LogiControl integra información, seguimiento y análisis en una sola plataforma
            para brindar visibilidad completa de cada operación, optimizando la toma de
            decisiones y fortaleciendo la eficiencia en toda la cadena de suministro.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/90 border border-white/20 backdrop-blur-sm">
              <Ship className="h-3 w-3" /> Tracking en tiempo real
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/90 border border-white/20 backdrop-blur-sm">
              <TrendingUp className="h-3 w-3" /> Dashboard gerencial
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/90 border border-white/20 backdrop-blur-sm">
              <Package className="h-3 w-3" /> Control de órdenes
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/90 border border-white/20 backdrop-blur-sm">
              <Globe2 className="h-3 w-3" /> Importaciones
            </span>
          </div>
        </div>

        {/* Bottom credit */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p className="text-xs text-white/40">© 2026 LogiControl · Desarrollado por Misael Becerra</p>
        </div>
      </div>

      {/* ═══ Panel derecho: Formulario ═══ */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          {/* Logo (visible en mobile donde no se ve el panel izquierdo) */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-12 w-12 rounded-xl overflow-hidden shadow-lg">
              <img src="/logo-main.png" alt="LogiControl" className="h-12 w-12 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">LogiControl</h1>
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
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  placeholder="Tu nombre" />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Correo electrónico</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="tu@empresa.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Contraseña</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={busy}
              className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm">
              {busy ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "¿Sin cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary hover:underline font-medium">
              {mode === "login" ? "Registrarse" : "Iniciar sesión"}
            </button>
          </div>

          {/* Mobile footer */}
          <div className="mt-10 text-center lg:hidden">
            <p className="text-[11px] text-muted-foreground">© 2026 LogiControl · Desarrollado por Misael Becerra</p>
          </div>
        </div>
      </div>
    </div>
  );
}
