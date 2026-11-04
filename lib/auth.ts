import { createClient } from "@/lib/supabase/server";

export async function getSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, authorized: false };
  const { data: profile } = await supabase.from("profiles").select("is_superadmin").eq("id", user.id).single();
  return { supabase, user, authorized: profile?.is_superadmin === true };
}
