-- Allow multiple owner profiles by removing the single-owner unique index.
drop index if exists public.profiles_single_owner_role_idx;
