-- 0009: UPI payments (free, direct person-to-person)
--
-- SplitUp never touches the money: the payer opens their own UPI app with the
-- receiver's UPI ID and pays bank-to-bank. This migration only stores the UPI
-- ID that each person shares with their group, plus the notification fan-out
-- for a payment being marked as paid (receiver + group admins).
--
-- Run after 0008_push_notifications.sql.

-- ---------------------------------------------------------------------------
-- profiles.upi_id
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists upi_id text;

-- Basic UPI ID shape: handle@provider (e.g. name@okhdfcbank, 9876543210@ybl).
alter table public.profiles
  drop constraint if exists profiles_upi_id_format;

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

-- ---------------------------------------------------------------------------
-- Settlement notifications: receiver AND group admins learn about a payment.
-- Replaces the version from 0003_functions.sql (same trigger keeps working).
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_settlement_change()
returns trigger as $$
declare
  v_from_name text;
  v_to_name text;
begin
  select name into v_from_name from public.profiles where id = new.from_user_id;
  select name into v_to_name from public.profiles where id = new.to_user_id;

  v_from_name := coalesce(v_from_name, 'A member');
  v_to_name := coalesce(v_to_name, 'a member');

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, group_id, type, title, message)
    values (
      new.to_user_id,
      new.group_id,
      'settlement_created',
      'Settlement recorded',
      v_from_name || ' recorded a settlement of ' || new.amount::text || '.'
    );
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'paid' then
      -- Receiver: please confirm the money arrived.
      insert into public.notifications (user_id, group_id, type, title, message)
      values (
        new.to_user_id,
        new.group_id,
        'settlement_paid',
        'Payment marked as paid',
        v_from_name || ' marked ' || new.amount::text || ' as paid. Please confirm you received it.'
      );

      -- Every admin except the two people involved (they already know).
      insert into public.notifications (user_id, group_id, type, title, message)
      select gm.user_id, new.group_id, 'settlement_paid', 'Settlement marked as paid',
             v_from_name || ' marked ' || new.amount::text || ' as paid to ' || v_to_name || '.'
      from public.group_members gm
      where gm.group_id = new.group_id
        and gm.is_active
        and gm.role = 'admin'
        and gm.user_id <> new.to_user_id
        and gm.user_id <> new.from_user_id;
    elsif new.status = 'confirmed' then
      insert into public.notifications (user_id, group_id, type, title, message)
      values (
        new.from_user_id,
        new.group_id,
        'settlement_confirmed',
        'Payment confirmed',
        v_to_name || ' confirmed your payment of ' || new.amount::text || '.'
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
