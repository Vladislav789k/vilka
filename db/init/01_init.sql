-- ============================================================================
-- Vilka Database Initialization Script
-- ============================================================================
-- This is the canonical database initialization script for the Vilka project.
-- It contains:
--   - Complete schema (types, tables, sequences, constraints, indexes)
--   - Smart cart schema additions
--   - All seed data (restaurants, categories, menu items)
--   - Idempotent inserts (safe to re-run)
--
-- Usage:
--   - Automatically runs on first Postgres container startup via Docker
--   - Can be manually run: psql -U kasashka -d kasashka_db -f db/init/01_init.sql
-- ============================================================================

-- ============================================================================
-- 1. TYPES / ENUMS
-- ============================================================================

CREATE TYPE public.menu_option_type AS ENUM (
    'single',
    'multi',
    'size',
    'addon'
);

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Cart tables (with smart cart additions)
CREATE TABLE public.cart_items (
    id bigint NOT NULL,
    cart_id bigint NOT NULL,
    menu_item_id bigint NOT NULL,
    quantity integer NOT NULL,
    item_name text NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    options jsonb,
    comment text,
    allow_replacement boolean DEFAULT true,
    favorite boolean DEFAULT false,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);

CREATE TABLE public.carts (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cart_token text UNIQUE,
    delivery_slot text,
    tips_amount numeric(10,2),
    promo_code text,
    promo_discount numeric(10,2) DEFAULT 0,
    CONSTRAINT carts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ordered'::text, 'abandoned'::text])))
);

-- Smart cart tables
CREATE TABLE public.saved_carts (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL,
    name text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.favorite_items (
    user_id bigint NOT NULL,
    menu_item_id bigint NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id, menu_item_id)
);

CREATE TABLE public.cart_shares (
    id bigserial PRIMARY KEY,
    token text UNIQUE NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    created_by bigint
);

CREATE TABLE public.cart_events (
    id bigserial PRIMARY KEY,
    cart_id bigint NOT NULL,
    user_id bigint,
    event_type text NOT NULL,
    payload jsonb,
    created_at timestamptz DEFAULT now()
);

-- Conversation tables
CREATE TABLE public.conversation_participants (
    conversation_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role text
);

CREATE TABLE public.conversations (
    id bigint NOT NULL,
    order_id bigint,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_type_check CHECK ((type = ANY (ARRAY['order'::text, 'support'::text])))
);

-- Cuisine tables
CREATE TABLE public.cuisines (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);

-- Delivery tables
CREATE TABLE public.delivery_locations (
    id bigint NOT NULL,
    delivery_task_id bigint NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.delivery_tasks (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    courier_id bigint,
    status text NOT NULL,
    pickup_eta timestamp with time zone,
    delivery_eta timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'assigned'::text, 'picked_up'::text, 'delivering'::text, 'completed'::text, 'cancelled'::text])))
);

-- Menu tables
CREATE TABLE public.menu_categories (
    id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    global_category_id bigint
);

CREATE TABLE public.menu_item_option_links (
    menu_item_id bigint NOT NULL,
    option_id bigint NOT NULL
);

CREATE TABLE public.menu_item_option_values (
    id bigint NOT NULL,
    option_id bigint NOT NULL,
    name text NOT NULL,
    price_delta numeric(10,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.menu_item_options (
    id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    name text NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    min_selected integer DEFAULT 0 NOT NULL,
    max_selected integer DEFAULT 1 NOT NULL,
    type public.menu_option_type DEFAULT 'single'::public.menu_option_type NOT NULL
);

CREATE TABLE public.menu_items (
    id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    category_id bigint,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    currency text DEFAULT 'RUB'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    image_url text,
    weight_grams integer,
    calories integer,
    proteins numeric(6,2),
    fats numeric(6,2),
    carbs numeric(6,2),
    tags text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    product_id bigint,
    listing_mode smallint DEFAULT 0 NOT NULL,
    old_price numeric,
    ref_category_id bigint,
    is_brand_anonymous boolean DEFAULT false NOT NULL,
    base_price numeric(10,2),
    discount_percent numeric(5,2),
    discount_fixed numeric(10,2),
    composition text,
    CONSTRAINT chk_menu_items_listing_mode CHECK ((listing_mode = ANY (ARRAY[0, 1, 2]))),
    CONSTRAINT menu_items_discount_fixed_check CHECK (((discount_fixed IS NULL) OR (discount_fixed >= (0)::numeric))),
    CONSTRAINT menu_items_discount_percent_check CHECK (((discount_percent IS NULL) OR ((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))))
);

-- Message tables
CREATE TABLE public.messages (
    id bigint NOT NULL,
    conversation_id bigint NOT NULL,
    sender_id bigint NOT NULL,
    body text,
    payload jsonb,
    message_type text DEFAULT 'text'::text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_message_type_check CHECK ((message_type = ANY (ARRAY['text'::text, 'system'::text, 'image'::text])))
);

-- Notification tables
CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint,
    type text NOT NULL,
    title text,
    body text,
    data jsonb,
    channel text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT notifications_channel_check CHECK ((channel = ANY (ARRAY['push'::text, 'email'::text, 'sms'::text, 'in_app'::text]))),
    CONSTRAINT notifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text])))
);

-- Order tables
CREATE TABLE public.order_items (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    menu_item_id bigint,
    item_name text NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    options jsonb,
    comment text
);

CREATE TABLE public.order_status_history (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    status text NOT NULL,
    changed_by bigint,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.orders (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    courier_id bigint,
    address_id bigint,
    total_amount numeric(10,2) NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(10,2) DEFAULT 0 NOT NULL,
    final_amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'RUB'::text NOT NULL,
    status text NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    payment_method text,
    customer_comment text,
    restaurant_comment text,
    cancelled_reason text,
    estimated_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['new'::text, 'accepted'::text, 'rejected'::text, 'cooking'::text, 'ready_for_pickup'::text, 'assigned_to_courier'::text, 'delivering'::text, 'delivered'::text, 'cancelled'::text])))
);

