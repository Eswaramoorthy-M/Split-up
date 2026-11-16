-- 0010: fix the UPI ID check constraint
--
-- 0009 used `{2,256}` in the regular expression. PostgreSQL's regex engine
-- caps repetition counts at 255, so the constraint raised:
--   invalid regular expression: invalid repetition count(s)
-- on every profile update.
--
-- This replaces it with a pattern that uses no numeric repetition bounds at
-- all, and enforces the length separately. Safe to re-run.

alter table public.profiles
  add column if not exists upi_id text;

alter table public.profiles
  drop constraint if exists profiles_upi_id_format;

-- Clear anything that slipped in before the constraint was fixed, so adding
-- the corrected constraint cannot fail on existing data.
update public.profiles
set upi_id = null
where upi_id is not null
  and not (
    length(upi_id) between 5 and 255
    and upi_id ~ '^[A-Za-z0-9._-][A-Za-z0-9._-]+@[A-Za-z][A-Za-z]+$'
  );

alter table public.profiles
  add constraint profiles_upi_id_format
  check (
    upi_id is null
    or (
      length(upi_id) between 5 and 255
      and upi_id ~ '^[A-Za-z0-9._-][A-Za-z0-9._-]+@[A-Za-z][A-Za-z]+$'
    )
  );

comment on column public.profiles.upi_id is
  'UPI ID shared with group mates so they can pay this person directly. No money flows through SplitUp.';
