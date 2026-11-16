-- ============================================================================
-- Business-logic functions. The frontend never computes balances itself —
-- it always requests the result from these functions.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- get_group_balances(group_id, monthly_cycle_id default = all cycles)
-- Returns each active member's total paid, total share, and net balance.
-- Positive net_balance => should receive money. Negative => owes money.
-- ---------------------------------------------------------------------------
create or replace function public.get_group_balances(
  p_group_id uuid,
  p_monthly_cycle_id uuid default null
)
returns table (
  user_id uuid,
  name text,
  profile_image text,
  total_paid numeric(12,2),
  total_share numeric(12,2),
  net_balance numeric(12,2)
) as $$
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  return query
  with members as (
    select gm.user_id, p.name, p.profile_image
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id and gm.is_active
  ),
  paid as (
    select e.paid_by_user_id as user_id, coalesce(sum(e.amount), 0)::numeric(12,2) as total_paid
    from public.expenses e
    where e.group_id = p_group_id
      and e.is_deleted = false
      and (p_monthly_cycle_id is null or e.monthly_cycle_id = p_monthly_cycle_id)
    group by e.paid_by_user_id
  ),
  shares as (
    select ep.user_id, coalesce(sum(ep.amount), 0)::numeric(12,2) as total_share
    from public.expense_participants ep
    join public.expenses e on e.id = ep.expense_id
    where e.group_id = p_group_id
      and e.is_deleted = false
      and (p_monthly_cycle_id is null or e.monthly_cycle_id = p_monthly_cycle_id)
    group by ep.user_id
  )
  select
    m.user_id,
    m.name,
    m.profile_image,
    coalesce(pd.total_paid, 0)::numeric(12,2) as total_paid,
    coalesce(sh.total_share, 0)::numeric(12,2) as total_share,
    (coalesce(pd.total_paid, 0) - coalesce(sh.total_share, 0))::numeric(12,2) as net_balance
  from members m
  left join paid pd on pd.user_id = m.user_id
  left join shares sh on sh.user_id = m.user_id
  order by net_balance desc;
end;
$$ language plpgsql security definer stable set search_path = public;

