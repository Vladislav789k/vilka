-- Store full delivery address details (apartment/floor/entrance/intercom/etc).

ALTER TABLE public.user_addresses
  ADD COLUMN IF NOT EXISTS apartment text,
  ADD COLUMN IF NOT EXISTS entrance text,
  ADD COLUMN IF NOT EXISTS floor text,
  ADD COLUMN IF NOT EXISTS intercom text,
  ADD COLUMN IF NOT EXISTS door_code_extra text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

