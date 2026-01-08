--
-- PostgreSQL database dump
--

\restrict rlyrL0LFggyCTTc5CySfYAObhfwX5FxXXQ1mtVltFpTZplBQzt5rpeY0Hgci1tW

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: menu_option_type; Type: TYPE; Schema: public; Owner: kasashka
--

CREATE TYPE public.menu_option_type AS ENUM (
    'single',
    'multi',
    'size',
    'addon'
);


ALTER TYPE public.menu_option_type OWNER TO kasashka;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.cart_items (
    id bigint NOT NULL,
    cart_id bigint NOT NULL,
    menu_item_id bigint NOT NULL,
    quantity integer NOT NULL,
    item_name text NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    options jsonb,
    comment text,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.cart_items OWNER TO kasashka;

--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.cart_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cart_items_id_seq OWNER TO kasashka;

--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: carts; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.carts (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT carts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ordered'::text, 'abandoned'::text])))
);


ALTER TABLE public.carts OWNER TO kasashka;

--
-- Name: carts_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.carts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.carts_id_seq OWNER TO kasashka;

--
-- Name: carts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.carts_id_seq OWNED BY public.carts.id;


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.conversation_participants (
    conversation_id bigint NOT NULL,
    user_id bigint NOT NULL,
    role text
);


ALTER TABLE public.conversation_participants OWNER TO kasashka;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.conversations (
    id bigint NOT NULL,
    order_id bigint,
    type text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT conversations_type_check CHECK ((type = ANY (ARRAY['order'::text, 'support'::text])))
);


ALTER TABLE public.conversations OWNER TO kasashka;

--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.conversations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.conversations_id_seq OWNER TO kasashka;

--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: cuisines; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.cuisines (
    id integer NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.cuisines OWNER TO kasashka;

--
-- Name: cuisines_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.cuisines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.cuisines_id_seq OWNER TO kasashka;

--
-- Name: cuisines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.cuisines_id_seq OWNED BY public.cuisines.id;


--
-- Name: delivery_locations; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.delivery_locations (
    id bigint NOT NULL,
    delivery_task_id bigint NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.delivery_locations OWNER TO kasashka;

--
-- Name: delivery_locations_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.delivery_locations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.delivery_locations_id_seq OWNER TO kasashka;

--
-- Name: delivery_locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.delivery_locations_id_seq OWNED BY public.delivery_locations.id;


--
-- Name: delivery_tasks; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.delivery_tasks OWNER TO kasashka;

--
-- Name: delivery_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.delivery_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.delivery_tasks_id_seq OWNER TO kasashka;

--
-- Name: delivery_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.delivery_tasks_id_seq OWNED BY public.delivery_tasks.id;


--
-- Name: menu_categories; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.menu_categories (
    id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    global_category_id bigint
);


ALTER TABLE public.menu_categories OWNER TO kasashka;

--
-- Name: menu_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.menu_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.menu_categories_id_seq OWNER TO kasashka;

--
-- Name: menu_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.menu_categories_id_seq OWNED BY public.menu_categories.id;


--
-- Name: menu_item_option_links; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.menu_item_option_links (
    menu_item_id bigint NOT NULL,
    option_id bigint NOT NULL
);


ALTER TABLE public.menu_item_option_links OWNER TO kasashka;

--
-- Name: menu_item_option_values; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.menu_item_option_values (
    id bigint NOT NULL,
    option_id bigint NOT NULL,
    name text NOT NULL,
    price_delta numeric(10,2) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.menu_item_option_values OWNER TO kasashka;

--
-- Name: menu_item_option_values_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.menu_item_option_values_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.menu_item_option_values_id_seq OWNER TO kasashka;

--
-- Name: menu_item_option_values_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.menu_item_option_values_id_seq OWNED BY public.menu_item_option_values.id;


--
-- Name: menu_item_options; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.menu_item_options (
    id bigint NOT NULL,
    restaurant_id bigint NOT NULL,
    name text NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    min_selected integer DEFAULT 0 NOT NULL,
    max_selected integer DEFAULT 1 NOT NULL,
    type public.menu_option_type DEFAULT 'single'::public.menu_option_type NOT NULL
);


ALTER TABLE public.menu_item_options OWNER TO kasashka;

--
-- Name: menu_item_options_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.menu_item_options_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.menu_item_options_id_seq OWNER TO kasashka;

--
-- Name: menu_item_options_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.menu_item_options_id_seq OWNED BY public.menu_item_options.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: kasashka
--

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
    stock_qty integer DEFAULT 100 NOT NULL,
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


ALTER TABLE public.menu_items OWNER TO kasashka;

--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.menu_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.menu_items_id_seq OWNER TO kasashka;

--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: messages; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.messages OWNER TO kasashka;

--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.messages_id_seq OWNER TO kasashka;

--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.notifications OWNER TO kasashka;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.notifications_id_seq OWNER TO kasashka;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.order_items OWNER TO kasashka;

--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_items_id_seq OWNER TO kasashka;

--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.order_status_history (
    id bigint NOT NULL,
    order_id bigint NOT NULL,
    status text NOT NULL,
    changed_by bigint,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_status_history OWNER TO kasashka;

--
-- Name: order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.order_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.order_status_history_id_seq OWNER TO kasashka;

--
-- Name: order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.orders OWNER TO kasashka;

--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.orders_id_seq OWNER TO kasashka;

--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.payment_transactions OWNER TO kasashka;

--
-- Name: payment_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.payment_transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.payment_transactions_id_seq OWNER TO kasashka;

--
-- Name: payment_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.payment_transactions_id_seq OWNED BY public.payment_transactions.id;


--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.product_categories OWNER TO kasashka;

--
-- Name: product_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.product_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.product_categories_id_seq OWNER TO kasashka;

--
-- Name: product_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.product_categories_id_seq OWNED BY public.product_categories.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.products OWNER TO kasashka;

--
-- Name: products_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.products_id_seq OWNER TO kasashka;

--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;


--
-- Name: ref_dish_categories; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.ref_dish_categories OWNER TO kasashka;

--
-- Name: ref_dish_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.ref_dish_categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ref_dish_categories_id_seq OWNER TO kasashka;

--
-- Name: ref_dish_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.ref_dish_categories_id_seq OWNED BY public.ref_dish_categories.id;


--
-- Name: restaurant_cuisines; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.restaurant_cuisines (
    restaurant_id bigint NOT NULL,
    cuisine_id integer NOT NULL
);


ALTER TABLE public.restaurant_cuisines OWNER TO kasashka;

--
-- Name: restaurants; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.restaurants OWNER TO kasashka;

--
-- Name: restaurants_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.restaurants_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.restaurants_id_seq OWNER TO kasashka;

--
-- Name: restaurants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.restaurants_id_seq OWNED BY public.restaurants.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.reviews OWNER TO kasashka;

--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.reviews_id_seq OWNER TO kasashka;

--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: sms_login_codes; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.sms_login_codes OWNER TO kasashka;

--
-- Name: sms_login_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.sms_login_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sms_login_codes_id_seq OWNER TO kasashka;

--
-- Name: sms_login_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.sms_login_codes_id_seq OWNED BY public.sms_login_codes.id;


--
-- Name: user_addresses; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.user_addresses OWNER TO kasashka;

--
-- Name: user_addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.user_addresses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_addresses_id_seq OWNER TO kasashka;

--
-- Name: user_addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.user_addresses_id_seq OWNED BY public.user_addresses.id;


--
-- Name: user_devices; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.user_devices OWNER TO kasashka;

--
-- Name: user_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.user_devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.user_devices_id_seq OWNER TO kasashka;

--
-- Name: user_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.user_devices_id_seq OWNED BY public.user_devices.id;


--
-- Name: user_favorite_cuisines; Type: TABLE; Schema: public; Owner: kasashka
--

CREATE TABLE public.user_favorite_cuisines (
    user_id bigint NOT NULL,
    cuisine_id integer NOT NULL
);


ALTER TABLE public.user_favorite_cuisines OWNER TO kasashka;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.user_profiles OWNER TO kasashka;

--
-- Name: users; Type: TABLE; Schema: public; Owner: kasashka
--

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


ALTER TABLE public.users OWNER TO kasashka;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: kasashka
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO kasashka;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: kasashka
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: carts id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.carts ALTER COLUMN id SET DEFAULT nextval('public.carts_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: cuisines id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.cuisines ALTER COLUMN id SET DEFAULT nextval('public.cuisines_id_seq'::regclass);


--
-- Name: delivery_locations id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.delivery_locations ALTER COLUMN id SET DEFAULT nextval('public.delivery_locations_id_seq'::regclass);


--
-- Name: delivery_tasks id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.delivery_tasks ALTER COLUMN id SET DEFAULT nextval('public.delivery_tasks_id_seq'::regclass);


--
-- Name: menu_categories id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_categories ALTER COLUMN id SET DEFAULT nextval('public.menu_categories_id_seq'::regclass);


--
-- Name: menu_item_option_values id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_option_values ALTER COLUMN id SET DEFAULT nextval('public.menu_item_option_values_id_seq'::regclass);


--
-- Name: menu_item_options id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_options ALTER COLUMN id SET DEFAULT nextval('public.menu_item_options_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: order_status_history id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: payment_transactions id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.payment_transactions ALTER COLUMN id SET DEFAULT nextval('public.payment_transactions_id_seq'::regclass);


--
-- Name: product_categories id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.product_categories ALTER COLUMN id SET DEFAULT nextval('public.product_categories_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);


--
-- Name: ref_dish_categories id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.ref_dish_categories ALTER COLUMN id SET DEFAULT nextval('public.ref_dish_categories_id_seq'::regclass);


--
-- Name: restaurants id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.restaurants ALTER COLUMN id SET DEFAULT nextval('public.restaurants_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: sms_login_codes id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.sms_login_codes ALTER COLUMN id SET DEFAULT nextval('public.sms_login_codes_id_seq'::regclass);


--
-- Name: user_addresses id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_addresses ALTER COLUMN id SET DEFAULT nextval('public.user_addresses_id_seq'::regclass);


--
-- Name: user_devices id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_devices ALTER COLUMN id SET DEFAULT nextval('public.user_devices_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.cart_items (id, cart_id, menu_item_id, quantity, item_name, unit_price, options, comment) FROM stdin;
\.


--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.carts (id, user_id, restaurant_id, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: conversation_participants; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.conversation_participants (conversation_id, user_id, role) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.conversations (id, order_id, type, created_at) FROM stdin;
\.


--
-- Data for Name: cuisines; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.cuisines (id, code, name) FROM stdin;
\.


--
-- Data for Name: delivery_locations; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.delivery_locations (id, delivery_task_id, latitude, longitude, recorded_at) FROM stdin;
\.


--
-- Data for Name: delivery_tasks; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.delivery_tasks (id, order_id, courier_id, status, pickup_eta, delivery_eta, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: menu_categories; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.menu_categories (id, restaurant_id, name, sort_order, global_category_id) FROM stdin;
\.


--
-- Data for Name: menu_item_option_links; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.menu_item_option_links (menu_item_id, option_id) FROM stdin;
\.


--
-- Data for Name: menu_item_option_values; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.menu_item_option_values (id, option_id, name, price_delta, sort_order) FROM stdin;
\.


--
-- Data for Name: menu_item_options; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.menu_item_options (id, restaurant_id, name, is_required, min_selected, max_selected, type) FROM stdin;
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.menu_items (id, restaurant_id, category_id, name, description, price, currency, is_active, is_available, image_url, weight_grams, calories, proteins, fats, carbs, tags, created_at, updated_at, product_id, listing_mode, old_price, ref_category_id, is_brand_anonymous, base_price, discount_percent, discount_fixed, composition) FROM stdin;
7	3	\N	Пицца мясная	\N	300.00	RUB	t	t	\N	\N	\N	\N	\N	\N	{}	2025-12-02 07:03:01.045038+00	2025-12-02 07:03:01.045038+00	\N	0	\N	75	f	\N	50.00	\N	1111111
5	3	\N	Пицца веган	\N	400.00	RUB	f	t	\N	\N	\N	\N	\N	\N	{}	2025-12-02 06:58:41.467629+00	2025-12-02 06:58:41.467629+00	\N	0	\N	76	t	\N	50.00	\N	123123
8	3	\N	Кофе	\N	300.00	RUB	t	t	https://www.google.com/url?sa=i&url=https%3A%2F%2Fwww.torrefacto.ru%2Fblog%2Flatte-coffee-recipes%2F&psig=AOvVaw0I3h12i-6WBdEPH5CDq9lF&ust=1765202028571000&source=images&cd=vfe&opi=89978449&ved=0CBEQjRxqFwoTCNjZ9ZHQq5EDFQAAAAAdAAAAABAE	\N	\N	\N	\N	\N	{}	2025-12-07 13:54:43.466471+00	2025-12-07 13:54:43.466471+00	\N	0	\N	127	f	\N	50.00	\N	Банановый раф
9	3	\N	Багет	\N	300.00	RUB	t	t	\N	\N	\N	\N	\N	\N	{}	2025-12-07 13:59:35.336439+00	2025-12-07 13:59:35.336439+00	\N	0	\N	17	t	\N	79.00	\N	\N
6	3	\N	Пицца веган 2	\N	700.00	RUB	t	t	\N	\N	\N	\N	\N	\N	{}	2025-12-02 07:01:48.411693+00	2025-12-02 07:01:48.411693+00	\N	0	\N	76	t	\N	80.00	\N	11111
4	3	\N	Пицца	\N	600.00	RUB	t	t	https://avatars.mds.yandex.net/get-vertis-journal/3934100/52e2da20-4226-46c6-8bcb-bf48560f7288.jpeg/1600x1600	\N	\N	\N	\N	\N	{}	2025-12-01 14:24:33.88301+00	2025-12-01 14:24:33.88301+00	\N	0	\N	79	f	\N	50.00	\N	Пицца пепперони.\nСостав: Колбаса Салями, сыр, томатная паста, тесто\n800г.
2	3	\N	булочка	\N	70.00	RUB	t	t	https://www.russianfood.com/dycontent/images_upl/634/big_633220.jpg	\N	\N	\N	\N	\N	{}	2025-11-28 08:56:46.112315+00	2025-11-28 08:56:46.112315+00	\N	0	\N	17	f	\N	50.00	\N	21
10	3	\N	Тост с авокадо и микрозеленью	\N	320.00	RUB	t	t	\N	\N	\N	\N	\N	\N	{}	2025-12-11 09:00:00+00	2025-12-11 09:00:00+00	\N	0	\N	144	f	\N	\N	\N	Хрустящий тост с кремом из авокадо и микрозеленью.
11	3	\N	Тост с лососем и крем-чиз	\N	450.00	RUB	t	t	https://images.unsplash.com/photo-1540189549336-e6e99c3679fe	\N	\N	\N	\N	\N	{}	2025-12-11 09:01:00+00	2025-12-11 09:01:00+00	\N	0	\N	145	f	\N	15.00	\N	Подкопчённый лосось, крем-чиз и огурец на зерновом хлебе.
12	3	\N	Острый вок с креветкой	\N	520.00	RUB	t	t	https://images.unsplash.com/photo-1559057194-95f0d7b7d7c7	\N	\N	\N	\N	\N	{}	2025-12-11 09:02:00+00	2025-12-11 09:02:00+00	\N	0	\N	148	f	\N	12.00	\N	Пшеничная лапша, креветки, острый соус чили и овощи.
13	3	\N	Терияки боул с курицей	\N	480.00	RUB	t	t	https://images.unsplash.com/photo-1529006557810-274b9b2fc783	\N	\N	\N	\N	\N	{}	2025-12-11 09:03:00+00	2025-12-11 09:03:00+00	\N	0	\N	151	f	\N	8.00	\N	Тёплый рис, курица терияки, эдамаме и кунжут.
14	3	\N	Фисташковый мусс	\N	260.00	RUB	t	t	\N	\N	\N	\N	\N	\N	{}	2025-12-11 09:04:00+00	2025-12-11 09:04:00+00	\N	0	\N	154	f	\N	\N	\N	Воздушный мусс с фисташковой пастой и белым шоколадом.
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.messages (id, conversation_id, sender_id, body, payload, message_type, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.notifications (id, user_id, type, title, body, data, channel, status, error_message, created_at, sent_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.order_items (id, order_id, menu_item_id, item_name, unit_price, quantity, options, comment) FROM stdin;
\.


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.order_status_history (id, order_id, status, changed_by, comment, created_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.orders (id, user_id, restaurant_id, courier_id, address_id, total_amount, delivery_fee, discount_amount, final_amount, currency, status, payment_status, payment_method, customer_comment, restaurant_comment, cancelled_reason, estimated_at, delivered_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: payment_transactions; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.payment_transactions (id, order_id, provider, provider_tx_id, amount, currency, status, raw_payload, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: product_categories; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.product_categories (id, parent_id, name, slug, sort_order, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.products (id, category_id, name, description, default_image_url, unit_name, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ref_dish_categories; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.ref_dish_categories (id, parent_id, level, code, name, description, is_active, sort_order, created_at, updated_at) FROM stdin;
1	\N	1	bakery	Выпечка и хлеб	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
2	\N	1	breakfasts	Завтраки	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
3	\N	1	snacks	Закуски и снеки	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
4	\N	1	salads_bowls	Салаты и боулы	\N	t	40	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
5	\N	1	soups	Супы	\N	t	50	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
6	\N	1	pizza	Пицца и открытая выпечка	\N	t	60	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
7	\N	1	burgers_streetfood	Бургеры, сэндвичи и стрит-фуд	\N	t	70	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
8	\N	1	hot_dishes	Горячие блюда	\N	t	80	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
9	\N	1	pasta_noodles	Паста, лапша и рис	\N	t	90	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
10	\N	1	desserts	Десерты и сладкая выпечка	\N	t	100	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
11	\N	1	drinks	Напитки	\N	t	110	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
12	\N	1	combos	Комбо и сеты	\N	t	120	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
13	1	2	bakery.breads	Хлеб и багеты	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
14	1	2	bakery.buns	Булочки и сдоба	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
15	1	2	bakery.pies	Пироги и пирожки	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
16	13	3	bakery.breads.form	Формовой хлеб	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
17	13	3	bakery.breads.baguette	Багеты и чиабатта	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
18	13	3	bakery.breads.flat	Лепёшки и лаваши	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
19	14	3	bakery.buns.classic	Классические булочки	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
20	14	3	bakery.buns.filled	Булочки с начинкой	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
21	14	3	bakery.buns.cinnamon	Синнамон-роллы и улитки	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
22	15	3	bakery.pies.big	Большие пироги	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
23	15	3	bakery.pies.baked	Печёные пирожки	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
24	15	3	bakery.pies.fried	Жареные пирожки и беляши	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
25	2	2	breakfasts.eggs	Яичницы и омлеты	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
26	2	2	breakfasts.porridge	Каши и боулы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
27	2	2	breakfasts.bakery_sets	Завтраки с выпечкой	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
28	25	3	breakfasts.eggs.scramble	Скрамбл	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
29	25	3	breakfasts.eggs.omelette	Омлеты	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
30	25	3	breakfasts.eggs.poached	Яйца пашот	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
31	26	3	breakfasts.porridge.milk	Каши на молоке / воде	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
32	26	3	breakfasts.porridge.grain	Зерновые боулы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
33	26	3	breakfasts.porridge.fruit	Фруктовые боулы	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
34	27	3	breakfasts.bakery_sets.toasts	Тосты и сэндвич-тосты	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
35	27	3	breakfasts.bakery_sets.pancakes	Блины и панкейки	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
36	27	3	breakfasts.bakery_sets.croissant	Круассан-завтраки	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
37	3	2	snacks.cold	Холодные закуски	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
38	3	2	snacks.hot	Горячие закуски	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
39	3	2	snacks.coffee	Снеки к кофе	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
40	37	3	snacks.cold.bruschetta	Брускетты и тартинки	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
41	37	3	snacks.cold.meat_cheese	Сырные и мясные тарелки	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
42	37	3	snacks.cold.veggie	Овощные закуски	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
43	38	3	snacks.hot.nuggets	Наггетсы и стрипсы	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
44	38	3	snacks.hot.cheese	Сырные закуски	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
45	38	3	snacks.hot.potato	Картофель фри и др.	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
46	39	3	snacks.coffee.mini_pastry	Мини-выпечка	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
47	39	3	snacks.coffee.nuts	Орехи и сухофрукты	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
48	39	3	snacks.coffee.chips	Чипсы и снэки	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
49	4	2	salads.classic	Классические салаты	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
50	4	2	salads.bowls	Боулы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
51	4	2	salads.warm	Тёплые салаты	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
52	49	3	salads.classic.olivier	Оливье / столичные	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
53	49	3	salads.classic.caesar	Цезарь	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
54	49	3	salads.classic.greeks	Греческий и овощные	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
55	50	3	salads.bowls.poke	Поке	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
56	50	3	salads.bowls.grain	Зерновые боулы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
57	50	3	salads.bowls.warm	Тёплые боулы	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
58	51	3	salads.warm.meat	Тёплые салаты с мясом	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
59	51	3	salads.warm.seafood	Тёплые салаты с морепродуктами	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
60	51	3	salads.warm.veggie	Тёплые овощные салаты	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
61	5	2	soups.classic	Классические супы	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
62	5	2	soups.cream	Крем-супы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
63	5	2	soups.asian	Азиатские супы	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
64	61	3	soups.classic.broth	Бульоны	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
65	61	3	soups.classic.traditional	Борщ, щи, солянка	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
66	61	3	soups.classic.other	Другие супы	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
67	62	3	soups.cream.veggie	Овощные крем-супы	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
68	62	3	soups.cream.cheese	Сырные крем-супы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
69	63	3	soups.asian.noodle	Лапшичные супы	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
70	63	3	soups.asian.spicy	Острые супы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
71	6	2	pizza.classic	Классическая пицца	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
72	6	2	pizza.special	Авторская пицца	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
73	6	2	pizza.mini	Мини-форматы	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
74	71	3	pizza.classic.standard	Маргарита, ветчина-грибы и др.	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
75	71	3	pizza.classic.meat	Мясные пиццы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
76	71	3	pizza.classic.veggie	Овощные пиццы	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
77	72	3	pizza.special.seafood	С морепродуктами	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
78	72	3	pizza.special.truffle	С трюфелем и премиум начинками	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
79	73	3	pizza.mini.slice	Пицца-слайсы	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
80	73	3	pizza.mini.mini	Мини-пиццы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
81	7	2	burgers.classic	Бургеры	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
82	7	2	burgers.sandwiches	Сэндвичи и панини	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
83	7	2	burgers.street	Стрит-фуд	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
84	81	3	burgers.classic.beef	Бургеры с говядиной	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
85	81	3	burgers.classic.chicken	Чикен-бургеры	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
86	81	3	burgers.classic.veggie	Вегетарианские бургеры	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
87	82	3	burgers.sandwiches.cold	Холодные сэндвичи	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
88	82	3	burgers.sandwiches.hot	Горячие сэндвичи, панини	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
89	83	3	burgers.street.shawarma	Шаурма, гирос	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
90	83	3	burgers.street.hotdog	Хот-доги	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
91	83	3	burgers.street.other	Прочий стрит-фуд	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
92	8	2	hot.meat	Мясо и птица	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
93	8	2	hot.fish	Рыба и морепродукты	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
94	8	2	hot.side	Гарниры	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
95	92	3	hot.meat.steaks	Стейки и медальоны	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
96	92	3	hot.meat.cutlets	Котлеты и тефтели	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
97	92	3	hot.meat.chicken	Блюда из курицы	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
98	93	3	hot.fish.steaks	Рыбные стейки и филе	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
99	93	3	hot.fish.seafood	Блюда из морепродуктов	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
100	94	3	hot.side.potato	Картофельные гарниры	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
101	94	3	hot.side.grain	Крупы и рис	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
102	94	3	hot.side.veggies	Овощные гарниры	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
103	9	2	pasta.italian	Европейская паста	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
104	9	2	pasta.asian	Азиатская лапша	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
105	9	2	pasta.rice	Рисовые блюда	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
106	103	3	pasta.italian.classic	Классическая паста	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
107	103	3	pasta.italian.cream	Паста в сливочных соусах	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
108	103	3	pasta.italian.other	Прочие пасты	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
109	104	3	pasta.asian.udon	Удон	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
110	104	3	pasta.asian.soba	Соба	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
111	104	3	pasta.asian.wok	Лапша вок	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
112	105	3	pasta.rice.risotto	Ризотто	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
113	105	3	pasta.rice.wok	Рис в воке и пловы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
114	10	2	desserts.cakes	Торты и пирожные	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
115	10	2	desserts.glass	Десерты в стаканчиках	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
116	10	2	desserts.icecream	Мороженое и сорбеты	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
117	114	3	desserts.cakes.slice	Порционные кусочки торта	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
118	114	3	desserts.cakes.whole	Целые торты	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
119	115	3	desserts.glass.layered	Слоистые десерты / трайфлы	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
120	115	3	desserts.glass.creamy	Кремовые десерты	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
121	116	3	desserts.icecream.scoops	Шары мороженого	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
122	116	3	desserts.icecream.sorbets	Сорбеты и щербеты	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
123	11	2	drinks.coffee	Кофе и кофейные напитки	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
124	11	2	drinks.tea_hot	Чай и горячие напитки	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
125	11	2	drinks.cold	Холодные напитки	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
126	123	3	drinks.coffee.espresso	Эспрессо и чёрный кофе	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
127	123	3	drinks.coffee.milk	Кофе с молоком	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
128	123	3	drinks.coffee.special	Авторские кофейные напитки	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
129	124	3	drinks.tea_hot.standard	Чёрный / зелёный чай	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
130	124	3	drinks.tea_hot.herbal	Травяные и фруктовые чаи	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
131	124	3	drinks.tea_hot.other	Прочие горячие напитки	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
132	125	3	drinks.cold.lemonades	Лимонады и морсы	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
133	125	3	drinks.cold.juices	Соки и смузи	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
134	125	3	drinks.cold.bottled	Готовые напитки в бутылках	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
135	12	2	combos.lunch	Бизнес-ланчи	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
136	12	2	combos.sets	Сеты и наборы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
137	12	2	combos.kids	Детское меню	\N	t	30	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
138	135	3	combos.lunch.standard	Стандартные ланчи	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
139	136	3	combos.sets.party	Сеты для компании	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
140	136	3	combos.sets.family	Семейные наборы	\N	t	20	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
141	137	3	combos.kids.menu	Детское меню	\N	t	10	2025-11-28 07:23:04.542861+00	2025-11-28 07:23:04.542861+00
142	\N	1	brunch_tapas	Бранчи и тапас	\N	t	130	2025-12-11 09:00:00+00	2025-12-11 09:00:00+00
143	142	2	brunch.tostadas	Тосты и тостады	\N	t	10	2025-12-11 09:00:00+00	2025-12-11 09:00:00+00
144	143	3	brunch.tostadas.avocado	Тосты с авокадо	\N	t	10	2025-12-11 09:00:00+00	2025-12-11 09:00:00+00
145	143	3	brunch.tostadas.salmon	Тосты с лососем	\N	t	20	2025-12-11 09:00:00+00	2025-12-11 09:00:00+00
146	\N	1	asian_wok_fusion	Азиатский фьюжн	\N	t	140	2025-12-11 09:02:00+00	2025-12-11 09:02:00+00
147	146	2	asian.wok.noodles	Воки и лапша	\N	t	10	2025-12-11 09:02:00+00	2025-12-11 09:02:00+00
148	147	3	asian.wok.spicy	Острые воки	\N	t	10	2025-12-11 09:02:00+00	2025-12-11 09:02:00+00
149	\N	1	bowls_protein	Протеиновые боулы	\N	t	150	2025-12-11 09:03:00+00	2025-12-11 09:03:00+00
150	149	2	bowls.protein.chicken	Боулы с курицей	\N	t	10	2025-12-11 09:03:00+00	2025-12-11 09:03:00+00
151	150	3	bowls.protein.teriyaki	Боул терияки	\N	t	10	2025-12-11 09:03:00+00	2025-12-11 09:03:00+00
152	\N	1	desserts.modern	Современные десерты	\N	t	160	2025-12-11 09:04:00+00	2025-12-11 09:04:00+00
153	152	2	desserts.modern.mousse	Муссовые десерты	\N	t	10	2025-12-11 09:04:00+00	2025-12-11 09:04:00+00
154	153	3	desserts.modern.pistachio	Фисташковые муссы	\N	t	10	2025-12-11 09:04:00+00	2025-12-11 09:04:00+00
\.


--
-- Data for Name: restaurant_cuisines; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.restaurant_cuisines (restaurant_id, cuisine_id) FROM stdin;
\.


--
-- Data for Name: restaurants; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.restaurants (id, owner_user_id, name, description, address_line, city, latitude, longitude, min_order_amount, delivery_fee, is_active, status, rating_avg, rating_count, settings, created_at, updated_at, business_access_code) FROM stdin;
3	2	Рестик 1	Ресторан с выпечкой	\N	\N	\N	\N	0.00	0.00	t	pending	0.00	0	\N	2025-11-28 08:39:23.327122+00	2025-11-28 08:39:23.327122+00	123
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.reviews (id, order_id, user_id, restaurant_id, rating, comment, created_at) FROM stdin;
\.


--
-- Data for Name: sms_login_codes; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.sms_login_codes (id, phone, code, purpose, is_used, attempts, expires_at, created_at) FROM stdin;
\.


--
-- Data for Name: user_addresses; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.user_addresses (id, user_id, label, address_line, city, latitude, longitude, is_default, created_at, comment) FROM stdin;
\.


--
-- Data for Name: user_devices; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.user_devices (id, user_id, device_type, push_token, user_agent, last_seen_at, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: user_favorite_cuisines; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.user_favorite_cuisines (user_id, cuisine_id) FROM stdin;
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.user_profiles (user_id, full_name, avatar_url, birthday, gender, preferences, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: kasashka
--

COPY public.users (id, email, phone, password_hash, role, is_active, created_at, updated_at, phone_verified, phone_verified_at) FROM stdin;
2	\N	79161525095	\N	admin	t	2025-11-28 08:39:16.669769+00	2025-11-28 08:39:16.669769+00	f	\N
\.


--
-- Name: cart_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.cart_items_id_seq', 1, false);


--
-- Name: carts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.carts_id_seq', 1, false);


--
-- Name: conversations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.conversations_id_seq', 1, false);


--
-- Name: cuisines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.cuisines_id_seq', 1, false);


--
-- Name: delivery_locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.delivery_locations_id_seq', 1, false);


--
-- Name: delivery_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.delivery_tasks_id_seq', 1, false);


--
-- Name: menu_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.menu_categories_id_seq', 1, false);


--
-- Name: menu_item_option_values_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.menu_item_option_values_id_seq', 1, false);


--
-- Name: menu_item_options_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.menu_item_options_id_seq', 1, false);


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 14, true);


--
-- Name: messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.messages_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.order_items_id_seq', 1, false);


--
-- Name: order_status_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.order_status_history_id_seq', 1, false);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: payment_transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.payment_transactions_id_seq', 1, false);


--
-- Name: product_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.product_categories_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.products_id_seq', 1, false);


--
-- Name: ref_dish_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.ref_dish_categories_id_seq', 154, true);


--
-- Name: restaurants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.restaurants_id_seq', 3, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.reviews_id_seq', 1, false);


--
-- Name: sms_login_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.sms_login_codes_id_seq', 1, false);


--
-- Name: user_addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.user_addresses_id_seq', 1, false);


--
-- Name: user_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.user_devices_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: kasashka
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: cuisines cuisines_code_key; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.cuisines
    ADD CONSTRAINT cuisines_code_key UNIQUE (code);


--
-- Name: cuisines cuisines_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.cuisines
    ADD CONSTRAINT cuisines_pkey PRIMARY KEY (id);


--
-- Name: delivery_locations delivery_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.delivery_locations
    ADD CONSTRAINT delivery_locations_pkey PRIMARY KEY (id);


--
-- Name: delivery_tasks delivery_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.delivery_tasks
    ADD CONSTRAINT delivery_tasks_pkey PRIMARY KEY (id);


--
-- Name: menu_categories menu_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_item_option_links menu_item_option_links_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_option_links
    ADD CONSTRAINT menu_item_option_links_pkey PRIMARY KEY (menu_item_id, option_id);


--
-- Name: menu_item_option_values menu_item_option_values_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_option_values
    ADD CONSTRAINT menu_item_option_values_pkey PRIMARY KEY (id);


--
-- Name: menu_item_options menu_item_options_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_options
    ADD CONSTRAINT menu_item_options_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: product_categories product_categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_slug_key UNIQUE (slug);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: ref_dish_categories ref_dish_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.ref_dish_categories
    ADD CONSTRAINT ref_dish_categories_code_key UNIQUE (code);


--
-- Name: ref_dish_categories ref_dish_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.ref_dish_categories
    ADD CONSTRAINT ref_dish_categories_pkey PRIMARY KEY (id);


--
-- Name: restaurant_cuisines restaurant_cuisines_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.restaurant_cuisines
    ADD CONSTRAINT restaurant_cuisines_pkey PRIMARY KEY (restaurant_id, cuisine_id);


--
-- Name: restaurants restaurants_business_access_code_key; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_business_access_code_key UNIQUE (business_access_code);


--
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: sms_login_codes sms_login_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.sms_login_codes
    ADD CONSTRAINT sms_login_codes_pkey PRIMARY KEY (id);


--
-- Name: user_addresses user_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (id);


--
-- Name: user_devices user_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_pkey PRIMARY KEY (id);


--
-- Name: user_favorite_cuisines user_favorite_cuisines_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_favorite_cuisines
    ADD CONSTRAINT user_favorite_cuisines_pkey PRIMARY KEY (user_id, cuisine_id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_cart_items_cart; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_cart_items_cart ON public.cart_items USING btree (cart_id);


--
-- Name: idx_cart_items_cart_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_cart_items_cart_id ON public.cart_items USING btree (cart_id);


--
-- Name: idx_carts_user; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_carts_user ON public.carts USING btree (user_id);


--
-- Name: idx_delivery_locations_task_time; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_delivery_locations_task_time ON public.delivery_locations USING btree (delivery_task_id, recorded_at);


--
-- Name: idx_delivery_tasks_courier_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_delivery_tasks_courier_id ON public.delivery_tasks USING btree (courier_id);


--
-- Name: idx_menu_categories_global_category; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_menu_categories_global_category ON public.menu_categories USING btree (global_category_id);


--
-- Name: idx_menu_items_product; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_menu_items_product ON public.menu_items USING btree (product_id);


--
-- Name: idx_menu_items_product_mode_available; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_menu_items_product_mode_available ON public.menu_items USING btree (product_id, listing_mode, is_available);


--
-- Name: idx_menu_items_product_restaurant; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_menu_items_product_restaurant ON public.menu_items USING btree (restaurant_id, product_id);


--
-- Name: idx_menu_items_restaurant_active; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_menu_items_restaurant_active ON public.menu_items USING btree (restaurant_id, is_active, is_available);


--
-- Name: idx_menu_items_restaurant_available; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_menu_items_restaurant_available ON public.menu_items USING btree (restaurant_id, is_available);


--
-- Name: idx_messages_conversation_time; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_messages_conversation_time ON public.messages USING btree (conversation_id, created_at);


--
-- Name: idx_notifications_user_status; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_notifications_user_status ON public.notifications USING btree (user_id, status);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_status_history_order_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id, created_at);


--
-- Name: idx_orders_courier_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_orders_courier_id ON public.orders USING btree (courier_id);


--
-- Name: idx_orders_restaurant_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_orders_restaurant_id ON public.orders USING btree (restaurant_id);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_orders_user_created; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_orders_user_created ON public.orders USING btree (user_id, created_at DESC);


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_orders_user_id ON public.orders USING btree (user_id);


--
-- Name: idx_payment_transactions_order_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_payment_transactions_order_id ON public.payment_transactions USING btree (order_id);


--
-- Name: idx_product_categories_parent; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_product_categories_parent ON public.product_categories USING btree (parent_id);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_products_category_active; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_products_category_active ON public.products USING btree (category_id, is_active);


--
-- Name: idx_ref_dish_categories_level; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_ref_dish_categories_level ON public.ref_dish_categories USING btree (level);


--
-- Name: idx_ref_dish_categories_parent; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_ref_dish_categories_parent ON public.ref_dish_categories USING btree (parent_id);


--
-- Name: idx_restaurant_cuisines_cuisine; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_restaurant_cuisines_cuisine ON public.restaurant_cuisines USING btree (cuisine_id);


--
-- Name: idx_restaurants_city; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_restaurants_city ON public.restaurants USING btree (city);


--
-- Name: idx_reviews_restaurant_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_reviews_restaurant_id ON public.reviews USING btree (restaurant_id);


--
-- Name: idx_sms_login_codes_expires; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_sms_login_codes_expires ON public.sms_login_codes USING btree (expires_at);


--
-- Name: idx_sms_login_codes_phone; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_sms_login_codes_phone ON public.sms_login_codes USING btree (phone);


--
-- Name: idx_user_addresses_user_default; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_user_addresses_user_default ON public.user_addresses USING btree (user_id, is_default);


--
-- Name: idx_user_addresses_user_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_user_addresses_user_id ON public.user_addresses USING btree (user_id);


--
-- Name: idx_user_devices_user_id; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_user_devices_user_id ON public.user_devices USING btree (user_id);


--
-- Name: idx_user_favorite_cuisines_user; Type: INDEX; Schema: public; Owner: kasashka
--

CREATE INDEX idx_user_favorite_cuisines_user ON public.user_favorite_cuisines USING btree (user_id);


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: carts carts_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: delivery_locations delivery_locations_delivery_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.delivery_locations
    ADD CONSTRAINT delivery_locations_delivery_task_id_fkey FOREIGN KEY (delivery_task_id) REFERENCES public.delivery_tasks(id) ON DELETE CASCADE;


--
-- Name: delivery_tasks delivery_tasks_courier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.delivery_tasks
    ADD CONSTRAINT delivery_tasks_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.users(id);


--
-- Name: delivery_tasks delivery_tasks_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.delivery_tasks
    ADD CONSTRAINT delivery_tasks_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: restaurant_cuisines fk_restaurant_cuisines_restaurant; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.restaurant_cuisines
    ADD CONSTRAINT fk_restaurant_cuisines_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: menu_categories menu_categories_global_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_global_category_id_fkey FOREIGN KEY (global_category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;


--
-- Name: menu_categories menu_categories_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_categories
    ADD CONSTRAINT menu_categories_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: menu_item_option_links menu_item_option_links_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_option_links
    ADD CONSTRAINT menu_item_option_links_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_option_links menu_item_option_links_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_option_links
    ADD CONSTRAINT menu_item_option_links_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.menu_item_options(id) ON DELETE CASCADE;


--
-- Name: menu_item_option_values menu_item_option_values_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_option_values
    ADD CONSTRAINT menu_item_option_values_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.menu_item_options(id) ON DELETE CASCADE;


--
-- Name: menu_item_options menu_item_options_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_item_options
    ADD CONSTRAINT menu_item_options_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: menu_items menu_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.menu_categories(id) ON DELETE SET NULL;


--
-- Name: menu_items menu_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: menu_items menu_items_ref_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_ref_category_id_fkey FOREIGN KEY (ref_category_id) REFERENCES public.ref_dish_categories(id) ON DELETE RESTRICT;


--
-- Name: menu_items menu_items_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_menu_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id);


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_status_history order_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.user_addresses(id);


--
-- Name: orders orders_courier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_courier_id_fkey FOREIGN KEY (courier_id) REFERENCES public.users(id);


--
-- Name: orders orders_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: payment_transactions payment_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: product_categories product_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE RESTRICT;


--
-- Name: ref_dish_categories ref_dish_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.ref_dish_categories
    ADD CONSTRAINT ref_dish_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.ref_dish_categories(id) ON DELETE RESTRICT;


--
-- Name: restaurant_cuisines restaurant_cuisines_cuisine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.restaurant_cuisines
    ADD CONSTRAINT restaurant_cuisines_cuisine_id_fkey FOREIGN KEY (cuisine_id) REFERENCES public.cuisines(id) ON DELETE CASCADE;


--
-- Name: restaurants restaurants_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id);


--
-- Name: reviews reviews_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_restaurant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_addresses user_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_addresses
    ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_devices user_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_devices
    ADD CONSTRAINT user_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_favorite_cuisines user_favorite_cuisines_cuisine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_favorite_cuisines
    ADD CONSTRAINT user_favorite_cuisines_cuisine_id_fkey FOREIGN KEY (cuisine_id) REFERENCES public.cuisines(id) ON DELETE CASCADE;


--
-- Name: user_favorite_cuisines user_favorite_cuisines_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_favorite_cuisines
    ADD CONSTRAINT user_favorite_cuisines_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: kasashka
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict rlyrL0LFggyCTTc5CySfYAObhfwX5FxXXQ1mtVltFpTZplBQzt5rpeY0Hgci1tW

