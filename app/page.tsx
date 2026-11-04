import { redirect } from "next/navigation";
import { getSuperadmin } from "@/lib/auth";
import Studio from "@/components/Studio";

export default async function Home() {
  const { supabase, user, authorized } = await getSuperadmin();
  if (!user) redirect("/login");
  if (!authorized) redirect("/unauthorized");
  const [chains, steps, models, runs] = await Promise.all([
    supabase.from("humor_flavors").select("*").order("created_datetime_utc", { ascending: false }),
    supabase.from("humor_flavor_steps").select("*").order("order_by"),
    supabase.from("llm_models").select("id,name,provider_model_id").order("name"),
    supabase.from("prompt_chain_runs").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  return <Studio initialChains={chains.data ?? []} initialSteps={steps.data ?? []} models={models.data ?? []} initialRuns={runs.data ?? []} dataError={chains.error?.message ?? steps.error?.message ?? null} runError={runs.error?.message ?? null} userEmail={user.email ?? "Admin"} />;
}
