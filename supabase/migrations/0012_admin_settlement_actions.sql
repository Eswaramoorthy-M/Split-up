-- 0012: admin close / reset of settlement transactions
--
-- Two explicit, admin-only operations for wrapping up a group:
--   admin_close_settlements(group)  → marks every pending / awaiting payment as
--                                     confirmed, so the group shows settled up.
--   admin_reset_settlements(group)  → deletes the whole settlement history so
--                                     "who pays whom" is recalculated from the
--                                     expense data from scratch.
--
-- Both run as SECURITY DEFINER but check is_group_admin() first, so a regular
-- member cannot call them even though the UI hides the buttons.
--
-- Run after 0011_upi_history.sql.

create or replace function public.admin_close_settlements(p_group_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a group admin can close settlements'
      using errcode = '42501';
  end if;

  update public.settlements
  set status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, now())
  where group_id = p_group_id
    and status in ('pending', 'paid');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.admin_reset_settlements(p_group_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or not public.is_group_admin(p_group_id) then
    raise exception 'Only a group admin can reset settlements'
      using errcode = '42501';
  end if;

  delete from public.settlements
  where group_id = p_group_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_close_settlements(uuid) from public;
revoke all on function public.admin_reset_settlements(uuid) from public;
grant execute on function public.admin_close_settlements(uuid) to authenticated;
grant execute on function public.admin_reset_settlements(uuid) to authenticated;

comment on function public.admin_close_settlements(uuid) is
  'Admin only: mark every pending / awaiting settlement as confirmed (close out the group).';
comment on function public.admin_reset_settlements(uuid) is
  'Admin only: delete the settlement history so suggestions are recalculated from expenses.';
