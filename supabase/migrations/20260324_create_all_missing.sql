-- ============================================
-- CISEAU NOIR - Tables manquantes
-- Coller dans Supabase SQL Editor et exécuter
-- ============================================

-- 1. PORTFOLIO
create table if not exists portfolio (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text,
  tags text[],
  barber text default 'Melynda',
  created_at timestamptz default now()
);
alter table portfolio enable row level security;
create policy "Allow all portfolio" on portfolio for all using (true) with check (true);

-- 2. WAITLIST
create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text not null,
  barber text not null,
  service text,
  client_name text not null,
  client_phone text not null,
  client_email text,
  notified boolean default false,
  created_at timestamptz default now()
);
alter table waitlist enable row level security;
create policy "Allow all waitlist" on waitlist for all using (true) with check (true);
create index if not exists waitlist_date_time_barber on waitlist(date, time, barber);

-- 3. MESSENGER CONVERSATIONS
create table if not exists messenger_conversations (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null unique,
  sender_name text,
  messages jsonb not null default '[]'::jsonb,
  customer_profile jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table messenger_conversations enable row level security;
create policy "service_role_full_access" on messenger_conversations for all to service_role using (true) with check (true);

-- 4. PUSH SUBSCRIPTIONS
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  keys jsonb not null,
  client_email text,
  created_at timestamptz default now()
);
alter table push_subscriptions enable row level security;
create policy "Allow all push" on push_subscriptions for all using (true) with check (true);

-- 5. GIFT CARDS
create table if not exists gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  buyer_name text not null,
  buyer_email text not null,
  recipient_name text,
  recipient_email text,
  amount numeric not null,
  balance numeric not null,
  message text,
  redeemed boolean default false,
  created_at timestamptz default now()
);
alter table gift_cards enable row level security;
create policy "Allow all gc" on gift_cards for all using (true) with check (true);

-- 6. REFERRALS
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_name text not null,
  referrer_email text not null,
  referred_name text not null,
  referred_email text not null,
  referrer_code text not null,
  referred_used boolean default false,
  referrer_rewarded boolean default false,
  created_at timestamptz default now()
);
alter table referrals enable row level security;
create policy "Allow all ref" on referrals for all using (true) with check (true);
