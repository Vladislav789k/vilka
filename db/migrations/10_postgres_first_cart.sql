ALTER TABLE public.carts
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN restaurant_id DROP NOT NULL;

ALTER TABLE public.carts
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_carts_active_user_updated
  ON public.carts USING btree (user_id, updated_at DESC)
  WHERE status = 'active' AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carts_active_token_updated
  ON public.carts USING btree (cart_token, updated_at DESC)
  WHERE status = 'active' AND cart_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cart_items_cart_menu_item
  ON public.cart_items USING btree (cart_id, menu_item_id);
