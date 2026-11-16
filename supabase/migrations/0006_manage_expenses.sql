-- ============================================================================
-- 0006_manage_expenses.sql — run AFTER 0001..0005
-- Powers the "Manage" screen: admins/creators can edit any expense and its
-- per-member payment breakdown safely.
-- ============================================================================

-- 1) Monthly cycle is chosen from the expense DATE (not "today"), so a
--    back-dated expense lands in the right month.
create or replace function public.get_or_create_cycle_for_date(p_group_id uuid, p_date date)
returns uuid as $$
declare
  v_id uuid;
  v_year int := extract(year from p_date)::int;
  v_month int := extract(month from p_date)::int;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  select id into v_id from public.monthly_cycles
   where group_id = p_group_id and year = v_year and month = v_month;

  if v_id is null then
    insert into public.monthly_cycles (group_id, year, month, status)
    values (p_group_id, v_year, v_month, 'open')
    on conflict (group_id, year, month) do nothing
    returning id into v_id;

    if v_id is null then
      select id into v_id from public.monthly_cycles
       where group_id = p_group_id and year = v_year and month = v_month;
    end if;
  end if;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 2) Expense validation. "Paid by" must be an ACTIVE member when an expense is
--    created or the payer changes; untouched old expenses can still be edited
--    even if the original payer has since left the group.
create or replace function public.validate_expense()
returns trigger as $$
declare
  v_cycle_status text;
begin
  if tg_op = 'INSERT' or new.paid_by_user_id is distinct from old.paid_by_user_id then
    if not exists (
      select 1 from public.group_members gm
      where gm.group_id = new.group_id and gm.user_id = new.paid_by_user_id and gm.is_active
    ) then
      raise exception 'The person who paid must be an active member of this group';
    end if;
  end if;

  select status into v_cycle_status from public.monthly_cycles where id = new.monthly_cycle_id;
  if v_cycle_status = 'closed' then
    raise exception 'This month is closed. Ask an admin to reopen it before making changes.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 3) Participants must have belonged to the group (past members keep their
--    history, so editing an old split does not fail for someone who left).
create or replace function public.validate_expense_participant()
returns trigger as $$
declare
  v_group_id uuid;
begin
  select group_id into v_group_id from public.expenses where id = new.expense_id;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_group_id and gm.user_id = new.user_id
  ) then
    raise exception 'Participant does not belong to this group';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- 4) Split validation: shares must add up to the expense total EXACTLY
--    (numeric(12,2)), and percentage splits must also total 100%.
create or replace function public.validate_expense_split()
returns trigger as $$
declare
  v_expense_id uuid;
  v_amount numeric(12,2);
  v_split_type text;
  v_sum_amount numeric(12,2);
  v_sum_pct numeric(6,2);
begin
  if tg_op = 'DELETE' then
    v_expense_id := old.expense_id;
  else
    v_expense_id := new.expense_id;
  end if;

  select amount into v_amount from public.expenses where id = v_expense_id;
  if v_amount is null then
    return null; -- the expense itself is gone
  end if;

  select ep.split_type, sum(ep.amount), sum(coalesce(ep.percentage, 0))
    into v_split_type, v_sum_amount, v_sum_pct
    from public.expense_participants ep
   where ep.expense_id = v_expense_id
   group by ep.split_type;

  if v_split_type is null then
    return null; -- no participants (mid-edit)
  end if;

  if v_sum_amount <> v_amount then
    raise exception 'Shares add up to % but the expense is %', v_sum_amount, v_amount;
  end if;

  if v_split_type = 'percentage' and abs(v_sum_pct - 100) > 0.01 then
    raise exception 'Percentages must total 100%% (got %)', v_sum_pct;
  end if;

  return null;
end;
$$ language plpgsql security definer set search_path = public;

-- 5) Create an expense + its split in ONE transaction.
--    security invoker => Row Level Security applies to every statement.
create or replace function public.create_expense_full(
  p_group_id uuid,
  p_description text,
  p_amount numeric,
  p_category_id uuid,
  p_paid_by_user_id uuid,
  p_expense_date date,
  p_notes text,
  p_receipt_path text,
  p_split_type text,
  p_participants jsonb
)
returns uuid as $$
declare
  v_cycle uuid;
  v_id uuid;
begin
  if p_participants is null or jsonb_array_length(p_participants) = 0 then
    raise exception 'Select at least one participant';
  end if;

  v_cycle := public.get_or_create_cycle_for_date(p_group_id, p_expense_date);

  insert into public.expenses
    (group_id, monthly_cycle_id, description, amount, category_id,
     paid_by_user_id, expense_date, notes, receipt_path, created_by)
  values
    (p_group_id, v_cycle, trim(p_description), p_amount, p_category_id,
     p_paid_by_user_id, p_expense_date, nullif(trim(coalesce(p_notes, '')), ''),
     p_receipt_path, auth.uid())
  returning id into v_id;

  insert into public.expense_participants (expense_id, user_id, split_type, amount, percentage)
  select v_id,
         (e->>'user_id')::uuid,
         p_split_type,
         (e->>'amount')::numeric,
         nullif(e->>'percentage', '')::numeric
  from jsonb_array_elements(p_participants) e;

  return v_id;
end;
$$ language plpgsql security invoker set search_path = public;

-- 6) Update an expense AND replace its per-member breakdown atomically.
--    If anything fails (closed month, bad split, no permission) NOTHING
--    changes — the old split is never lost.
create or replace function public.update_expense_full(
  p_expense_id uuid,
  p_description text,
  p_amount numeric,
  p_category_id uuid,
  p_paid_by_user_id uuid,
  p_expense_date date,
  p_notes text,
  p_split_type text,
  p_participants jsonb
)
returns void as $$
declare
  v_group_id uuid;
  v_cycle uuid;
begin
  if p_participants is null or jsonb_array_length(p_participants) = 0 then
    raise exception 'Select at least one participant';
  end if;

  select group_id into v_group_id from public.expenses
   where id = p_expense_id and not is_deleted;
  if v_group_id is null then
    raise exception 'Expense not found';
  end if;

  v_cycle := public.get_or_create_cycle_for_date(v_group_id, p_expense_date);

  update public.expenses
     set description = trim(p_description),
         amount = p_amount,
         category_id = p_category_id,
         paid_by_user_id = p_paid_by_user_id,
         expense_date = p_expense_date,
         notes = nullif(trim(coalesce(p_notes, '')), ''),
         monthly_cycle_id = v_cycle,
         updated_at = now()
   where id = p_expense_id;

  if not found then
    raise exception 'You do not have permission to edit this expense';
  end if;

  delete from public.expense_participants where expense_id = p_expense_id;

  insert into public.expense_participants (expense_id, user_id, split_type, amount, percentage)
  select p_expense_id,
         (e->>'user_id')::uuid,
         p_split_type,
         (e->>'amount')::numeric,
         nullif(e->>'percentage', '')::numeric
  from jsonb_array_elements(p_participants) e;
end;
$$ language plpgsql security invoker set search_path = public;
