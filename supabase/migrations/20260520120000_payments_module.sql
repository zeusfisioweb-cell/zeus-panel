-- Módulo de cobros (Fase 1): recibos internos, pago presencial en clínica.
-- No es facturación legal. No envía a AEAT/Verifactu.

-- pgcrypto está habilitado por defecto en Supabase, pero lo aseguramos
create extension if not exists pgcrypto;

-- Métodos de cobro aceptados en clínica
create type public.payment_method as enum ('cash', 'card', 'bizum', 'transfer', 'other');

-- Correlativo de recibos internos (R-YYYY-NNNN)
create sequence if not exists public.receipt_seq;

create or replace function public.next_receipt_number()
returns text
language sql
volatile
as $$
  select 'R-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 4, '0');
$$;

-- Un cobro registrado por un admin/profesional desde el panel
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 99999),
  method public.payment_method not null,
  paid_at timestamptz not null default now(),
  notes text,
  receipt_number text not null default public.next_receipt_number(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint payments_receipt_number_unique unique (receipt_number)
);

create index idx_payments_appointment on public.payments(appointment_id);
create index idx_payments_paid_at on public.payments(paid_at desc);
create index idx_payments_patient on public.payments(patient_id);
create index idx_payments_method on public.payments(method);

-- RLS: solo usuarios del panel (owner/professional)
alter table public.payments enable row level security;

create policy payments_panel_select on public.payments for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('owner', 'professional')
    )
  );

create policy payments_panel_insert on public.payments for insert
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('owner', 'professional')
    )
  );

create policy payments_panel_delete on public.payments for delete
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'owner'
    )
  );

-- No se permiten updates: si hay error, se borra y se crea uno nuevo (auditoría limpia)

comment on table public.payments is 'Cobros presenciales (Fase 1). No es facturación legal AEAT/Verifactu.';
comment on column public.payments.receipt_number is 'Correlativo interno R-YYYY-NNNN. No tiene validez fiscal.';
