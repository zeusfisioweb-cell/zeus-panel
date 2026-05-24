-- 1) Tighten payments SELECT: professionals only see payments on their own appointments.
-- Previously, any authenticated owner|professional could select all payments.

drop policy if exists "payments_panel_select" on public.payments;

create policy "payments_panel_select"
  on public.payments
  for select
  to authenticated
  using (
    (select is_owner())
    or (
      (select is_professional())
      and exists (
        select 1
        from public.appointments a
        where a.id = payments.appointment_id
          and a.professional_id = (select current_professional_id())
      )
    )
  );

-- Tighten payments INSERT to match: professional may only insert for own appointments.
drop policy if exists "payments_panel_insert" on public.payments;

create policy "payments_panel_insert"
  on public.payments
  for insert
  to authenticated
  with check (
    (select is_owner())
    or (
      (select is_professional())
      and exists (
        select 1
        from public.appointments a
        where a.id = payments.appointment_id
          and a.professional_id = (select current_professional_id())
      )
    )
  );

-- 2) Consent records: allow professionals to read consents of patients they have access to.
-- Previously only owner and the portal patient could read. Professionals were locked out.

create policy "Professional reads consent records for accessible patients"
  on public.consent_records
  for select
  to authenticated
  using (
    (select is_professional())
    and professional_has_patient_access(patient_id)
  );
