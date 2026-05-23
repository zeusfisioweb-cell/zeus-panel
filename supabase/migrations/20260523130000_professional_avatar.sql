-- Add avatar URL column to professionals
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create public bucket for professional avatars (read-only public, writes via service role from API)
INSERT INTO storage.buckets (id, name, public)
VALUES ('professional-avatars', 'professional-avatars', true)
ON CONFLICT (id) DO NOTHING;
