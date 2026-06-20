import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "admin" | "operador" | "viewer";

export function useMyRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    if (!user) { setRole(null); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancel) return;
        const roles = (data ?? []).map((r) => r.role as AppRole);
        const top: AppRole = roles.includes("admin") ? "admin" : roles.includes("operador") ? "operador" : roles[0] ?? "viewer";
        setRole(top);
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [user]);

  return { role, isAdmin: role === "admin", loading };
}