-- Payment tables
CREATE TABLE public.payment_transactions (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    provider text NOT NULL,
    provider_tx_id text,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'RUB'::text NOT NULL,
    status text NOT NULL,
    raw_payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'refunded'::text])))
);

-- Product tables
CREATE TABLE public.product_categories (
    id bigint NOT NULL,
    parent_id bigint,
    name text NOT NULL,
    slug text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.products (
    id bigint NOT NULL,
    category_id bigint NOT NULL,
    name text NOT NULL,
    description text,
    default_image_url text,
    unit_name text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Reference tables
CREATE TABLE public.ref_dish_categories (
    id bigint NOT NULL,
    parent_id bigint,
    level smallint NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ref_dish_categories_level_check CHECK (((level >= 1) AND (level <= 3)))
);

CREATE TABLE public.restaurant_cuisines (
    restaurant_id bigint NOT NULL,
    cuisine_id integer NOT NULL
);

CREATE TABLE public.restaurants (
    id bigint NOT NULL,
    owner_user_id bigint NOT NULL,
    name text NOT NULL,
    description text,
    address_line text,
    city text,
    latitude double precision,
    longitude double precision,
    min_order_amount numeric(10,2) DEFAULT 0,
    delivery_fee numeric(10,2) DEFAULT 0,
    is_active boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    rating_avg numeric(3,2) DEFAULT 0,
    rating_count integer DEFAULT 0,
    settings jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    business_access_code text,
    CONSTRAINT restaurants_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'blocked'::text])))
);

CREATE TABLE public.reviews (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    user_id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

-- User tables
CREATE TABLE public.sms_login_codes (
    id bigint NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    purpose text DEFAULT 'login'::text NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_login_codes_purpose_check CHECK ((purpose = ANY (ARRAY['login'::text, 'signup'::text, 'password_reset'::text])))
);

CREATE TABLE public.user_addresses (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    label text,
    address_line text NOT NULL,
    city text,
    latitude double precision,
    longitude double precision,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    comment text
);

CREATE TABLE public.user_devices (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    device_type text NOT NULL,
    push_token text NOT NULL,
    user_agent text,
    last_seen_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_devices_device_type_check CHECK ((device_type = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])))
);

CREATE TABLE public.user_favorite_cuisines (
    user_id bigint NOT NULL,
    cuisine_id integer NOT NULL
);

CREATE TABLE public.user_profiles (
    user_id bigint NOT NULL,
    full_name text,
    avatar_url text,
    birthday date,
    gender text,
    preferences jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.users (
    id bigint NOT NULL,
    email text,
    phone text NOT NULL,
    password_hash text,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_verified boolean DEFAULT false NOT NULL,
    phone_verified_at timestamp with time zone,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'restaurant_owner'::text, 'courier'::text, 'admin'::text])))
);

-- ============================================================================
-- 3. SEQUENCES
-- ============================================================================

CREATE SEQUENCE public.cart_items_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;

CREATE SEQUENCE public.carts_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.carts_id_seq OWNED BY public.carts.id;

CREATE SEQUENCE public.conversations_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;

CREATE SEQUENCE public.cuisines_id_seq AS integer START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.cuisines_id_seq OWNED BY public.cuisines.id;

CREATE SEQUENCE public.delivery_locations_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.delivery_locations_id_seq OWNED BY public.delivery_locations.id;

CREATE SEQUENCE public.delivery_tasks_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.delivery_tasks_id_seq OWNED BY public.delivery_tasks.id;

CREATE SEQUENCE public.menu_categories_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.menu_categories_id_seq OWNED BY public.menu_categories.id;

CREATE SEQUENCE public.menu_item_option_values_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.menu_item_option_values_id_seq OWNED BY public.menu_item_option_values.id;

CREATE SEQUENCE public.menu_item_options_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.menu_item_options_id_seq OWNED BY public.menu_item_options.id;

CREATE SEQUENCE public.menu_items_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;

CREATE SEQUENCE public.messages_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;

CREATE SEQUENCE public.notifications_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;

CREATE SEQUENCE public.order_items_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;

CREATE SEQUENCE public.order_status_history_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;

CREATE SEQUENCE public.orders_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;

CREATE SEQUENCE public.payment_transactions_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.payment_transactions_id_seq OWNED BY public.payment_transactions.id;

CREATE SEQUENCE public.product_categories_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.product_categories_id_seq OWNED BY public.product_categories.id;

CREATE SEQUENCE public.products_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;

CREATE SEQUENCE public.ref_dish_categories_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.ref_dish_categories_id_seq OWNED BY public.ref_dish_categories.id;

CREATE SEQUENCE public.restaurants_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.restaurants_id_seq OWNED BY public.restaurants.id;

CREATE SEQUENCE public.reviews_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;

CREATE SEQUENCE public.sms_login_codes_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.sms_login_codes_id_seq OWNED BY public.sms_login_codes.id;

CREATE SEQUENCE public.user_addresses_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.user_addresses_id_seq OWNED BY public.user_addresses.id;

CREATE SEQUENCE public.user_devices_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.user_devices_id_seq OWNED BY public.user_devices.id;

CREATE SEQUENCE public.users_id_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

