"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function Login() {
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) { alert(error.message); setBusy(false); }
  }
  return <main className="auth-shell"><div className="auth-mark">POPUP.NYC</div><section className="auth-card"><p className="eyebrow">OPERATIONS / CHAIN STUDIO</p><h1>Ideas move<br/>in sequences.</h1><p>Choose the Google account with superadmin access to build prompt chains and review their output.</p><button className="primary" disabled={busy} onClick={signIn}>{busy ? "Opening Google…" : "Continue with Google →"}</button></section><footer>POPUP.NYC · PRIVATE WORKSPACE</footer></main>;
}
