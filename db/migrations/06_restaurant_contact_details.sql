-- Fill missing restaurant contact details for Yandex Delivery source point.
-- We keep them in restaurants.settings (jsonb) and fall back to restaurant owner user.

WITH owners AS (
  SELECT
    r.id AS restaurant_id,
    r.name AS restaurant_name,
    r.owner_user_id,
    u.phone AS owner_phone,
    u.email AS owner_email
  FROM public.restaurants r
  LEFT JOIN public.users u ON u.id = r.owner_user_id
  WHERE r.id IN (1, 3)
)
UPDATE public.restaurants r
SET
  city = COALESCE(r.city, 'Москва'),
  settings = jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(r.settings, '{}'::jsonb),
        '{contact_name}',
        to_jsonb(COALESCE((r.settings->>'contact_name'), o.restaurant_name)::text),
        true
      ),
      '{contact_phone}',
      to_jsonb(COALESCE((r.settings->>'contact_phone'), o.owner_phone)::text),
      true
    ),
    '{contact_email}',
    to_jsonb(COALESCE((r.settings->>'contact_email'), o.owner_email, 'store@example.com')::text),
    true
  ),
  updated_at = now()
FROM owners o
WHERE r.id = o.restaurant_id;

-- If owner email is missing, set it from restaurant settings contact_email.
UPDATE public.users u
SET
  email = COALESCE(u.email, r.settings->>'contact_email'),
  updated_at = now()
FROM public.restaurants r
WHERE r.id IN (1, 3)
  AND u.id = r.owner_user_id
  AND (u.email IS NULL OR u.email = '');

