create table if not exists portfolio (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  caption text,
  tags text[],
  barber text default 'Melynda',
  created_at timestamptz default now()
);

alter table portfolio enable row level security;
create policy "Allow all" on portfolio for all using (true) with check (true);
