create table if not exists messenger_conversations (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null unique,
  sender_name text,
  messages jsonb not null default '[]'::jsonb,
  customer_profile jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index on updated_at for efficient ordering by recency in admin views
create index if not exists idx_messenger_conversations_updated_at
  on messenger_conversations (updated_at desc);

-- Index on sender_id already enforced by UNIQUE constraint (implicit index)
-- Extra index on sender_name for search
create index if not exists idx_messenger_conversations_sender_name
  on messenger_conversations (sender_name);

-- Enable Row Level Security
alter table messenger_conversations enable row level security;

-- Policy: only the service role (server-side API routes) can read/write
-- Anon and authenticated users have no direct access — all access goes through API routes
create policy "service_role_full_access" on messenger_conversations
  for all
  to service_role
  using (true)
  with check (true);

-- Deny all access to anon and authenticated roles (explicit deny — belt and suspenders)
create policy "no_public_access" on messenger_conversations
  for all
  to anon, authenticated
  using (false);
