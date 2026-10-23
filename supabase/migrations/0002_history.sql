-- Pangea Dock: version history (one row per edit burst). Only the Next.js server writes here (service key).
create table if not exists public.pangea_history (
  id         bigserial primary key,
  org_id     text not null,
  version    bigint not null,
  updated_by text not null,
  sections   text[] not null default '{}',
  note       text,
  before     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pangea_history_org_idx on public.pangea_history (org_id, id desc);
alter table public.pangea_history enable row level security;

-- Guest-pass lookups filter on data->share->>token.
create index if not exists pangea_shows_share_token_idx on public.pangea_shows ((data->'share'->>'token'));

notify pgrst, 'reload schema';
