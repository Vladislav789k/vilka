-- Ensure restaurant coordinates exist for delivery расчёта.
-- User request: restaurant 1 -> (55.743015, 37.548950)
-- Note: demo seed currently uses "Рестик 1" with id=3, so we update both ids.

UPDATE public.restaurants
SET
  latitude = 55.743015,
  longitude = 37.548950,
  updated_at = now()
WHERE id IN (1, 3);

