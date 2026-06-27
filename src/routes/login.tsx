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
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 items-center justify-center p-12 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Floating elements */}
        <div className="absolute top-20 left-16 h-20 w-20 rounded-2xl bg-blue-500/20 backdrop-blur-sm border border-blue-400/20 flex items-center justify-center animate-pulse">
          <Ship className="h-10 w-10 text-blue-300" />
        </div>
        <div className="absolute bottom-32 right-20 h-16 w-16 rounded-xl bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/20 flex items-center justify-center">
          <TrendingUp className="h-8 w-8 text-emerald-300" />
        </div>
        <div className="absolute top-1/3 right-16 h-14 w-14 rounded-xl bg-amber-500/20 backdrop-blur-sm border border-amber-400/20 flex items-center justify-center">
          <Package className="h-7 w-7 text-amber-300" />
        </div>
        <div className="absolute bottom-20 left-24 h-12 w-12 rounded-lg bg-purple-500/20 backdrop-blur-sm border border-purple-400/20 flex items-center justify-center">
          <Globe2 className="h-6 w-6 text-purple-300" />
        </div>

        {/* Main illustration */}
        <div className="relative z-10 text-center max-w-md">
          {/* Container ship SVG illustration */}
          <div className="mb-8">
            <svg viewBox="0 0 400 300" className="w-full h-auto max-w-[360px] mx-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Water */}
              <path d="M0 250 Q50 240 100 250 Q150 260 200 250 Q250 240 300 250 Q350 260 400 250 L400 300 L0 300Z" fill="#1e3a5f" opacity="0.5" />
              <path d="M0 260 Q50 250 100 260 Q150 270 200 260 Q250 250 300 260 Q350 270 400 260 L400 300 L0 300Z" fill="#1e3a5f" opacity="0.3" />
              {/* Ship hull */}
              <path d="M80 220 L90 250 L310 250 L320 220 L300 180 L100 180Z" fill="#334155" stroke="#475569" strokeWidth="1" />
              <rect x="100" y="180" width="200" height="10" fill="#475569" rx="2" />
              {/* Containers row 1 */}
              <rect x="110" y="140" width="35" height="38" fill="#3b82f6" rx="2" stroke="#60a5fa" strokeWidth="0.5" />
              <rect x="150" y="140" width="35" height="38" fill="#ef4444" rx="2" stroke="#f87171" strokeWidth="0.5" />
              <rect x="190" y="140" width="35" height="38" fill="#10b981" rx="2" stroke="#34d399" strokeWidth="0.5" />
              <rect x="230" y="140" width="35" height="38" fill="#f59e0b" rx="2" stroke="#fbbf24" strokeWidth="0.5" />
              <rect x="270" y="140" width="25" height="38" fill="#8b5cf6" rx="2" stroke="#a78bfa" strokeWidth="0.5" />
              {/* Containers row 2 */}
              <rect x="120" y="100" width="35" height="38" fill="#0ea5e9" rx="2" stroke="#38bdf8" strokeWidth="0.5" />
              <rect x="160" y="100" width="35" height="38" fill="#f97316" rx="2" stroke="#fb923c" strokeWidth="0.5" />
              <rect x="200" y="100" width="35" height="38" fill="#6366f1" rx="2" stroke="#818cf8" strokeWidth="0.5" />
              <rect x="240" y="100" width="30" height="38" fill="#14b8a6" rx="2" stroke="#2dd4bf" strokeWidth="0.5" />
              {/* Containers row 3 */}
              <rect x="140" y="62" width="35" height="36" fill="#ec4899" rx="2" stroke="#f472b6" strokeWidth="0.5" />
              <rect x="180" y="62" width="35" height="36" fill="#84cc16" rx="2" stroke="#a3e635" strokeWidth="0.5" />
              {/* Bridge / cabin */}
              <rect x="285" y="100" width="30" height="80" fill="#1e293b" stroke="#475569" strokeWidth="1" rx="3" />
              <rect x="289" y="108" width="10" height="8" fill="#38bdf8" opacity="0.7" rx="1" />
              <rect x="302" y="108" width="10" height="8" fill="#38bdf8" opacity="0.7" rx="1" />
              <rect x="289" y="120" width="10" height="8" fill="#fbbf24" opacity="0.5" rx="1" />
              {/* Crane */}
              <line x1="130" y1="62" x2="130" y2="30" stroke="#94a3b8" strokeWidth="2" />
              <line x1="130" y1="30" x2="180" y2="30" stroke="#94a3b8" strokeWidth="2" />
              <line x1="180" y1="30" x2="180" y2="45" stroke="#64748b" strokeWidth="1" strokeDasharray="3 2" />
            </svg>
          </div>

          {/* Text */}
          <h2 className="text-3xl font-bold text-white mb-3">LogiControl</h2>
          <p className="text-blue-200/80 text-sm leading-relaxed mb-8">
            Plataforma centralizada para el control y seguimiento de operaciones
            de importación, compras y logística empresarial.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-400/20">
              <Ship className="h-3 w-3" /> Tracking en tiempo real
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/20">
              <TrendingUp className="h-3 w-3" /> Dashboard gerencial
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-200 border border-amber-400/20">
              <Package className="h-3 w-3" /> Control de órdenes
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-200 border border-purple-400/20">
              <Globe2 className="h-3 w-3" /> Importaciones
            </span>
          </div>
        </div>

        {/* Bottom credit */}
        <div className="absolute bottom-6 left-0 right-0 text-center">
          <p className="text-xs text-blue-300/50">© 2026 LogiControl · Desarrollado por Misael Becerra</p>
        </div>
      </div>

      {/* ═══ Panel derecho: Formulario ═══ */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-background">
        <div className="w-full max-w-sm">
          {/* Logo (visible en mobile donde no se ve el panel izquierdo) */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <Ship className="h-6 w-6" />
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
