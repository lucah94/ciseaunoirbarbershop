-- BOOKINGS (réservations en ligne)
create table bookings (
  id uuid default gen_random_uuid() primary key,
  client_name text not null,
  client_phone text not null,
  client_email text not null,
  barber text not null,
  service text not null,
  price numeric(10,2) not null,
  date date not null,
  time text not null,
  status text default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  note text default '',
  created_at timestamptz default now()
);

-- CUTS (coupes entrées manuellement par les barbières)
create table cuts (
  id uuid default gen_random_uuid() primary key,
  barber text not null,
  service_name text not null,
  price numeric(10,2) not null,
  tip numeric(10,2) default 0,
  discount_percent numeric(5,2) default 0,
  date date not null,
  booking_id uuid references bookings(id) on delete set null,
  created_at timestamptz default now()
);

-- EXPENSES (dépenses / factures)
create table expenses (
  id uuid default gen_random_uuid() primary key,
  description text not null,
  amount numeric(10,2) not null,
  category text not null,
  date date not null,
  created_at timestamptz default now()
);

-- Enable RLS (Row Level Security)
alter table bookings enable row level security;
alter table cuts enable row level security;
alter table expenses enable row level security;

-- Allow all operations for now (à sécuriser plus tard avec auth)
create policy "Allow all" on bookings for all using (true) with check (true);
create policy "Allow all" on cuts for all using (true) with check (true);
create policy "Allow all" on expenses for all using (true) with check (true);