-- ---------------------------------------------------------------------------
-- get_settlement_suggestions(group_id, monthly_cycle_id default = all)
-- Greedy debtor/creditor matching: minimizes the number of transactions
-- needed to settle every net balance to zero. Already-recorded settlements
-- (pending or paid/confirmed) are netted out first so suggestions reflect
-- what's actually still outstanding.
-- ---------------------------------------------------------------------------
create or replace function public.get_settlement_suggestions(
  p_group_id uuid,
  p_monthly_cycle_id uuid default null
)
returns table (
  from_user uuid,
  from_name text,
  to_user uuid,
  to_name text,
  amount numeric(12,2)
) as $$
declare
  rec record;
  debtors record;
  creditors record;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  create temp table if not exists tmp_balances (
    user_id uuid, name text, balance numeric(12,2)
  ) on commit drop;
  delete from tmp_balances;

  -- Start from computed balances, then subtract settlements already made
  -- (pending or confirmed both reduce what's left to suggest).
  insert into tmp_balances (user_id, name, balance)
  select b.user_id, b.name, b.net_balance
  from public.get_group_balances(p_group_id, p_monthly_cycle_id) b;

  update tmp_balances t
  set balance = t.balance - s.net
  from (
    select from_user_id as user_id, -sum(amount) as net
    from public.settlements
    where group_id = p_group_id
      and status in ('pending', 'paid', 'confirmed')
      and (p_monthly_cycle_id is null or monthly_cycle_id = p_monthly_cycle_id)
    group by from_user_id
    union all
    select to_user_id as user_id, sum(amount) as net
    from public.settlements
    where group_id = p_group_id
      and status in ('pending', 'paid', 'confirmed')
      and (p_monthly_cycle_id is null or monthly_cycle_id = p_monthly_cycle_id)
    group by to_user_id
  ) s
  where s.user_id = t.user_id;

  create temp table tmp_debtors on commit drop as
    select user_id, name, (-balance)::numeric(12,2) as amt
    from tmp_balances where balance < -0.005 order by balance asc;

  create temp table tmp_creditors on commit drop as
    select user_id, name, balance::numeric(12,2) as amt
    from tmp_balances where balance > 0.005 order by balance desc;

  for debtors in select * from tmp_debtors loop
    for creditors in select * from tmp_creditors where amt > 0.005 loop
      exit when debtors.amt <= 0.005;
      declare v_pay numeric(12,2);
      begin
        v_pay := least(debtors.amt, creditors.amt);
        if v_pay > 0.005 then
          from_user := debtors.user_id;
          from_name := debtors.name;
          to_user := creditors.user_id;
          to_name := creditors.name;
          amount := round(v_pay, 2);
          return next;

          update tmp_creditors set amt = amt - v_pay where user_id = creditors.user_id;
          debtors.amt := debtors.amt - v_pay;
        end if;
      end;
    end loop;
  end loop;

  drop table if exists tmp_debtors;
  drop table if exists tmp_creditors;
  drop table if exists tmp_balances;
  return;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- join_group_by_code(code) — lets an authenticated user look up and join a
-- group without needing a broad SELECT policy that exposes every group.
-- ---------------------------------------------------------------------------
create or replace function public.join_group_by_code(p_code text)
returns uuid as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where group_code = upper(p_code) and is_active;
  if v_group_id is null then
    raise exception 'No active group found with that code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do update set is_active = true;

  return v_group_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- close_month / reopen_month — admin-only, sets cycle status.
-- ---------------------------------------------------------------------------
create or replace function public.close_month(p_cycle_id uuid)
returns void as $$
declare v_group_id uuid;
begin
  select group_id into v_group_id from public.monthly_cycles where id = p_cycle_id;
  if not public.is_group_admin(v_group_id) then
    raise exception 'Only a group admin can close the month';
  end if;
  update public.monthly_cycles set status = 'closed', closed_at = now() where id = p_cycle_id;

  insert into public.notifications (user_id, group_id, type, title, message)
  select gm.user_id, v_group_id, 'cycle_closed', 'Monthly cycle closed', 'An admin closed this month. It is now read-only.'
  from public.group_members gm where gm.group_id = v_group_id and gm.is_active;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.reopen_month(p_cycle_id uuid)
returns void as $$
declare v_group_id uuid;
begin
  select group_id into v_group_id from public.monthly_cycles where id = p_cycle_id;
  if not public.is_group_admin(v_group_id) then
    raise exception 'Only a group admin can reopen the month';
  end if;
  update public.monthly_cycles set status = 'open', closed_at = null where id = p_cycle_id;
end;
$$ language plpgsql security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- Notification triggers for the key events the spec calls out.
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_expense_change()
returns trigger as $$
declare
  v_title text;
  v_message text;
  v_type text;
  v_group_id uuid;
begin
  v_group_id := coalesce(new.group_id, old.group_id);
  if tg_op = 'INSERT' then
    v_type := 'expense_added'; v_title := 'New expense added';
    v_message := new.description || ' — ' || new.amount::text;
  elsif tg_op = 'UPDATE' then
    if new.is_deleted and not old.is_deleted then
      v_type := 'expense_deleted'; v_title := 'Expense deleted'; v_message := old.description;
    else
      v_type := 'expense_edited'; v_title := 'Expense edited'; v_message := new.description;
    end if;
  end if;

  insert into public.notifications (user_id, group_id, type, title, message)
  select gm.user_id, v_group_id, v_type, v_title, v_message
  from public.group_members gm
  where gm.group_id = v_group_id and gm.is_active and gm.user_id <> auth.uid();

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_notify_expense
  after insert or update on public.expenses
  for each row execute procedure public.notify_on_expense_change();

create or replace function public.notify_on_settlement_change()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, group_id, type, title, message)
    values (new.to_user_id, new.group_id, 'settlement_created', 'Settlement recorded', 'A settlement of ' || new.amount::text || ' was recorded.');
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'paid' then
      insert into public.notifications (user_id, group_id, type, title, message)
      values (new.to_user_id, new.group_id, 'settlement_paid', 'Payment marked as paid', 'Please confirm you received ' || new.amount::text || '.');
    elsif new.status = 'confirmed' then
      insert into public.notifications (user_id, group_id, type, title, message)
      values (new.from_user_id, new.group_id, 'settlement_confirmed', 'Payment confirmed', 'Your payment of ' || new.amount::text || ' was confirmed.');
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_notify_settlement
  after insert or update on public.settlements
  for each row execute procedure public.notify_on_settlement_change();

create or replace function public.notify_on_new_member()
returns trigger as $$
begin
  insert into public.notifications (user_id, group_id, type, title, message)
  select gm.user_id, new.group_id, 'member_joined', 'New member joined', p.name || ' joined the group.'
  from public.group_members gm
  join public.profiles p on p.id = new.user_id
  where gm.group_id = new.group_id and gm.is_active and gm.user_id <> new.user_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_notify_new_member
  after insert on public.group_members
  for each row execute procedure public.notify_on_new_member();

-- Seed default categories onto every new group.
create or replace function public.seed_default_categories()
returns trigger as $$
begin
  insert into public.categories (group_id, name, icon, is_default) values
    (new.id, 'Food', '🍛', true),
    (new.id, 'Groceries', '🛒', true),
    (new.id, 'Travel', '🚕', true),
    (new.id, 'Rent', '🏠', true),
    (new.id, 'Electricity', '💡', true),
    (new.id, 'Internet', '📶', true),
    (new.id, 'Shopping', '🛍️', true),
    (new.id, 'Entertainment', '🎬', true),
    (new.id, 'Medical', '💊', true),
    (new.id, 'Household', '🧹', true),
    (new.id, 'Other', '🧾', true);

  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_seed_categories
  after insert on public.groups
  for each row execute procedure public.seed_default_categories();
