-- Supabase schema for 3D Print Quote System

-- profiles table
create table profiles (
  id uuid primary key references auth.users(id),
  email text not null,
  role text check (role in ('user', 'admin')) not null default 'user',
  created_at timestamptz default now()
);

-- quote_requests table
create table quote_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  status text check (status in ('pending_review','approved','denied','paid','authorisation_failed')) not null default 'pending_review',
  file_path text not null,
  file_original_name text not null,
  file_mime text not null,
  file_size int not null,
  settings jsonb not null,
  post_processing jsonb not null,
  quantity int not null,
  notes text,
  postcode text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- quote_decisions table
create table quote_decisions (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid references quote_requests(id),
  admin_id uuid references profiles(id),
  final_amount_pence int not null,
  breakdown jsonb not null,
  decision_notes text,
  decided_at timestamptz default now()
);

-- payments table
create table payments (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid references quote_requests(id),
  stripe_payment_intent_id text not null,
  amount_authorised_pence int not null,
  amount_captured_pence int,
  currency text not null,
  status text check (status in ('requires_capture','captured','canceled','failed')) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Storage bucket: models
-- (Create in Supabase dashboard: Bucket name = models)
-- Store files under user_id/quote_id/filename

-- RLS Policies
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table quote_requests enable row level security;
alter table quote_decisions enable row level security;
alter table payments enable row level security;

-- RLS for profiles
create policy "Users can view their profile" on profiles for select using (auth.uid() = id);
create policy "Admins can view all profiles" on profiles for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- RLS for quote_requests
create policy "Users can insert/select their own quotes" on quote_requests for all using (user_id = auth.uid());
create policy "Admins can select/update all quotes" on quote_requests for select, update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- RLS for quote_decisions
create policy "Admins can insert/select/update" on quote_decisions for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- RLS for payments
create policy "Users can select their own payments" on payments for select using (quote_request_id in (select id from quote_requests where user_id = auth.uid()));
create policy "Admins can select/update all payments" on payments for select, update using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
