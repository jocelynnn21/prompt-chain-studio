# POPUP.NYC Chain Studio

A superadmin-only tool for editing reusable prompt chains, arranging their steps, running text and image-input chains, and reviewing output history.

## Setup

1. Run `popup-admin/supabase/admin_security.sql` and `popup-admin/supabase/admin_resources.sql` in Supabase if they have not been applied.
2. Run `supabase/prompt_chain_runs.sql` in the same project.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `OPENAI_API_KEY`. Optionally set `OPENAI_MODEL` (defaults to `gpt-4.1-mini`).
4. Add the deployment's `/auth/callback` URL to Supabase Auth redirect URLs.
5. Install and start with `npm install && npm run dev`.

The app checks `profiles.is_superadmin` on every protected page and generation request. Supabase row-level policies enforce the same check for all chain and run records. It does not use a service-role key.

A run accepts text, an HTTPS image URL, or both. The first active step gets the initial input; each following active step gets the previous step's text output. The final output and every intermediate result are saved to `prompt_chain_runs`.
