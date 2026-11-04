import { createClient } from "@/lib/supabase/server";
export default async function Unauthorized() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <main className="auth-shell"><div className="auth-mark">POPUP.NYC</div><section className="auth-card"><p className="eyebrow">ACCESS / RESTRICTED</p><h1>Access required.</h1><p>{user?.email ?? "This account"} is signed in, but does not have superadmin access.</p><a className="primary" href="/login">Return to sign in →</a></section></main>;
}
