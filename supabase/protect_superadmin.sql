-- Keep existing profile edits available while preventing a signed-in user
-- from granting themselves superadmin access through the Data API.
create or replace function public.prevent_self_promotion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.is_superadmin is distinct from old.is_superadmin then
    raise exception 'Superadmin access can only be changed by a database administrator';
  end if;
  return new;
end;
$$;

create trigger prevent_self_promotion
before update on public.profiles
for each row execute function public.prevent_self_promotion();
