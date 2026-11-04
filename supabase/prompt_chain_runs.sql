-- Run after popup-admin/supabase/admin_security.sql and admin_resources.sql.
create table if not exists public.prompt_chain_runs (
  id uuid primary key default gen_random_uuid(),
  humor_flavor_id bigint not null references public.humor_flavors(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  input_text text,
  input_image_url text,
  output_text text,
  step_outputs jsonb not null default '[]'::jsonb,
  status text not null default 'running' check (status in ('running','completed','failed')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.prompt_chain_runs enable row level security;
drop policy if exists "superadmin access" on public.prompt_chain_runs;
create policy "superadmin access" on public.prompt_chain_runs for all to authenticated
  using (public.is_superadmin(auth.uid())) with check (public.is_superadmin(auth.uid()));
grant select, insert, update, delete on public.prompt_chain_runs to authenticated;
create index if not exists prompt_chain_runs_flavor_created_idx on public.prompt_chain_runs(humor_flavor_id, created_at desc);
