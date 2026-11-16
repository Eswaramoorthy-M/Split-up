-- Receipts bucket. Files are stored as {group_id}/{expense_id}/{filename}
-- so policies can check group membership from the path.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_select_group_member" on storage.objects
  for select using (
    bucket_id = 'receipts'
    and public.is_group_member((storage.foldername(name))[1]::uuid)
  );

create policy "receipts_insert_group_member" on storage.objects
  for insert with check (
    bucket_id = 'receipts'
    and public.is_group_member((storage.foldername(name))[1]::uuid)
  );

create policy "receipts_delete_own_or_admin" on storage.objects
  for delete using (
    bucket_id = 'receipts'
    and (
      public.is_group_admin((storage.foldername(name))[1]::uuid)
      or owner = auth.uid()
    )
  );
