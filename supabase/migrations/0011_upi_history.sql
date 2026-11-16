-- 0011: UPI transaction tracking + receiver confirm / reject
--
-- Adds just enough bookkeeping to show a UPI transaction history and let the
-- receiver confirm or reject a payment. Money still moves bank-to-bank; SplitUp
-- never touches it and cannot verify a UPI transfer by itself.
--
-- Run after 0010_fix_upi_id_constraint.sql.

-- ---------------------------------------------------------------------------
-- Extra settlement fields
-- ---------------------------------------------------------------------------
alter table public.settlements
  add column if not exists payment_method text,
  add column if not exists upi_id_used text,
  add column if not exists rejected_at timestamptz;

-- Existing rows predate UPI tracking; treat them as manual records.
update public.settlements
set payment_method = 'manual'
where payment_method is null
   or payment_method not in ('manual', 'upi');

alter table public.settlements
  alter column payment_method set default 'manual';

alter table public.settlements
  alter column payment_method set not null;

alter table public.settlements
  drop constraint if exists settlements_payment_method_check;

alter table public.settlements
  add constraint settlements_payment_method_check
  check (payment_method in ('manual', 'upi'));

-- Receiver can reject a claimed payment when the money never arrived. A
-- rejected settlement no longer counts as paid, so the payer still owes it.
alter table public.settlements
  drop constraint if exists settlements_status_check;

alter table public.settlements
  add constraint settlements_status_check
  check (status in ('pending', 'paid', 'confirmed', 'cancelled', 'rejected'));

create index if not exists idx_settlements_group_status
  on public.settlements(group_id, status);

comment on column public.settlements.payment_method is
  'How the payer says they paid: manual record or a UPI app hand-off.';
comment on column public.settlements.upi_id_used is
  'Receiver UPI ID used for a UPI payment (history/debugging only).';
comment on column public.settlements.rejected_at is
  'When the receiver said the payment did not arrive.';

-- ---------------------------------------------------------------------------
-- Notifications: add the rejected branch (paid/confirmed stay as in 0009).
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
    elsif new.status = 'rejected' then
      -- Payer: the receiver says the money never arrived.
      insert into public.notifications (user_id, group_id, type, title, message)
      values (
        new.from_user_id,
        new.group_id,
        'settlement_rejected',
        'Payment not received',
        v_to_name || ' says they did not receive ' || new.amount::text || '. Please check and try again.'
      );
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;
