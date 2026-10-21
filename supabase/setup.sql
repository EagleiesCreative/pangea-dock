-- Pangea Dock — one-time database setup.
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run.

-- Pangea Dock: one show document per production (Clerk organization id).
-- Only the Next.js server talks to this table (service-role key), so RLS is on with no policies.

create table if not exists public.pangea_shows (
  org_id     text primary key,
  data       jsonb not null default '{}'::jsonb,
  version    bigint not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table public.pangea_shows enable row level security;

-- Atomic per-section merge: top-level keys in p_patch replace the same keys in data.
create or replace function public.pangea_merge_show(p_org text, p_patch jsonb, p_user text)
returns table (data jsonb, version bigint, updated_by text, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  insert into public.pangea_shows as s (org_id, data, version, updated_by, updated_at)
  values (p_org, p_patch, 1, p_user, now())
  on conflict (org_id) do update
    set data = s.data || excluded.data,
        version = s.version + 1,
        updated_by = excluded.updated_by,
        updated_at = now()
  returning s.data, s.version, s.updated_by, s.updated_at;
$$;

revoke all on function public.pangea_merge_show(text, jsonb, text) from public, anon, authenticated;

-- Make the new table/function visible to the API immediately.
notify pgrst, 'reload schema';
