-- Clinic fiscal fields for legal receipts (Fase 1.5)
-- Adds tax_id (NIF/CIF) and legal_name (razón social) to booking_settings.
-- Both nullable to keep backward compatibility; UI/PDF treat null as "no field".

ALTER TABLE public.booking_settings
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS legal_name text;

COMMENT ON COLUMN public.booking_settings.tax_id IS 'NIF/CIF emisor para recibos legales';
COMMENT ON COLUMN public.booking_settings.legal_name IS 'Razón social fiscal (si difiere de clinic_name)';
