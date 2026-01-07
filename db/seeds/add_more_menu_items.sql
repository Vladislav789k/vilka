-- Add more menu items to ensure at least 3 items per category
-- This script adds items to categories that have fewer than 3 items

-- First, get the current max ID and restaurant IDs
DO $$
DECLARE
    max_item_id INTEGER;
    restaurant_id INTEGER;
    cat_id INTEGER;
    item_count INTEGER;
    items_to_add INTEGER;
    new_item_id INTEGER;
BEGIN
    -- Get max menu item ID
    SELECT COALESCE(MAX(id), 0) INTO max_item_id FROM menu_items;
    
    -- Get first active restaurant
    SELECT id INTO restaurant_id FROM restaurants WHERE is_active = TRUE LIMIT 1;
    
    IF restaurant_id IS NULL THEN
        RAISE EXCEPTION 'No active restaurant found';
    END IF;
    
    -- Loop through all level 3 categories
    FOR cat_id IN 
        SELECT id FROM ref_dish_categories 
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
                
                -- Insert menu item based on category
                INSERT INTO menu_items (
                    id, restaurant_id, name, description, price, currency,
                    is_active, is_available, stock_qty, created_at, updated_at,
                    listing_mode, ref_category_id, is_brand_anonymous, composition
                ) VALUES (
                    new_item_id,
                    restaurant_id,
                    CASE 
                        -- Bakery categories
                        WHEN cat_id = 16 THEN 'Хлеб формовой ' || i || ' (350г)'
                        WHEN cat_id = 17 THEN 'Багет французский ' || i || ' (250г)'
                        WHEN cat_id = 18 THEN 'Лаваш армянский ' || i || ' (200г)'
                        WHEN cat_id = 19 THEN 'Булочка сдобная ' || i || ' (80г)'
                        WHEN cat_id = 20 THEN 'Булочка с маком ' || i || ' (90г)'
                        WHEN cat_id = 21 THEN 'Синнамон-ролл ' || i || ' (120г)'
                        WHEN cat_id = 22 THEN 'Пирог с капустой ' || i || ' (400г)'
                        WHEN cat_id = 23 THEN 'Пирожок печёный ' || i || ' (100г)'
                        WHEN cat_id = 24 THEN 'Беляш ' || i || ' (150г)'
                        
                        -- Breakfast categories
                        WHEN cat_id = 28 THEN 'Скрамбл с овощами ' || i
                        WHEN cat_id = 29 THEN 'Омлет классический ' || i
                        WHEN cat_id = 30 THEN 'Яйца пашот ' || i || ' (2 шт)'
                        WHEN cat_id = 31 THEN 'Овсяная каша ' || i || ' (250г)'
                        WHEN cat_id = 32 THEN 'Боул с киноа ' || i
                        WHEN cat_id = 33 THEN 'Фруктовый боул ' || i
                        WHEN cat_id = 34 THEN 'Тост с авокадо ' || i
                        WHEN cat_id = 35 THEN 'Блины с вареньем ' || i || ' (3 шт)'
                        WHEN cat_id = 36 THEN 'Круассан-завтрак ' || i
                        
                        -- Snacks categories
                        WHEN cat_id = 40 THEN 'Брускетта с томатами ' || i
                        WHEN cat_id = 41 THEN 'Сырная тарелка ' || i
                        WHEN cat_id = 42 THEN 'Овощная закуска ' || i
                        WHEN cat_id = 43 THEN 'Куриные наггетсы ' || i || ' (6 шт)'
                        WHEN cat_id = 44 THEN 'Сырные палочки ' || i || ' (5 шт)'
                        WHEN cat_id = 45 THEN 'Картофель фри ' || i || ' (150г)'
                        WHEN cat_id = 46 THEN 'Мини-круассан ' || i || ' (3 шт)'
                        WHEN cat_id = 47 THEN 'Ореховая смесь ' || i || ' (100г)'
                        WHEN cat_id = 48 THEN 'Чипсы классические ' || i || ' (100г)'
                        
                        -- Salads categories
                        WHEN cat_id = 52 THEN 'Оливье классический ' || i || ' (200г)'
                        WHEN cat_id = 53 THEN 'Цезарь с курицей ' || i || ' (250г)'
                        WHEN cat_id = 54 THEN 'Греческий салат ' || i || ' (220г)'
                        WHEN cat_id = 55 THEN 'Поке с лососем ' || i
                        WHEN cat_id = 56 THEN 'Боул с киноа ' || i
                        WHEN cat_id = 57 THEN 'Тёплый боул с курицей ' || i
                        WHEN cat_id = 58 THEN 'Тёплый салат с говядиной ' || i
                        WHEN cat_id = 59 THEN 'Тёплый салат с креветками ' || i
                        WHEN cat_id = 60 THEN 'Тёплый овощной салат ' || i
                        
                        -- Soups categories
                        WHEN cat_id = 64 THEN 'Куриный бульон ' || i || ' (300мл)'
                        WHEN cat_id = 65 THEN 'Борщ украинский ' || i || ' (350мл)'
                        WHEN cat_id = 66 THEN 'Солянка мясная ' || i || ' (350мл)'
                        WHEN cat_id = 67 THEN 'Крем-суп из тыквы ' || i || ' (300мл)'
                        WHEN cat_id = 68 THEN 'Сырный крем-суп ' || i || ' (300мл)'
                        WHEN cat_id = 69 THEN 'Рамен классический ' || i
                        WHEN cat_id = 70 THEN 'Том-ям с креветками ' || i
                        
                        -- Pizza categories
                        WHEN cat_id = 74 THEN 'Пицца Маргарита ' || i || ' (30см)'
                        WHEN cat_id = 75 THEN 'Пицца Пепперони ' || i || ' (30см)'
                        WHEN cat_id = 76 THEN 'Пицца Овощная ' || i || ' (30см)'
                        WHEN cat_id = 77 THEN 'Пицца с морепродуктами ' || i || ' (30см)'
                        WHEN cat_id = 78 THEN 'Пицца с трюфелем ' || i || ' (30см)'
                        WHEN cat_id = 79 THEN 'Пицца-слайс ' || i
                        WHEN cat_id = 80 THEN 'Мини-пицца ' || i || ' (15см)'
                        
                        -- Burgers categories
                        WHEN cat_id = 84 THEN 'Чизбургер ' || i
                        WHEN cat_id = 85 THEN 'Чикен-бургер ' || i
                        WHEN cat_id = 86 THEN 'Вегетарианский бургер ' || i
                        WHEN cat_id = 87 THEN 'Сэндвич с индейкой ' || i
                        WHEN cat_id = 88 THEN 'Панини с курицей ' || i
                        WHEN cat_id = 89 THEN 'Шаурма классическая ' || i
                        WHEN cat_id = 90 THEN 'Хот-дог классический ' || i
                        WHEN cat_id = 91 THEN 'Тако с мясом ' || i
                        
                        -- Hot dishes categories
                        WHEN cat_id = 95 THEN 'Стейк из говядины ' || i || ' (200г)'
                        WHEN cat_id = 96 THEN 'Котлеты по-киевски ' || i || ' (2 шт)'
                        WHEN cat_id = 97 THEN 'Куриные крылышки BBQ ' || i || ' (6 шт)'
                        WHEN cat_id = 98 THEN 'Лосось на гриле ' || i || ' (180г)'
                        WHEN cat_id = 99 THEN 'Креветки в соусе ' || i || ' (200г)'
                        WHEN cat_id = 100 THEN 'Картофель по-деревенски ' || i || ' (200г)'
                        WHEN cat_id = 101 THEN 'Рис с овощами ' || i || ' (200г)'
                        WHEN cat_id = 102 THEN 'Овощи гриль ' || i || ' (200г)'
                        
                        -- Pasta categories
                        WHEN cat_id = 106 THEN 'Карбонара ' || i || ' (300г)'
                        WHEN cat_id = 107 THEN 'Болоньезе ' || i || ' (300г)'
                        WHEN cat_id = 108 THEN 'Паста с морепродуктами ' || i || ' (300г)'
                        WHEN cat_id = 109 THEN 'Пад Тай с курицей ' || i
                        WHEN cat_id = 110 THEN 'Удон с говядиной ' || i
                        WHEN cat_id = 111 THEN 'Лапша с овощами ' || i
                        WHEN cat_id = 112 THEN 'Ризотто с грибами ' || i || ' (250г)'
                        WHEN cat_id = 113 THEN 'Плов узбекский ' || i || ' (300г)'
                        
                        -- Desserts categories
                        WHEN cat_id = 117 THEN 'Чизкейк Нью-Йорк ' || i || ' (150г)'
                        WHEN cat_id = 118 THEN 'Торт шоколадный ' || i || ' (120г)'
                        WHEN cat_id = 119 THEN 'Тирамису ' || i || ' (120г)'
                        WHEN cat_id = 120 THEN 'Панна-котта ' || i || ' (100г)'
                        WHEN cat_id = 121 THEN 'Брауни ' || i || ' (100г)'
                        WHEN cat_id = 122 THEN 'Мороженое ванильное ' || i || ' (100г)'
                        WHEN cat_id = 123 THEN 'Мороженое шоколадное ' || i || ' (100г)'
                        WHEN cat_id = 124 THEN 'Пирожное эклер ' || i || ' (80г)'
                        WHEN cat_id = 125 THEN 'Макарон ' || i || ' (3 шт)'
                        
                        -- Drinks categories
                        WHEN cat_id = 127 THEN 'Лате ' || i || ' (250мл)'
                        WHEN cat_id = 128 THEN 'Капучино ' || i || ' (200мл)'
                        WHEN cat_id = 129 THEN 'Американо ' || i || ' (200мл)'
                        WHEN cat_id = 130 THEN 'Эспрессо ' || i || ' (30мл)'
                        WHEN cat_id = 131 THEN 'Чай чёрный ' || i || ' (250мл)'
                        WHEN cat_id = 132 THEN 'Чай зелёный ' || i || ' (250мл)'
                        WHEN cat_id = 133 THEN 'Смузи ягодный ' || i || ' (300мл)'
                        WHEN cat_id = 134 THEN 'Сок апельсиновый ' || i || ' (250мл)'
                        WHEN cat_id = 135 THEN 'Лимонад ' || i || ' (300мл)'
                        
                        -- Combos categories
                        WHEN cat_id = 138 THEN 'Бизнес-ланч ' || i
                        WHEN cat_id = 139 THEN 'Комбо бургер ' || i
                        WHEN cat_id = 140 THEN 'Сет для двоих ' || i
                        WHEN cat_id = 141 THEN 'Семейный сет ' || i
                        
                        -- Additional categories from seed_extra
                        WHEN cat_id = 144 THEN 'Тост с авокадо ' || i
                        WHEN cat_id = 145 THEN 'Тост с лососем ' || i
                        WHEN cat_id = 148 THEN 'Острый вок с курицей ' || i
                        WHEN cat_id = 151 THEN 'Терияки боул ' || i
                        WHEN cat_id = 154 THEN 'Фисташковый мусс ' || i
                        
                        ELSE 'Блюдо категории ' || cat_id || ' вариант ' || i
                    END,
                    CASE 
                        WHEN cat_id IN (16, 17, 18) THEN 'Свежая выпечка'
                        WHEN cat_id IN (19, 20, 21) THEN 'Ароматные булочки'
                        WHEN cat_id IN (22, 23, 24) THEN 'Домашние пироги'
                        WHEN cat_id IN (28, 29, 30) THEN 'Сытный завтрак'
                        WHEN cat_id IN (31, 32, 33) THEN 'Полезный завтрак'
                        WHEN cat_id IN (34, 35, 36) THEN 'Классический завтрак'
                        WHEN cat_id IN (40, 41, 42) THEN 'Лёгкая закуска'
                        WHEN cat_id IN (43, 44, 45) THEN 'Горячая закуска'
                        WHEN cat_id IN (46, 47, 48) THEN 'Снеки'
                        WHEN cat_id IN (52, 53, 54) THEN 'Свежий салат'
                        WHEN cat_id IN (55, 56, 57) THEN 'Питательный боул'
                        WHEN cat_id IN (58, 59, 60) THEN 'Тёплый салат'
                        WHEN cat_id IN (64, 65, 66) THEN 'Наваристый суп'
                        WHEN cat_id IN (67, 68) THEN 'Кремовый суп'
                        WHEN cat_id IN (69, 70) THEN 'Азиатский суп'
                        WHEN cat_id IN (74, 75, 76) THEN 'Классическая пицца'
                        WHEN cat_id IN (77, 78) THEN 'Авторская пицца'
                        WHEN cat_id IN (79, 80) THEN 'Мини-формат'
                        WHEN cat_id IN (84, 85, 86) THEN 'Сочный бургер'
                        WHEN cat_id IN (87, 88) THEN 'Сэндвич'
                        WHEN cat_id IN (89, 90, 91) THEN 'Стрит-фуд'
                        WHEN cat_id IN (95, 96, 97) THEN 'Мясное блюдо'
                        WHEN cat_id IN (98, 99) THEN 'Рыба и морепродукты'
                        WHEN cat_id IN (100, 101, 102) THEN 'Гарнир'
                        WHEN cat_id IN (106, 107, 108) THEN 'Итальянская паста'
                        WHEN cat_id IN (109, 110, 111) THEN 'Азиатская лапша'
                        WHEN cat_id IN (112, 113) THEN 'Рисовое блюдо'
                        WHEN cat_id IN (117, 118, 119) THEN 'Классический десерт'
                        WHEN cat_id IN (120, 121) THEN 'Лёгкий десерт'
                        WHEN cat_id IN (122, 123) THEN 'Мороженое'
                        WHEN cat_id IN (124, 125) THEN 'Кондитерское изделие'
                        WHEN cat_id IN (127, 128, 129, 130) THEN 'Кофе'
                        WHEN cat_id IN (131, 132) THEN 'Чай'
                        WHEN cat_id IN (133, 134, 135) THEN 'Напиток'
                        WHEN cat_id IN (138, 139, 140, 141) THEN 'Комплексный обед'
                        ELSE 'Вкусное блюдо'
                    END,
                    CASE 
                        WHEN cat_id IN (16, 17, 18, 19, 20, 21, 22, 23, 24) THEN 80.00 + (i * 20)
                        WHEN cat_id IN (28, 29, 30, 31, 32, 33, 34, 35, 36) THEN 250.00 + (i * 30)
                        WHEN cat_id IN (40, 41, 42, 43, 44, 45, 46, 47, 48) THEN 150.00 + (i * 25)
                        WHEN cat_id IN (52, 53, 54, 55, 56, 57, 58, 59, 60) THEN 320.00 + (i * 40)
                        WHEN cat_id IN (64, 65, 66, 67, 68, 69, 70) THEN 280.00 + (i * 35)
                        WHEN cat_id IN (74, 75, 76, 77, 78, 79, 80) THEN 350.00 + (i * 50)
                        WHEN cat_id IN (84, 85, 86, 87, 88, 89, 90, 91) THEN 380.00 + (i * 40)
                        WHEN cat_id IN (95, 96, 97, 98, 99, 100, 101, 102) THEN 450.00 + (i * 50)
                        WHEN cat_id IN (106, 107, 108, 109, 110, 111, 112, 113) THEN 420.00 + (i * 45)
                        WHEN cat_id IN (117, 118, 119, 120, 121, 122, 123, 124, 125) THEN 250.00 + (i * 30)
                        WHEN cat_id IN (127, 128, 129, 130, 131, 132, 133, 134, 135) THEN 150.00 + (i * 20)
                        WHEN cat_id IN (138, 139, 140, 141) THEN 500.00 + (i * 100)
                        WHEN cat_id IN (144, 145, 148, 151, 154) THEN 350.00 + (i * 50)
                        ELSE 300.00 + (i * 30)
                    END,
                    'RUB',
                    TRUE,
                    TRUE,
                    100,
                    NOW(),
                    NOW(),
                    0,
                    cat_id,
                    (i % 2 = 0), -- Alternate between anonymous and branded
                    CASE 
                        WHEN cat_id IN (16, 17, 18) THEN 'Свежая выпечка из печи'
                        WHEN cat_id IN (19, 20, 21) THEN 'Ароматные булочки'
                        WHEN cat_id IN (22, 23, 24) THEN 'Домашние пироги'
                        WHEN cat_id IN (28, 29, 30) THEN 'Сытный завтрак'
                        WHEN cat_id IN (31, 32, 33) THEN 'Полезный завтрак'
                        WHEN cat_id IN (34, 35, 36) THEN 'Классический завтрак'
                        WHEN cat_id IN (40, 41, 42) THEN 'Лёгкая закуска'
                        WHEN cat_id IN (43, 44, 45) THEN 'Горячая закуска'
                        WHEN cat_id IN (46, 47, 48) THEN 'Снеки'
                        WHEN cat_id IN (52, 53, 54) THEN 'Свежий салат'
                        WHEN cat_id IN (55, 56, 57) THEN 'Питательный боул'
                        WHEN cat_id IN (58, 59, 60) THEN 'Тёплый салат'
                        WHEN cat_id IN (64, 65, 66) THEN 'Наваристый суп'
                        WHEN cat_id IN (67, 68) THEN 'Кремовый суп'
                        WHEN cat_id IN (69, 70) THEN 'Азиатский суп'
                        WHEN cat_id IN (74, 75, 76) THEN 'Классическая пицца'
                        WHEN cat_id IN (77, 78) THEN 'Авторская пицца'
                        WHEN cat_id IN (79, 80) THEN 'Мини-формат'
                        WHEN cat_id IN (84, 85, 86) THEN 'Сочный бургер'
                        WHEN cat_id IN (87, 88) THEN 'Сэндвич'
                        WHEN cat_id IN (89, 90, 91) THEN 'Стрит-фуд'
                        WHEN cat_id IN (95, 96, 97) THEN 'Мясное блюдо'
                        WHEN cat_id IN (98, 99) THEN 'Рыба и морепродукты'
                        WHEN cat_id IN (100, 101, 102) THEN 'Гарнир'
                        WHEN cat_id IN (106, 107, 108) THEN 'Итальянская паста'
                        WHEN cat_id IN (109, 110, 111) THEN 'Азиатская лапша'
                        WHEN cat_id IN (112, 113) THEN 'Рисовое блюдо'
                        WHEN cat_id IN (117, 118, 119) THEN 'Классический десерт'
                        WHEN cat_id IN (120, 121) THEN 'Лёгкий десерт'
                        WHEN cat_id IN (122, 123) THEN 'Мороженое'
                        WHEN cat_id IN (124, 125) THEN 'Кондитерское изделие'
                        WHEN cat_id IN (127, 128, 129, 130) THEN 'Кофе'
                        WHEN cat_id IN (131, 132) THEN 'Чай'
                        WHEN cat_id IN (133, 134, 135) THEN 'Напиток'
                        WHEN cat_id IN (138, 139, 140, 141) THEN 'Комплексный обед'
                        ELSE 'Вкусное блюдо'
                    END
                );
                
                RAISE NOTICE 'Added menu item % to category %', new_item_id, cat_id;
            END LOOP;
        END IF;
    END LOOP;
    
    -- Update sequence
    PERFORM setval('menu_items_id_seq', max_item_id, true);
    
    RAISE NOTICE 'Done! Added items to ensure at least 3 items per category.';
END $$;

