-- Allow active professionals to read active services and categories.
-- Previously only owner (authenticated) and public booking (anon) could read,
-- so logged-in professionals could not see their own linked services.

create policy "Professional reads active services"
  on public.services
  for select
  to authenticated
  using (
    is_active = true
    and (select is_professional())
  );

create policy "Professional reads active categories"
  on public.service_categories
  for select
  to authenticated
  using (
    is_active = true
    and (select is_professional())
  );
