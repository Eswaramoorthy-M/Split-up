-- ============================================================================
-- 0007_fix_delete_expense.sql — run AFTER 0001..0006
--
-- Why this exists
-- ---------------
-- Deleting an expense is a SOFT delete: an UPDATE that sets is_deleted = true.
-- The expenses SELECT policy hides deleted rows:
--
--   using (public.is_group_member(group_id) and not is_deleted)
--
-- PostgREST runs an UPDATE with a RETURNING/visibility check, so the *new*
-- row (is_deleted = true) no longer satisfies that SELECT policy. Postgres
-- then rejects the write with:
--
--   new row violates row-level security policy for table "expenses"
--
-- Doing the same UPDATE inside a SECURITY DEFINER function bypasses RLS for
-- the row change, while the explicit permission check below still makes sure
-- only the person who added the expense (or a group admin) can delete it.
-- Deleted rows stay hidden from clients, exactly as before.
-- ============================================================================

create or replace function public.delete_expense(p_expense_id uuid)
returns void as $$
declare
  v_expense public.expenses;
begin
  select * into v_expense
  from public.expenses
  where id = p_expense_id and not is_deleted;

  -- Already deleted (or never existed): treat as success so a double tap
  -- does not surface an error to the user.
  if v_expense.id is null then
    return;
  end if;

  if not (
    (v_expense.created_by = auth.uid() and public.is_group_member(v_expense.group_id))
    or public.is_group_admin(v_expense.group_id)
  ) then
    raise exception 'You do not have permission to delete this expense';
  end if;

  update public.expenses
     set is_deleted = true,
         updated_at = now()
   where id = p_expense_id;
end;
$$ language plpgsql security definer set search_path = public;
