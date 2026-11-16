-- ============================================================================
-- 0005_fixes.sql — run AFTER 0001..0004
-- ============================================================================

-- 1) Backfill profile rows for users who registered before the tables existed.
insert into public.profiles (id, name, email)
select u.id,
       coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
       u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 2) Creating a group: the creator becomes a member only AFTER the insert
--    (via trigger), so the RETURNING/select check must also allow the creator.
drop policy if exists "groups_select_member" on public.groups;
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id) or created_by = auth.uid());

-- 3) Split validation trigger: NEW is not available on DELETE, so branch on TG_OP.
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
    return null; -- expense itself is gone
  end if;

  select ep.split_type, sum(ep.amount), sum(coalesce(ep.percentage, 0))
    into v_split_type, v_sum_amount, v_sum_pct
    from public.expense_participants ep
    where ep.expense_id = v_expense_id
    group by ep.split_type;

  if v_split_type is null then
    return null; -- no participants (mid-edit); checked again on the next change
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

-- 4) Balances: resolve column/variable name clashes in favour of columns.
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
#variable_conflict use_column
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  return query
  with members as (
    select gm.user_id as uid, p.name as pname, p.profile_image as pimg
    from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    where gm.group_id = p_group_id and gm.is_active
  ),
  paid as (
    select e.paid_by_user_id as uid, coalesce(sum(e.amount), 0)::numeric(12,2) as tp
    from public.expenses e
    where e.group_id = p_group_id
      and e.is_deleted = false
      and (p_monthly_cycle_id is null or e.monthly_cycle_id = p_monthly_cycle_id)
    group by e.paid_by_user_id
  ),
  shares as (
    select ep.user_id as uid, coalesce(sum(ep.amount), 0)::numeric(12,2) as ts
    from public.expense_participants ep
    join public.expenses e on e.id = ep.expense_id
    where e.group_id = p_group_id
      and e.is_deleted = false
      and (p_monthly_cycle_id is null or e.monthly_cycle_id = p_monthly_cycle_id)
    group by ep.user_id
  )
  select
    m.uid,
    m.pname,
    m.pimg,
    coalesce(pd.tp, 0)::numeric(12,2),
    coalesce(sh.ts, 0)::numeric(12,2),
    (coalesce(pd.tp, 0) - coalesce(sh.ts, 0))::numeric(12,2)
  from members m
  left join paid pd on pd.uid = m.uid
  left join shares sh on sh.uid = m.uid
  order by 6 desc;
end;
$$ language plpgsql security definer stable set search_path = public;

-- 5) Settlement suggestions: simpler two-pointer greedy match, no temp tables.
--    Largest debtor pays largest creditor first, which keeps the number of
--    transactions minimal. Already-recorded settlements are netted out first.
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
#variable_conflict use_column
declare
  d_ids uuid[]; d_names text[]; d_amts numeric[];
  c_ids uuid[]; c_names text[]; c_amts numeric[];
  i int := 1;
  j int := 1;
  pay numeric;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  with b as (
    select * from public.get_group_balances(p_group_id, p_monthly_cycle_id)
  ),
  moves as (
    select s.from_user_id as uid, s.amount as amt   -- payer: debt shrinks
    from public.settlements s
    where s.group_id = p_group_id
      and s.status in ('pending', 'paid', 'confirmed')
      and (p_monthly_cycle_id is null or s.monthly_cycle_id = p_monthly_cycle_id)
    union all
    select s.to_user_id as uid, -s.amount as amt    -- receiver: credit shrinks
    from public.settlements s
    where s.group_id = p_group_id
      and s.status in ('pending', 'paid', 'confirmed')
      and (p_monthly_cycle_id is null or s.monthly_cycle_id = p_monthly_cycle_id)
  ),
  adj as (
    select uid, sum(amt) as delta from moves group by uid
  ),
  n as (
    select b.user_id as uid, b.name as nm,
           (b.net_balance + coalesce(a.delta, 0)) as bal
    from b left join adj a on a.uid = b.user_id
  )
  select
    (select array_agg(uid order by bal)        from n where bal < -0.005),
    (select array_agg(nm  order by bal)        from n where bal < -0.005),
    (select array_agg(-bal order by bal)       from n where bal < -0.005),
    (select array_agg(uid order by bal desc)   from n where bal >  0.005),
    (select array_agg(nm  order by bal desc)   from n where bal >  0.005),
    (select array_agg(bal order by bal desc)   from n where bal >  0.005)
  into d_ids, d_names, d_amts, c_ids, c_names, c_amts;

  if d_ids is null or c_ids is null then
    return;
  end if;

  while i <= array_length(d_ids, 1) and j <= array_length(c_ids, 1) loop
    pay := least(d_amts[i], c_amts[j]);
    if pay > 0.005 then
      from_user := d_ids[i];
      from_name := d_names[i];
      to_user   := c_ids[j];
      to_name   := c_names[j];
      amount    := round(pay, 2);
      return next;
    end if;
    d_amts[i] := d_amts[i] - pay;
    c_amts[j] := c_amts[j] - pay;
    if d_amts[i] <= 0.005 then i := i + 1; end if;
    if c_amts[j] <= 0.005 then j := j + 1; end if;
  end loop;

  return;
end;
$$ language plpgsql security definer stable set search_path = public;