-- ============================================================================
-- 4. DEFAULTS (sequence assignments)
-- ============================================================================

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);
ALTER TABLE ONLY public.carts ALTER COLUMN id SET DEFAULT nextval('public.carts_id_seq'::regclass);
ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);
ALTER TABLE ONLY public.cuisines ALTER COLUMN id SET DEFAULT nextval('public.cuisines_id_seq'::regclass);
ALTER TABLE ONLY public.delivery_locations ALTER COLUMN id SET DEFAULT nextval('public.delivery_locations_id_seq'::regclass);
ALTER TABLE ONLY public.delivery_tasks ALTER COLUMN id SET DEFAULT nextval('public.delivery_tasks_id_seq'::regclass);
ALTER TABLE ONLY public.menu_categories ALTER COLUMN id SET DEFAULT nextval('public.menu_categories_id_seq'::regclass);
ALTER TABLE ONLY public.menu_item_option_values ALTER COLUMN id SET DEFAULT nextval('public.menu_item_option_values_id_seq'::regclass);
ALTER TABLE ONLY public.menu_item_options ALTER COLUMN id SET DEFAULT nextval('public.menu_item_options_id_seq'::regclass);
ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);
ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);
ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);
ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);
ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);
ALTER TABLE ONLY public.payment_transactions ALTER COLUMN id SET DEFAULT nextval('public.payment_transactions_id_seq'::regclass);
ALTER TABLE ONLY public.product_categories ALTER COLUMN id SET DEFAULT nextval('public.product_categories_id_seq'::regclass);
ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);
ALTER TABLE ONLY public.ref_dish_categories ALTER COLUMN id SET DEFAULT nextval('public.ref_dish_categories_id_seq'::regclass);
ALTER TABLE ONLY public.restaurants ALTER COLUMN id SET DEFAULT nextval('public.restaurants_id_seq'::regclass);
ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);
ALTER TABLE ONLY public.sms_login_codes ALTER COLUMN id SET DEFAULT nextval('public.sms_login_codes_id_seq'::regclass);
ALTER TABLE ONLY public.user_addresses ALTER COLUMN id SET DEFAULT nextval('public.user_addresses_id_seq'::regclass);
ALTER TABLE ONLY public.user_devices ALTER COLUMN id SET DEFAULT nextval('public.user_devices_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

-- ============================================================================
-- 5. PRIMARY KEYS
-- ============================================================================

ALTER TABLE ONLY public.cart_items ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.carts ADD CONSTRAINT carts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.conversation_participants ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);
ALTER TABLE ONLY public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cuisines ADD CONSTRAINT cuisines_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.delivery_locations ADD CONSTRAINT delivery_locations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.delivery_tasks ADD CONSTRAINT delivery_tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.menu_categories ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.menu_item_option_links ADD CONSTRAINT menu_item_option_links_pkey PRIMARY KEY (menu_item_id, option_id);
ALTER TABLE ONLY public.menu_item_option_values ADD CONSTRAINT menu_item_option_values_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.menu_item_options ADD CONSTRAINT menu_item_options_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.menu_items ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_status_history ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.payment_transactions ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.product_categories ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.ref_dish_categories ADD CONSTRAINT ref_dish_categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.restaurant_cuisines ADD CONSTRAINT restaurant_cuisines_pkey PRIMARY KEY (restaurant_id, cuisine_id);
ALTER TABLE ONLY public.restaurants ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sms_login_codes ADD CONSTRAINT sms_login_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_addresses ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_devices ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.user_favorite_cuisines ADD CONSTRAINT user_favorite_cuisines_pkey PRIMARY KEY (user_id, cuisine_id);
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);

-- ============================================================================
-- 6. UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE ONLY public.cuisines ADD CONSTRAINT cuisines_code_key UNIQUE (code);
ALTER TABLE ONLY public.product_categories ADD CONSTRAINT product_categories_slug_key UNIQUE (slug);
ALTER TABLE ONLY public.ref_dish_categories ADD CONSTRAINT ref_dish_categories_code_key UNIQUE (code);
ALTER TABLE ONLY public.restaurants ADD CONSTRAINT restaurants_business_access_code_key UNIQUE (business_access_code);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE ONLY public.users ADD CONSTRAINT users_phone_key UNIQUE (phone);

-- ============================================================================
-- 7. FOREIGN KEYS
-- ============================================================================

