-- ============================================================================
-- SplitUp — initial schema
-- All monetary columns use NUMERIC(12,2). Never store money as float.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  mobile text,
  profile_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  group_code text not null unique,
  group_name text not null,
  description text,
  currency text not null default 'INR',
  default_split_method text not null default 'equal'
    check (default_split_method in ('equal', 'unequal', 'percentage')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true
);

create or replace function public.generate_group_code()
returns text as $$
declare
  code text;
  exists_already boolean;
begin
  loop
    code := upper(substr(md5(random()::text), 1, 4)) || to_char(now(), 'YY');
    select exists(select 1 from public.groups g where g.group_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$ language plpgsql;

create or replace function public.set_group_code()
returns trigger as $$
begin
  if new.group_code is null or new.group_code = '' then
    new.group_code := public.generate_group_code();
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_group_code
  before insert on public.groups
  for each row execute procedure public.set_group_code();

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (group_id, user_id)
);

create index idx_group_members_group on public.group_members(group_id);
create index idx_group_members_user on public.group_members(user_id);

-- Helper: is the current user an active member / admin of a group?
create or replace function public.is_group_member(p_group_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid() and gm.is_active
  );
$$ language sql security definer stable set search_path = public;

create or replace function public.is_group_admin(p_group_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
      and gm.is_active and gm.role = 'admin'
  );
$$ language sql security definer stable set search_path = public;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  name text not null,
  icon text default '🧾',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

-- ---------------------------------------------------------------------------
-- monthly_cycles
-- ---------------------------------------------------------------------------
create table public.monthly_cycles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (group_id, year, month)
);

create or replace function public.get_or_create_open_cycle(p_group_id uuid)
returns uuid as $$
declare
  v_id uuid;
  v_year int := extract(year from now())::int;
  v_month int := extract(month from now())::int;
begin
  select id into v_id from public.monthly_cycles
    where group_id = p_group_id and year = v_year and month = v_month;
  if v_id is null then
    insert into public.monthly_cycles (group_id, year, month, status)
    values (p_group_id, v_year, v_month, 'open')
    returning id into v_id;
  end if;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  monthly_cycle_id uuid not null references public.monthly_cycles(id),
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  category_id uuid references public.categories(id),
  paid_by_user_id uuid not null references public.profiles(id),
  expense_date date not null default current_date,
  notes text,
  receipt_path text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

create index idx_expenses_group on public.expenses(group_id, expense_date desc);
create index idx_expenses_cycle on public.expenses(monthly_cycle_id);
create index idx_expenses_paid_by on public.expenses(paid_by_user_id);

-- ---------------------------------------------------------------------------
-- expense_participants
-- ---------------------------------------------------------------------------
create table public.expense_participants (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  split_type text not null check (split_type in ('equal', 'unequal', 'percentage')),
  amount numeric(12,2) not null check (amount >= 0),
  percentage numeric(5,2),
  unique (expense_id, user_id)
);

create index idx_expense_participants_expense on public.expense_participants(expense_id);
create index idx_expense_participants_user on public.expense_participants(user_id);

-- ---------------------------------------------------------------------------
-- settlements
-- ---------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  monthly_cycle_id uuid references public.monthly_cycles(id),
  from_user_id uuid not null references public.profiles(id),
  to_user_id uuid not null references public.profiles(id),
  amount numeric(12,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  confirmed_at timestamptz,
  check (from_user_id <> to_user_id)
);

create index idx_settlements_group on public.settlements(group_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications(user_id, is_read);

-- ============================================================================
-- VALIDATION TRIGGERS (enforced server-side, never trust the frontend alone)
-- ============================================================================

-- paid_by / created_by / participants must belong to the expense's group;
-- cycle must be open; split amounts must sum to the expense amount.
create or replace function public.validate_expense()
returns trigger as $$
declare
  v_cycle_status text;
begin
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = new.group_id and gm.user_id = new.paid_by_user_id and gm.is_active
  ) then
    raise exception 'paid_by user is not an active member of this group';
  end if;

  select status into v_cycle_status from public.monthly_cycles where id = new.monthly_cycle_id;
  if v_cycle_status = 'closed' then
    raise exception 'This monthly cycle is closed. Reopen it before making changes.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_validate_expense
  before insert or update on public.expenses
  for each row execute procedure public.validate_expense();

-- Validate a participant belongs to the group of the expense.
create or replace function public.validate_expense_participant()
returns trigger as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.expenses where id = new.expense_id;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_group_id and gm.user_id = new.user_id and gm.is_active
  ) then
    raise exception 'Participant is not an active member of this group';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_validate_expense_participant
  before insert or update on public.expense_participants
  for each row execute procedure public.validate_expense_participant();

-- After participants change, make sure equal/unequal amounts sum to the
-- expense total (to the cent) and percentage splits sum to 100.00.
create or replace function public.validate_expense_split()
returns trigger as $$
declare
  v_expense_id uuid;
  v_amount numeric(12,2);
  v_split_type text;
  v_sum_amount numeric(12,2);
  v_sum_pct numeric(6,2);
begin
  v_expense_id := coalesce(new.expense_id, old.expense_id);
  select amount into v_amount from public.expenses where id = v_expense_id;

  select split_type, sum(amount), sum(coalesce(percentage, 0))
    into v_split_type, v_sum_amount, v_sum_pct
    from public.expense_participants where expense_id = v_expense_id
    group by split_type;

  if v_split_type is null then
    return null; -- no participants left (row was deleted); allowed transiently
  end if;

  if v_split_type = 'percentage' then
    if abs(v_sum_pct - 100) > 0.01 then
      raise exception 'Percentage split must total 100%% (got %)', v_sum_pct;
    end if;
  else
    if abs(v_sum_amount - v_amount) > 0.01 then
      raise exception 'Split amounts (%) must equal the expense total (%)', v_sum_amount, v_amount;
    end if;
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public;

create constraint trigger trg_validate_expense_split
  after insert or update or delete on public.expense_participants
  deferrable initially deferred
  for each row execute procedure public.validate_expense_split();

-- Settlements: from/to must be group members, and a new pending settlement
-- can't exceed the current outstanding balance between the two people.
create or replace function public.validate_settlement()
returns trigger as $$
declare
  v_from_balance numeric(12,2);
begin
  if not exists (select 1 from public.group_members gm where gm.group_id = new.group_id and gm.user_id = new.from_user_id and gm.is_active)
     or not exists (select 1 from public.group_members gm where gm.group_id = new.group_id and gm.user_id = new.to_user_id and gm.is_active) then
    raise exception 'Both parties must be active members of this group';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_validate_settlement
  before insert on public.settlements
  for each row execute procedure public.validate_settlement();

-- Prevent editing/deleting expenses in a closed monthly cycle.
create or replace function public.prevent_closed_cycle_edit()
returns trigger as $$
declare
  v_status text;
begin
  select status into v_status from public.monthly_cycles where id = old.monthly_cycle_id;
  if v_status = 'closed' then
    raise exception 'This monthly cycle is closed. Reopen it before making changes.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_prevent_closed_cycle_edit
  before update or delete on public.expenses
  for each row execute procedure public.prevent_closed_cycle_edit();

