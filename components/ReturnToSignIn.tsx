"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReturnToSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function returnToSignIn() {
    setBusy(true);
    setError("");
    const { error: signOutError } = await createClient().auth.signOut({ scope: "local" });
    if (signOutError) {
      setError(signOutError.message);
      setBusy(false);
      return;
    }
    window.location.replace("/login");
  }

  return <>
    <button className="primary" disabled={busy} onClick={returnToSignIn}>
      {busy ? "Signing out…" : "Sign out and return to sign in →"}
    </button>
    {error && <p role="alert" className="auth-error">{error}</p>}
  </>;
}
