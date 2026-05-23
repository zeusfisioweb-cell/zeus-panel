-- Allow hard-deleting cancelled appointments by relaxing blocking FKs.
-- appointment_requests: keep request, unlink resolution.
-- consent_records: tied to appointment, drop with it.

alter table public.appointment_requests
  drop constraint if exists appointment_requests_resolution_appointment_id_fkey;

alter table public.appointment_requests
  add constraint appointment_requests_resolution_appointment_id_fkey
  foreign key (resolution_appointment_id)
  references public.appointments(id)
  on delete set null;

alter table public.consent_records
  drop constraint if exists consent_records_appointment_id_fkey;

alter table public.consent_records
  add constraint consent_records_appointment_id_fkey
  foreign key (appointment_id)
  references public.appointments(id)
  on delete cascade;
