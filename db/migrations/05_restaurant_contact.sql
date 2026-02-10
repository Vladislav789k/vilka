-- Yandex Delivery требует email для contact в точке source.
-- Храним контактные данные ресторана в restaurants.settings (jsonb).

UPDATE public.restaurants
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{contact_email}',
    to_jsonb('store@example.com'::text),
    true
  ),
  updated_at = now()
WHERE id IN (1, 3);

