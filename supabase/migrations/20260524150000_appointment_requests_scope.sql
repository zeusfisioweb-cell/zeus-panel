-- Tighten appointment_requests SELECT for panel users:
-- previously any authenticated owner|professional could read all requests.
-- Now professionals only see requests targeted to them.

drop policy if exists "appointment_requests_select_panel" on public.appointment_requests;

create policy "appointment_requests_select_panel"
  on public.appointment_requests
  for select
  to authenticated
  using (
    (select is_owner())
    or (
      (select is_professional())
      and professional_id = (select current_professional_id())
    )
  );
