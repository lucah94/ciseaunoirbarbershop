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
create policy "Allow all" on waitlist for all using (true) with check (true);
create index if not exists waitlist_date_time_barber on waitlist(date, time, barber);