ALTER TABLE ONLY public.cart_items ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.cart_items ADD CONSTRAINT cart_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.carts ADD CONSTRAINT carts_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.carts ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.conversation_participants ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.conversation_participants ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.conversations ADD CONSTRAINT conversations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.delivery_locations ADD CONSTRAINT delivery_locations_delivery_task_id_fkey FOREIGN KEY (delivery_task_id) REFERENCES public.delivery_tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.delivery_tasks ADD CONSTRAINT delivery_tasks_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.delivery_tasks ADD CONSTRAINT delivery_tasks_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.menu_categories ADD CONSTRAINT menu_categories_global_category_id_fkey FOREIGN KEY (global_category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.menu_categories ADD CONSTRAINT menu_categories_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.menu_item_option_links ADD CONSTRAINT menu_item_option_links_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.menu_item_option_links ADD CONSTRAINT menu_item_option_links_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.menu_item_options(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.menu_item_option_values ADD CONSTRAINT menu_item_option_values_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.menu_item_options(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.menu_item_options ADD CONSTRAINT menu_item_options_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.menu_items ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.menu_items ADD CONSTRAINT menu_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.menu_items ADD CONSTRAINT menu_items_ref_category_id_fkey FOREIGN KEY (ref_category_id) REFERENCES public.ref_dish_categories(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.menu_items ADD CONSTRAINT menu_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);
ALTER TABLE ONLY public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_status_history ADD CONSTRAINT order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.order_status_history ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.user_addresses(id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);
ALTER TABLE ONLY public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.payment_transactions ADD CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_categories ADD CONSTRAINT product_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.ref_dish_categories ADD CONSTRAINT ref_dish_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ref_dish_categories(id) ON DELETE RESTRICT;
ALTER TABLE ONLY public.restaurant_cuisines ADD CONSTRAINT restaurant_cuisines_cuisine_id_fkey FOREIGN KEY (cuisine_id) REFERENCES public.cuisines(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.restaurant_cuisines ADD CONSTRAINT fk_restaurant_cuisines_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.restaurants ADD CONSTRAINT restaurants_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_addresses ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_devices ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_favorite_cuisines ADD CONSTRAINT user_favorite_cuisines_cuisine_id_fkey FOREIGN KEY (cuisine_id) REFERENCES public.cuisines(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_favorite_cuisines ADD CONSTRAINT user_favorite_cuisines_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 8. INDEXES
-- ============================================================================

CREATE INDEX idx_cart_items_cart ON public.cart_items USING btree (cart_id);
CREATE INDEX idx_carts_user ON public.carts USING btree (user_id);
CREATE INDEX idx_delivery_locations_task_time ON public.delivery_locations USING btree (delivery_task_id, recorded_at);
CREATE INDEX idx_delivery_tasks_courier_id ON public.delivery_tasks USING btree (courier_id);
CREATE INDEX idx_menu_categories_global_category ON public.menu_categories USING btree (global_category_id);
CREATE INDEX idx_menu_items_product ON public.menu_items USING btree (product_id);
CREATE INDEX idx_menu_items_product_mode_available ON public.menu_items USING btree (product_id, listing_mode, is_available);
CREATE INDEX idx_menu_items_product_restaurant ON public.menu_items USING btree (restaurant_id, product_id);
CREATE INDEX idx_menu_items_restaurant_active ON public.menu_items USING btree (restaurant_id, is_active, is_available);
CREATE INDEX idx_menu_items_restaurant_available ON public.menu_items USING btree (restaurant_id, is_available);
CREATE INDEX idx_messages_conversation_time ON public.messages USING btree (conversation_id, created_at);
CREATE INDEX idx_notifications_user_status ON public.notifications USING btree (user_id, status);
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id, created_at);
CREATE INDEX idx_orders_courier_id ON public.orders USING btree (courier_id);
CREATE INDEX idx_orders_restaurant_id ON public.orders USING btree (restaurant_id);
CREATE INDEX idx_orders_status ON public.orders USING btree (status);
CREATE INDEX idx_orders_user_created ON public.orders USING btree (user_id, created_at DESC);
CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions USING btree (order_id);
CREATE INDEX idx_product_categories_parent ON public.product_categories USING btree (parent_id);
CREATE INDEX idx_products_category ON public.products USING btree (category_id);
CREATE INDEX idx_products_category_active ON public.products USING btree (category_id, is_active);
CREATE INDEX idx_ref_dish_categories_level ON public.ref_dish_categories USING btree (level);
CREATE INDEX idx_ref_dish_categories_parent ON public.ref_dish_categories USING btree (parent_id);
CREATE INDEX idx_restaurant_cuisines_cuisine ON public.restaurant_cuisines USING btree (cuisine_id);
CREATE INDEX idx_restaurants_city ON public.restaurants USING btree (city);
CREATE INDEX idx_reviews_restaurant_id ON public.reviews USING btree (restaurant_id);
CREATE INDEX idx_sms_login_codes_expires ON public.sms_login_codes USING btree (expires_at);
CREATE INDEX idx_sms_login_codes_phone ON public.sms_login_codes USING btree (phone);
CREATE INDEX idx_user_addresses_user_default ON public.user_addresses USING btree (user_id, is_default);
CREATE INDEX idx_user_addresses_user_id ON public.user_addresses USING btree (user_id);
CREATE INDEX idx_user_devices_user_id ON public.user_devices USING btree (user_id);
CREATE INDEX idx_user_favorite_cuisines_user ON public.user_favorite_cuisines USING btree (user_id);

-- ============================================================================
-- 9. SEED DATA
-- ============================================================================
-- All inserts use ON CONFLICT DO NOTHING for idempotency

-- Users
INSERT INTO public.users (id, email, phone, password_hash, role, is_active, created_at, updated_at, phone_verified, phone_verified_at)
VALUES (2, NULL, '79161525095', NULL, 'admin', TRUE, '2025-11-28 08:39:16.669769+00', '2025-11-28 08:39:16.669769+00', FALSE, NULL)
ON CONFLICT (id) DO NOTHING;

-- Restaurants
INSERT INTO public.restaurants (id, owner_user_id, name, description, address_line, city, latitude, longitude, min_order_amount, delivery_fee, is_active, status, rating_avg, rating_count, settings, created_at, updated_at, business_access_code)
VALUES (3, 2, 'Рестик 1', 'Ресторан с выпечкой', NULL, NULL, NULL, NULL, 0.00, 0.00, TRUE, 'pending', 0.00, 0, NULL, '2025-11-28 08:39:23.327122+00', '2025-11-28 08:39:23.327122+00', '123')
ON CONFLICT (id) DO NOTHING;

-- Reference dish categories (level 1)
INSERT INTO public.ref_dish_categories (id, parent_id, level, code, name, description, is_active, sort_order, created_at, updated_at)
VALUES
  (1, NULL, 1, 'bakery', 'Выпечка и хлеб', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (2, NULL, 1, 'breakfasts', 'Завтраки', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (3, NULL, 1, 'snacks', 'Закуски и снеки', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (4, NULL, 1, 'salads_bowls', 'Салаты и боулы', NULL, TRUE, 40, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (5, NULL, 1, 'soups', 'Супы', NULL, TRUE, 50, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (6, NULL, 1, 'pizza', 'Пицца и открытая выпечка', NULL, TRUE, 60, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (7, NULL, 1, 'burgers_streetfood', 'Бургеры, сэндвичи и стрит-фуд', NULL, TRUE, 70, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (8, NULL, 1, 'hot_dishes', 'Горячие блюда', NULL, TRUE, 80, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (9, NULL, 1, 'pasta_noodles', 'Паста, лапша и рис', NULL, TRUE, 90, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (10, NULL, 1, 'desserts', 'Десерты и сладкая выпечка', NULL, TRUE, 100, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (11, NULL, 1, 'drinks', 'Напитки', NULL, TRUE, 110, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (12, NULL, 1, 'combos', 'Комбо и сеты', NULL, TRUE, 120, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (142, NULL, 1, 'brunch_tapas', 'Бранчи и тапас', NULL, TRUE, 130, '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00'),
  (146, NULL, 1, 'asian_wok_fusion', 'Азиатский фьюжн', NULL, TRUE, 140, '2025-12-11 09:02:00+00', '2025-12-11 09:02:00+00'),
  (149, NULL, 1, 'bowls_protein', 'Протеиновые боулы', NULL, TRUE, 150, '2025-12-11 09:03:00+00', '2025-12-11 09:03:00+00'),
  (152, NULL, 1, 'desserts.modern', 'Современные десерты', NULL, TRUE, 160, '2025-12-11 09:04:00+00', '2025-12-11 09:04:00+00')
ON CONFLICT (id) DO NOTHING;

-- Reference dish categories (level 2)
INSERT INTO public.ref_dish_categories (id, parent_id, level, code, name, description, is_active, sort_order, created_at, updated_at)
VALUES
  (13, 1, 2, 'bakery.breads', 'Хлеб и багеты', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (14, 1, 2, 'bakery.buns', 'Булочки и сдоба', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (15, 1, 2, 'bakery.pies', 'Пироги и пирожки', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (25, 2, 2, 'breakfasts.eggs', 'Яичницы и омлеты', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (26, 2, 2, 'breakfasts.porridge', 'Каши и боулы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (27, 2, 2, 'breakfasts.bakery_sets', 'Завтраки с выпечкой', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (37, 3, 2, 'snacks.cold', 'Холодные закуски', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (38, 3, 2, 'snacks.hot', 'Горячие закуски', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (39, 3, 2, 'snacks.coffee', 'Снеки к кофе', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (49, 4, 2, 'salads.classic', 'Классические салаты', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (50, 4, 2, 'salads.bowls', 'Боулы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (51, 4, 2, 'salads.warm', 'Тёплые салаты', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (61, 5, 2, 'soups.classic', 'Классические супы', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (62, 5, 2, 'soups.cream', 'Крем-супы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (63, 5, 2, 'soups.asian', 'Азиатские супы', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (71, 6, 2, 'pizza.classic', 'Классическая пицца', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (72, 6, 2, 'pizza.special', 'Авторская пицца', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (73, 6, 2, 'pizza.mini', 'Мини-форматы', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (81, 7, 2, 'burgers.classic', 'Бургеры', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (82, 7, 2, 'burgers.sandwiches', 'Сэндвичи и панини', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (83, 7, 2, 'burgers.street', 'Стрит-фуд', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (92, 8, 2, 'hot.meat', 'Мясо и птица', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (93, 8, 2, 'hot.fish', 'Рыба и морепродукты', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (94, 8, 2, 'hot.side', 'Гарниры', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (103, 9, 2, 'pasta.italian', 'Европейская паста', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (104, 9, 2, 'pasta.asian', 'Азиатская лапша', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (105, 9, 2, 'pasta.rice', 'Рисовые блюда', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (114, 10, 2, 'desserts.cakes', 'Торты и пирожные', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (115, 10, 2, 'desserts.glass', 'Десерты в стаканчиках', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (116, 10, 2, 'desserts.icecream', 'Мороженое и сорбеты', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (123, 11, 2, 'drinks.coffee', 'Кофе и кофейные напитки', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (124, 11, 2, 'drinks.tea_hot', 'Чай и горячие напитки', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (125, 11, 2, 'drinks.cold', 'Холодные напитки', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (135, 12, 2, 'combos.lunch', 'Бизнес-ланчи', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (136, 12, 2, 'combos.sets', 'Сеты и наборы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (137, 12, 2, 'combos.kids', 'Детское меню', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (143, 142, 2, 'brunch.tostadas', 'Тосты и тостады', NULL, TRUE, 10, '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00'),
  (147, 146, 2, 'asian.wok.noodles', 'Воки и лапша', NULL, TRUE, 10, '2025-12-11 09:02:00+00', '2025-12-11 09:02:00+00'),
  (150, 149, 2, 'bowls.protein.chicken', 'Боулы с курицей', NULL, TRUE, 10, '2025-12-11 09:03:00+00', '2025-12-11 09:03:00+00'),
  (153, 152, 2, 'desserts.modern.mousse', 'Муссовые десерты', NULL, TRUE, 10, '2025-12-11 09:04:00+00', '2025-12-11 09:04:00+00')
ON CONFLICT (id) DO NOTHING;

-- Reference dish categories (level 3)
INSERT INTO public.ref_dish_categories (id, parent_id, level, code, name, description, is_active, sort_order, created_at, updated_at)
VALUES
  (16, 13, 3, 'bakery.breads.form', 'Формовой хлеб', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (17, 13, 3, 'bakery.breads.baguette', 'Багеты и чиабатта', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (18, 13, 3, 'bakery.breads.flat', 'Лепёшки и лаваши', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (19, 14, 3, 'bakery.buns.classic', 'Классические булочки', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (20, 14, 3, 'bakery.buns.filled', 'Булочки с начинкой', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (21, 14, 3, 'bakery.buns.cinnamon', 'Синнамон-роллы и улитки', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (22, 15, 3, 'bakery.pies.big', 'Большие пироги', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (23, 15, 3, 'bakery.pies.baked', 'Печёные пирожки', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (24, 15, 3, 'bakery.pies.fried', 'Жареные пирожки и беляши', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (28, 25, 3, 'breakfasts.eggs.scramble', 'Скрамбл', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (29, 25, 3, 'breakfasts.eggs.omelette', 'Омлеты', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (30, 25, 3, 'breakfasts.eggs.poached', 'Яйца пашот', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (31, 26, 3, 'breakfasts.porridge.milk', 'Каши на молоке / воде', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (32, 26, 3, 'breakfasts.porridge.grain', 'Зерновые боулы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (33, 26, 3, 'breakfasts.porridge.fruit', 'Фруктовые боулы', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (34, 27, 3, 'breakfasts.bakery_sets.toasts', 'Тосты и сэндвич-тосты', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (35, 27, 3, 'breakfasts.bakery_sets.pancakes', 'Блины и панкейки', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (36, 27, 3, 'breakfasts.bakery_sets.croissant', 'Круассан-завтраки', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (40, 37, 3, 'snacks.cold.bruschetta', 'Брускетты и тартинки', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (41, 37, 3, 'snacks.cold.meat_cheese', 'Сырные и мясные тарелки', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (42, 37, 3, 'snacks.cold.veggie', 'Овощные закуски', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (43, 38, 3, 'snacks.hot.nuggets', 'Наггетсы и стрипсы', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (44, 38, 3, 'snacks.hot.cheese', 'Сырные закуски', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (45, 38, 3, 'snacks.hot.potato', 'Картофель фри и др.', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (46, 39, 3, 'snacks.coffee.mini_pastry', 'Мини-выпечка', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (47, 39, 3, 'snacks.coffee.nuts', 'Орехи и сухофрукты', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (48, 39, 3, 'snacks.coffee.chips', 'Чипсы и снэки', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (52, 49, 3, 'salads.classic.olivier', 'Оливье / столичные', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (53, 49, 3, 'salads.classic.caesar', 'Цезарь', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (54, 49, 3, 'salads.classic.greeks', 'Греческий и овощные', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (55, 50, 3, 'salads.bowls.poke', 'Поке', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (56, 50, 3, 'salads.bowls.grain', 'Зерновые боулы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (57, 50, 3, 'salads.bowls.warm', 'Тёплые боулы', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (58, 51, 3, 'salads.warm.meat', 'Тёплые салаты с мясом', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (59, 51, 3, 'salads.warm.seafood', 'Тёплые салаты с морепродуктами', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (60, 51, 3, 'salads.warm.veggie', 'Тёплые овощные салаты', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (64, 61, 3, 'soups.classic.broth', 'Бульоны', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (65, 61, 3, 'soups.classic.traditional', 'Борщ, щи, солянка', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (66, 61, 3, 'soups.classic.other', 'Другие супы', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (67, 62, 3, 'soups.cream.veggie', 'Овощные крем-супы', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (68, 62, 3, 'soups.cream.cheese', 'Сырные крем-супы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (69, 63, 3, 'soups.asian.noodle', 'Лапшичные супы', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (70, 63, 3, 'soups.asian.spicy', 'Острые супы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (74, 71, 3, 'pizza.classic.standard', 'Маргарита, ветчина-грибы и др.', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (75, 71, 3, 'pizza.classic.meat', 'Мясные пиццы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (76, 71, 3, 'pizza.classic.veggie', 'Овощные пиццы', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (77, 72, 3, 'pizza.special.seafood', 'С морепродуктами', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (78, 72, 3, 'pizza.special.truffle', 'С трюфелем и премиум начинками', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (79, 73, 3, 'pizza.mini.slice', 'Пицца-слайсы', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (80, 73, 3, 'pizza.mini.mini', 'Мини-пиццы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (84, 81, 3, 'burgers.classic.beef', 'Бургеры с говядиной', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (85, 81, 3, 'burgers.classic.chicken', 'Чикен-бургеры', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (86, 81, 3, 'burgers.classic.veggie', 'Вегетарианские бургеры', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (87, 82, 3, 'burgers.sandwiches.cold', 'Холодные сэндвичи', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (88, 82, 3, 'burgers.sandwiches.hot', 'Горячие сэндвичи, панини', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (89, 83, 3, 'burgers.street.shawarma', 'Шаурма, гирос', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (90, 83, 3, 'burgers.street.hotdog', 'Хот-доги', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (91, 83, 3, 'burgers.street.other', 'Прочий стрит-фуд', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (95, 92, 3, 'hot.meat.steaks', 'Стейки и медальоны', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (96, 92, 3, 'hot.meat.cutlets', 'Котлеты и тефтели', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (97, 92, 3, 'hot.meat.chicken', 'Блюда из курицы', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (98, 93, 3, 'hot.fish.steaks', 'Рыбные стейки и филе', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (99, 93, 3, 'hot.fish.seafood', 'Блюда из морепродуктов', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (100, 94, 3, 'hot.side.potato', 'Картофельные гарниры', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (101, 94, 3, 'hot.side.grain', 'Крупы и рис', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (102, 94, 3, 'hot.side.veggies', 'Овощные гарниры', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (106, 103, 3, 'pasta.italian.classic', 'Классическая паста', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (107, 103, 3, 'pasta.italian.cream', 'Паста в сливочных соусах', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (108, 103, 3, 'pasta.italian.other', 'Прочие пасты', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (109, 104, 3, 'pasta.asian.udon', 'Удон', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (110, 104, 3, 'pasta.asian.soba', 'Соба', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (111, 104, 3, 'pasta.asian.wok', 'Лапша вок', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (112, 105, 3, 'pasta.rice.risotto', 'Ризотто', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (113, 105, 3, 'pasta.rice.wok', 'Рис в воке и пловы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (117, 114, 3, 'desserts.cakes.slice', 'Порционные кусочки торта', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (118, 114, 3, 'desserts.cakes.whole', 'Целые торты', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (119, 115, 3, 'desserts.glass.layered', 'Слоистые десерты / трайфлы', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (120, 115, 3, 'desserts.glass.creamy', 'Кремовые десерты', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (121, 116, 3, 'desserts.icecream.scoops', 'Шары мороженого', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (122, 116, 3, 'desserts.icecream.sorbets', 'Сорбеты и щербеты', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (126, 123, 3, 'drinks.coffee.espresso', 'Эспрессо и чёрный кофе', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (127, 123, 3, 'drinks.coffee.milk', 'Кофе с молоком', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (128, 123, 3, 'drinks.coffee.special', 'Авторские кофейные напитки', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (129, 124, 3, 'drinks.tea_hot.standard', 'Чёрный / зелёный чай', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (130, 124, 3, 'drinks.tea_hot.herbal', 'Травяные и фруктовые чаи', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (131, 124, 3, 'drinks.tea_hot.other', 'Прочие горячие напитки', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (132, 125, 3, 'drinks.cold.lemonades', 'Лимонады и морсы', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (133, 125, 3, 'drinks.cold.juices', 'Соки и смузи', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (134, 125, 3, 'drinks.cold.bottled', 'Готовые напитки в бутылках', NULL, TRUE, 30, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (138, 135, 3, 'combos.lunch.standard', 'Стандартные ланчи', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (139, 136, 3, 'combos.sets.party', 'Сеты для компании', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (140, 136, 3, 'combos.sets.family', 'Семейные наборы', NULL, TRUE, 20, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (141, 137, 3, 'combos.kids.menu', 'Детское меню', NULL, TRUE, 10, '2025-11-28 07:23:04.542861+00', '2025-11-28 07:23:04.542861+00'),
  (144, 143, 3, 'brunch.tostadas.avocado', 'Тосты с авокадо', NULL, TRUE, 10, '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00'),
  (145, 143, 3, 'brunch.tostadas.salmon', 'Тосты с лососем', NULL, TRUE, 20, '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00'),
  (148, 147, 3, 'asian.wok.spicy', 'Острые воки', NULL, TRUE, 10, '2025-12-11 09:02:00+00', '2025-12-11 09:02:00+00'),
  (151, 150, 3, 'bowls.protein.teriyaki', 'Боул терияки', NULL, TRUE, 10, '2025-12-11 09:03:00+00', '2025-12-11 09:03:00+00'),
  (154, 153, 3, 'desserts.modern.pistachio', 'Фисташковые муссы', NULL, TRUE, 10, '2025-12-11 09:04:00+00', '2025-12-11 09:04:00+00')
ON CONFLICT (id) DO NOTHING;

-- Menu items (all items from original + extra seeds)
INSERT INTO public.menu_items (id, restaurant_id, category_id, name, description, price, currency, is_active, is_available, image_url, weight_grams, calories, proteins, fats, carbs, tags, created_at, updated_at, product_id, listing_mode, old_price, ref_category_id, is_brand_anonymous, base_price, discount_percent, discount_fixed, composition)
VALUES
  (2, 3, NULL, 'булочка', NULL, 70.00, 'RUB', TRUE, TRUE, 'https://www.russianfood.com/dycontent/images_upl/634/big_633220.jpg', NULL, NULL, NULL, NULL, NULL, '{}', '2025-11-28 08:56:46.112315+00', '2025-11-28 08:56:46.112315+00', NULL, 0, NULL, 17, FALSE, NULL, 50.00, NULL, '21'),
  (4, 3, NULL, 'Пицца', NULL, 600.00, 'RUB', TRUE, TRUE, 'https://avatars.mds.yandex.net/get-vertis-journal/3934100/52e2da20-4226-46c6-8bcb-bf48560f7288.jpeg/1600x1600', NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-01 14:24:33.88301+00', '2025-12-01 14:24:33.88301+00', NULL, 0, NULL, 79, FALSE, NULL, 50.00, NULL, 'Пицца пепперони.\nСостав: Колбаса Салями, сыр, томатная паста, тесто\n800г.'),
  (5, 3, NULL, 'Пицца веган', NULL, 400.00, 'RUB', FALSE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-02 06:58:41.467629+00', '2025-12-02 06:58:41.467629+00', NULL, 0, NULL, 76, TRUE, NULL, 50.00, NULL, '123123'),
  (6, 3, NULL, 'Пицца веган 2', NULL, 700.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-02 07:01:48.411693+00', '2025-12-02 07:01:48.411693+00', NULL, 0, NULL, 76, TRUE, NULL, 80.00, NULL, '11111'),
  (7, 3, NULL, 'Пицца мясная', NULL, 300.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-02 07:03:01.045038+00', '2025-12-02 07:03:01.045038+00', NULL, 0, NULL, 75, FALSE, NULL, 50.00, NULL, '1111111'),
  (8, 3, NULL, 'Кофе', NULL, 300.00, 'RUB', TRUE, TRUE, 'https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.torrefacto.ru%2Fblog%2Flatte-coffee-recipes%2F&psig=AOvVaw0I3h12i-6WBdEPH5CDq9lF&ust=1765202028571000&source=images&cd=vfe&opi=89978449&ved=0CBEQjRxqFwoTCNjZ9ZHQq5EDFQAAAAAdAAAAABAE', NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-07 13:54:43.466471+00', '2025-12-07 13:54:43.466471+00', NULL, 0, NULL, 127, FALSE, NULL, 50.00, NULL, 'Банановый раф'),
  (9, 3, NULL, 'Багет', NULL, 300.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-07 13:59:35.336439+00', '2025-12-07 13:59:35.336439+00', NULL, 0, NULL, 17, TRUE, NULL, 79.00, NULL, NULL),
  (10, 3, NULL, 'Тост с авокадо и микрозеленью', NULL, 320.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 144, FALSE, NULL, NULL, NULL, 'Хрустящий тост с кремом из авокадо и микрозеленью.'),
  (11, 3, NULL, 'Тост с лососем и крем-чиз', NULL, 450.00, 'RUB', TRUE, TRUE, 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe', NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:01:00+00', '2025-12-11 09:01:00+00', NULL, 0, NULL, 145, FALSE, NULL, 15.00, NULL, 'Подкопчённый лосось, крем-чиз и огурец на зерновом хлебе.'),
  (12, 3, NULL, 'Острый вок с креветкой', NULL, 520.00, 'RUB', TRUE, TRUE, 'https://images.unsplash.com/photo-1559057194-95f0d7b7d7c7', NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:02:00+00', '2025-12-11 09:02:00+00', NULL, 0, NULL, 148, FALSE, NULL, 12.00, NULL, 'Пшеничная лапша, креветки, острый соус чили и овощи.'),
  (13, 3, NULL, 'Терияки боул с курицей', NULL, 480.00, 'RUB', TRUE, TRUE, 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783', NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:03:00+00', '2025-12-11 09:03:00+00', NULL, 0, NULL, 151, FALSE, NULL, 8.00, NULL, 'Тёплый рис, курица терияки, эдамаме и кунжут.'),
  (14, 3, NULL, 'Фисташковый мусс', NULL, 260.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:04:00+00', '2025-12-11 09:04:00+00', NULL, 0, NULL, 154, FALSE, NULL, NULL, NULL, 'Воздушный мусс с фисташковой пастой и белым шоколадом.'),
  (15, 3, NULL, 'Шаурма по-домашнему', NULL, 350.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 89, FALSE, NULL, NULL, NULL, 'Сочное мясо, свежие овощи и фирменный соус в лаваше.'),
  (16, 3, NULL, 'Chicken Teriyaki Bowl', NULL, 490.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 151, TRUE, NULL, 10.00, NULL, 'Тёплый рис, курица терияки, овощи и кунжутная заправка.'),
  (17, 3, NULL, 'Vegan Buddha Box', NULL, 420.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 56, FALSE, NULL, NULL, NULL, 'Киноа, авокадо, овощи на пару, хумус и тахини.'),
  (18, 3, NULL, 'Seafood Lunch Box', NULL, 580.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 99, TRUE, NULL, 15.00, NULL, 'Лосось, креветки, рис и овощи с соевым соусом.'),
  (19, 3, NULL, 'Цезарь с курицей', NULL, 380.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 53, FALSE, NULL, NULL, NULL, 'Свежий салат Цезарь с курицей гриль, пармезаном и соусом.'),
  (20, 3, NULL, 'Поке с тунцом', NULL, 520.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 55, FALSE, NULL, 12.00, NULL, 'Свежий тунец, рис, авокадо, водоросли и соус понзу.'),
  (21, 3, NULL, 'Борщ украинский', NULL, 320.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 65, TRUE, NULL, NULL, NULL, 'Классический борщ с говядиной, сметаной и зеленью.'),
  (22, 3, NULL, 'Том-ям с креветками', NULL, 450.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 70, FALSE, NULL, 8.00, NULL, 'Острый тайский суп с креветками, кокосовым молоком и лемонграссом.'),
  (23, 3, NULL, 'Пицца Маргарита', NULL, 390.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 74, FALSE, NULL, NULL, NULL, 'Классическая пицца с томатами, моцареллой и базиликом.'),
  (24, 3, NULL, 'Пицца Пепперони', NULL, 450.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 75, TRUE, NULL, 10.00, NULL, 'Острая пицца с пепперони и сыром.'),
  (25, 3, NULL, 'Чизбургер классический', NULL, 420.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 84, FALSE, NULL, NULL, NULL, 'Говяжья котлета, сыр, овощи и фирменный соус.'),
  (26, 3, NULL, 'Чикен-бургер', NULL, 380.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 85, FALSE, NULL, 5.00, NULL, 'Куриная котлета, салат, помидор и майонез.'),
  (27, 3, NULL, 'Шаурма классическая', NULL, 320.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 89, TRUE, NULL, NULL, NULL, 'Мясо, овощи, соус в лаваше.'),
  (28, 3, NULL, 'Стейк из говядины', NULL, 890.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 95, FALSE, NULL, 15.00, NULL, 'Сочный стейк средней прожарки с овощами гриль.'),
  (29, 3, NULL, 'Куриные крылышки BBQ', NULL, 350.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 97, FALSE, NULL, NULL, NULL, 'Хрустящие крылышки в соусе барбекю.'),
  (30, 3, NULL, 'Лосось на гриле', NULL, 650.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 98, TRUE, NULL, 12.00, NULL, 'Филе лосося с овощами и лимоном.'),
  (31, 3, NULL, 'Карбонара', NULL, 480.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 106, FALSE, NULL, NULL, NULL, 'Паста с беконом, яйцом и пармезаном.'),
  (32, 3, NULL, 'Паста с морепродуктами', NULL, 520.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 108, FALSE, NULL, 8.00, NULL, 'Спагетти с креветками, мидиями и томатным соусом.'),
  (33, 3, NULL, 'Пад Тай с курицей', NULL, 450.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 111, TRUE, NULL, NULL, NULL, 'Тайская лапша с курицей, яйцом и овощами.'),
  (34, 3, NULL, 'Ризотто с грибами', NULL, 420.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 112, FALSE, NULL, NULL, NULL, 'Кремовое ризотто с белыми грибами и пармезаном.'),
  (35, 3, NULL, 'Чизкейк Нью-Йорк', NULL, 320.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 117, FALSE, NULL, 10.00, NULL, 'Классический чизкейк с ягодным соусом.'),
  (36, 3, NULL, 'Тирамису', NULL, 280.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 119, FALSE, NULL, NULL, NULL, 'Итальянский десерт с кофе и маскарпоне.'),
  (37, 3, NULL, 'Лате классический', NULL, 180.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 127, TRUE, NULL, NULL, NULL, 'Эспрессо с молоком и молочной пеной.'),
  (38, 3, NULL, 'Капучино', NULL, 170.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 127, FALSE, NULL, NULL, NULL, 'Эспрессо с молоком и воздушной пеной.'),
  (39, 3, NULL, 'Смузи ягодный', NULL, 250.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 133, FALSE, NULL, 5.00, NULL, 'Смесь ягод, банан и йогурт.'),
  (40, 3, NULL, 'Бизнес-ланч', NULL, 450.00, 'RUB', TRUE, TRUE, NULL, NULL, NULL, NULL, NULL, NULL, '{}', '2025-12-11 09:00:00+00', '2025-12-11 09:00:00+00', NULL, 0, NULL, 138, TRUE, NULL, 20.00, NULL, 'Суп, второе блюдо, салат и напиток.')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 10. SEQUENCE UPDATES
-- ============================================================================
-- Update sequences to match max IDs after all inserts

SELECT setval('public.menu_items_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.menu_items), nextval('public.menu_items_id_seq')), true);
SELECT setval('public.ref_dish_categories_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.ref_dish_categories), nextval('public.ref_dish_categories_id_seq')), true);
SELECT setval('public.restaurants_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.restaurants), nextval('public.restaurants_id_seq')), true);
SELECT setval('public.users_id_seq', GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.users), nextval('public.users_id_seq')), true);

