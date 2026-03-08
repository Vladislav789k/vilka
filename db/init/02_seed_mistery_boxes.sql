-- Seed a few "Mistery box" items on fresh DB init.
-- This script runs automatically on first Postgres initialization because
-- docker-compose mounts ./db/init into /docker-entrypoint-initdb.d.

-- 1) Ensure category exists (unique by code)
INSERT INTO public.ref_dish_categories (parent_id, level, code, name, description, is_active, sort_order, created_at, updated_at)
VALUES
  (NULL, 1, 'mistery-box', 'Mistery box', 'Сюрприз-бокс от ресторана', TRUE, 0, now(), now())
ON CONFLICT (code) DO NOTHING;

-- 2) Create a few boxes for demo restaurant (id=3 in our init dump).
WITH cat AS (
  SELECT id FROM public.ref_dish_categories WHERE code = 'mistery-box' LIMIT 1
)
INSERT INTO public.menu_items
  (restaurant_id, name, composition, description, price, currency, is_active, is_available, stock_qty, ref_category_id, is_brand_anonymous, created_at, updated_at, listing_mode)
SELECT
  3,
  v.name,
  v.composition,
  v.description,
  v.price,
  'RUB',
  TRUE,
  TRUE,
  v.stock_qty,
  cat.id,
  FALSE,
  now(),
  now(),
  0
FROM cat
CROSS JOIN (
  VALUES
    ('Mistery box — мини', 'Сюрприз-набор из 2–3 позиций. Состав меняется ежедневно.', 'Сюрприз-набор из 2–3 позиций', 299.00::numeric(10,2), 25::int),
    ('Mistery box — стандарт', 'Сюрприз-набор из 4–5 позиций. Отличный вариант на компанию.', 'Сюрприз-набор из 4–5 позиций', 499.00::numeric(10,2), 25::int),
    ('Mistery box — большой', 'Сюрприз-набор из 6–8 позиций. Максимальная выгода.', 'Сюрприз-набор из 6–8 позиций', 799.00::numeric(10,2), 25::int)
) AS v(name, composition, description, price, stock_qty)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.menu_items mi
  WHERE mi.restaurant_id = 3
    AND mi.ref_category_id = cat.id
    AND mi.name = v.name
);

