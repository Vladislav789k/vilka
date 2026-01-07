-- Add menu items to categories that have fewer than 3 items
-- This script ensures every category has at least 3 items

DO $$
DECLARE
    max_item_id INTEGER;
    restaurant_id INTEGER;
    cat_id INTEGER;
    cat_name TEXT;
    item_count INTEGER;
    items_to_add INTEGER;
    new_item_id INTEGER;
    item_names TEXT[];
    item_desc TEXT;
    item_price NUMERIC;
    i INTEGER;
BEGIN
    -- Get max menu item ID
    SELECT COALESCE(MAX(id), 0) INTO max_item_id FROM menu_items;
    
    -- Get first active restaurant
    SELECT id INTO restaurant_id FROM restaurants WHERE is_active = TRUE LIMIT 1;
    
    IF restaurant_id IS NULL THEN
        RAISE EXCEPTION 'No active restaurant found';
    END IF;
    
    -- Loop through all level 3 categories
    FOR cat_id, cat_name IN 
        SELECT id, name FROM ref_dish_categories 
        WHERE level = 3 AND is_active = TRUE 
        ORDER BY id
    LOOP
        -- Count existing items in this category
        SELECT COUNT(*) INTO item_count 
        FROM menu_items 
        WHERE ref_category_id = cat_id AND is_active = TRUE;
        
        -- Calculate how many items to add
        items_to_add := GREATEST(0, 3 - item_count);
        
        -- Add items if needed
        IF items_to_add > 0 THEN
            FOR i IN 1..items_to_add LOOP
                max_item_id := max_item_id + 1;
                new_item_id := max_item_id;
                
                -- Generate item name based on category name
                item_names := ARRAY[
                    cat_name || ' вариант ' || i,
                    cat_name || ' ' || i,
                    cat_name || ' классический ' || i
                ];
                
                item_desc := 'Вкусное блюдо из категории ' || cat_name;
                item_price := 200.00 + (i * 50) + (cat_id % 100);
                
                -- Insert menu item
                INSERT INTO menu_items (
                    id, restaurant_id, name, description, price, currency,
                    is_active, is_available, stock_qty, created_at, updated_at,
                    listing_mode, ref_category_id, is_brand_anonymous, composition
                ) VALUES (
                    new_item_id,
                    restaurant_id,
                    item_names[1 + ((i - 1) % array_length(item_names, 1))],
                    item_desc,
                    item_price,
                    'RUB',
                    TRUE,
                    TRUE,
                    100,
                    NOW(),
                    NOW(),
                    0,
                    cat_id,
                    (i % 2 = 0), -- Alternate between anonymous and branded
                    item_desc
                );
                
                RAISE NOTICE 'Added menu item % to category % (%)', new_item_id, cat_id, cat_name;
            END LOOP;
        END IF;
    END LOOP;
    
    -- Update sequence
    PERFORM setval('menu_items_id_seq', max_item_id, true);
    
    RAISE NOTICE 'Done! Added items to ensure at least 3 items per category.';
END $$;

