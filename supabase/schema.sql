create extension if not exists "pgcrypto";

create table public.allowed_members (
  email text primary key,
  first_name text not null,
  role text not null default 'member',
  added_at timestamptz not null default now()
);

insert into public.allowed_members (email, first_name, role)
values ('david.faveiro@gmail.com', 'David', 'admin')
on conflict (email) do update
set first_name = excluded.first_name, role = excluded.role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  member public.allowed_members%rowtype;
begin
  select * into member
  from public.allowed_members
  where lower(email) = lower(new.email);

  if member.email is null then
    raise exception 'Email is not authorized for Watchers';
  end if;

  insert into public.profiles (id, first_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), member.first_name),
    member.role
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.concerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  venue text not null,
  city text,
  starts_at timestamptz not null,
  sound_system boolean not null default false,
  sound_notes text,
  booking_status text not null default 'mail_sent'
    check (booking_status in ('mail_sent', 'rejected', 'negotiating', 'confirmed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.concerts
  add column if not exists booking_status text not null default 'mail_sent';

alter table public.concerts drop constraint if exists concerts_booking_status_check;
alter table public.concerts
  add constraint concerts_booking_status_check
  check (booking_status in ('mail_sent', 'rejected', 'negotiating', 'confirmed'));

create table public.rehearsals (
  id uuid primary key default gen_random_uuid(),
  venue text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  amount numeric(10,2),
  payer_id uuid references public.profiles(id),
  payer_name text,
  is_paid boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.rehearsals
  add column if not exists payer_name text;

create table public.drive_files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  drive_url text not null,
  mime_type text,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.streaming_stats (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  period_start date not null,
  period_end date not null,
  streams integer not null default 0,
  imported_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('cd', 'vinyl', 'merch', 'other')),
  label text not null,
  amount numeric(10,2) not null,
  sold_at date not null default current_date,
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.allowed_members enable row level security;
alter table public.concerts enable row level security;
alter table public.rehearsals enable row level security;
alter table public.drive_files enable row level security;
alter table public.streaming_stats enable row level security;
alter table public.sales enable row level security;

create policy "Authenticated members can read profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update their profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Admins can read allowed members" on public.allowed_members for select to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Admins can manage allowed members" on public.allowed_members for all to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Members manage concerts" on public.concerts for all to authenticated using (true) with check (true);
create policy "Members manage rehearsals" on public.rehearsals for all to authenticated using (true) with check (true);
create policy "Members manage drive files" on public.drive_files for all to authenticated using (true) with check (true);
create policy "Members read streaming stats" on public.streaming_stats for select to authenticated using (true);
create policy "Members manage sales" on public.sales for all to authenticated using (true) with check (true);

alter publication supabase_realtime add table public.concerts;
alter publication supabase_realtime add table public.rehearsals;
alter publication supabase_realtime add table public.drive_files;
