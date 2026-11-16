-- ============================================================================
-- Row Level Security — the real authorization boundary.
-- Frontend code is never trusted; every table below is locked down.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.categories enable row level security;
alter table public.monthly_cycles enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.settlements enable row level security;
alter table public.notifications enable row level security;

-- ---- profiles ---------------------------------------------------------
-- A user can read their own profile, and the profiles of anyone who shares
-- a group with them (needed to show names/avatars in member lists).
create policy "profiles_select_own_or_groupmate" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.group_members me
      join public.group_members them on them.group_id = me.group_id
      where me.user_id = auth.uid() and them.user_id = public.profiles.id
    )
  );

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- ---- groups -------------------------------------------------------------
create policy "groups_select_member" on public.groups
  for select using (public.is_group_member(id));

create policy "groups_insert_authenticated" on public.groups
  for insert with check (created_by = auth.uid());

create policy "groups_update_admin" on public.groups
  for update using (public.is_group_admin(id));

-- Joining by code: any authenticated user may look up a group by its exact
-- code even before membership (handled via a SECURITY DEFINER RPC below,
-- not a broad SELECT policy), so no additional public select policy here.

-- ---- group_members --------------------------------------------------------
create policy "members_select_groupmate" on public.group_members
  for select using (public.is_group_member(group_id));

create policy "members_insert_self_or_admin" on public.group_members
  for insert with check (
    user_id = auth.uid() or public.is_group_admin(group_id)
  );

create policy "members_update_admin" on public.group_members
  for update using (public.is_group_admin(group_id));

-- Members are never hard-deleted (history must be preserved); removal is
-- modeled as is_active = false via the update policy above.

-- ---- categories -----------------------------------------------------------
create policy "categories_select_member" on public.categories
  for select using (group_id is null or public.is_group_member(group_id));

create policy "categories_insert_admin" on public.categories
  for insert with check (public.is_group_admin(group_id));

create policy "categories_update_admin" on public.categories
  for update using (public.is_group_admin(group_id));

-- ---- monthly_cycles ---------------------------------------------------
create policy "cycles_select_member" on public.monthly_cycles
  for select using (public.is_group_member(group_id));

create policy "cycles_insert_member" on public.monthly_cycles
  for insert with check (public.is_group_member(group_id));

create policy "cycles_update_admin" on public.monthly_cycles
  for update using (public.is_group_admin(group_id));

-- ---- expenses -----------------------------------------------------------
create policy "expenses_select_member" on public.expenses
  for select using (public.is_group_member(group_id) and not is_deleted);

create policy "expenses_insert_member" on public.expenses
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());

-- Members can edit their own expenses; admins can edit any expense in the group.
create policy "expenses_update_own_or_admin" on public.expenses
  for update using (
    (created_by = auth.uid() and public.is_group_member(group_id))
    or public.is_group_admin(group_id)
  );

create policy "expenses_delete_own_or_admin" on public.expenses
  for delete using (
    (created_by = auth.uid() and public.is_group_member(group_id))
    or public.is_group_admin(group_id)
  );

-- ---- expense_participants ------------------------------------------------
create policy "participants_select_member" on public.expense_participants
  for select using (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id))
  );

create policy "participants_write_own_or_admin" on public.expense_participants
  for all using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and (e.created_by = auth.uid() or public.is_group_admin(e.group_id))
        and public.is_group_member(e.group_id)
    )
  );

-- ---- settlements ----------------------------------------------------------
create policy "settlements_select_member" on public.settlements
  for select using (public.is_group_member(group_id));

create policy "settlements_insert_member" on public.settlements
  for insert with check (
    public.is_group_member(group_id)
    and (from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_group_admin(group_id))
  );

-- Payer marks "paid"; receiver confirms; admin can cancel/manage.
create policy "settlements_update_party_or_admin" on public.settlements
  for update using (
    from_user_id = auth.uid() or to_user_id = auth.uid() or public.is_group_admin(group_id)
  );

-- ---- notifications ----------------------------------------------------
create policy "notifications_select_own" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid());

-- Inserts happen via SECURITY DEFINER triggers/functions only (below),
-- so there is intentionally no direct insert policy for regular clients.
