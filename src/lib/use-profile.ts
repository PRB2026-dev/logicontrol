import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface UserProfile {
  user_id: string;
  email: string;
  display_name: string;
}

/**
 * Hook que obtiene el perfil del usuario logueado (display_name, email).
 * Útil para asociar el usuario con el campo "responsable" de los jobs.
 */
export function useMyProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    if (!user) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    supabase
      .from("profiles")
      .select("user_id, email, display_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        if (data) {
          setProfile({
            user_id: data.user_id,
            email: data.email ?? "",
            display_name: data.display_name ?? "",
          });
        } else {
          // Fallback: usar metadata del user de auth
          setProfile({
            user_id: user.id,
            email: user.email ?? "",
            display_name: (user.user_metadata?.display_name as string) ?? user.email ?? "",
          });
        }
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [user]);

  return { profile, loading };
}
