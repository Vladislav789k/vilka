# Quick Setup Guide

## Running Locally (Development)

### Prerequisites
- Docker and Docker Compose installed
- Node.js 20+ installed

### Steps

1. **Start Postgres and Redis with Docker:**
   ```bash
   docker compose up postgres redis -d
   ```
   This starts only the database services (not the app container).

2. **Create `.env.local` file** (already created for you):
   ```
   DATABASE_URL=postgresql://kasashka:kasashka_password@localhost:5432/kasashka_db
   REDIS_URL=redis://localhost:6379
   NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the Next.js app locally:**
   ```bash
   npm run dev
   ```

5. **Access the app:**
   - App: http://localhost:3000
   - Postgres: localhost:5432
   - Redis: localhost:6379

## Running Everything in Docker

If you want to run the entire stack in Docker:

```bash
docker compose up --build
```

This will:
- Start Postgres (auto-initializes with `db/init/01_init.sql`)
- Start Redis
- Start the Next.js app container
- Start Nginx reverse proxy
- Start Ollama (LLM inference, optional)

### Cart realtime sync (WebSocket)

In Docker we start a small WebSocket server (`ws-server.js`) inside the `app` container.
Nginx proxies it at `ws://<host>/ws/cart`.

The cart is still persisted to Redis via `/api/cart/validate`, but other tabs/devices receive updates instantly via WebSocket (no polling).

Access:
- App: http://localhost (via Nginx) or http://localhost:3000 (direct)
- Postgres: localhost:5432
- Redis: localhost:6379
- Ollama API: http://localhost:11434

## AI ассистент (LLaMA 3.x)

См. `README.ai.md`.

## Troubleshooting

### Error: `getaddrinfo ENOTFOUND postgres`

**Problem:** App is running locally but trying to connect to `postgres` hostname (Docker service name).

**Solution:**
1. Make sure `.env.local` exists with `DATABASE_URL` using `localhost` (not `postgres`)
2. Restart the Next.js dev server after creating/updating `.env.local`
3. Ensure Postgres is running: `docker compose ps postgres`

### Error: Connection refused

**Problem:** Postgres is not running.

**Solution:**
```bash
docker compose up postgres -d
```

### Database not initialized

**Problem:** Postgres is running but tables don't exist.

**Solution:**
1. Reset the database:
   ```bash
   docker compose down postgres -v
   docker compose up postgres -d
   ```
2. Or manually run the init script:
   ```bash
   docker compose exec postgres psql -U kasashka -d kasashka_db -f /docker-entrypoint-initdb.d/01_init.sql

> Важно: init-скрипты из `db/init/` выполняются **только при первом старте** Postgres (когда volume пустой).
> Если вы обновили `db/init/01_init.sql` и хотите применить изменения/новые демо-данные — удалите volume:
> `docker compose down -v` (это удалит данные Postgres на машине).
   ```

## Environment Variables

### Local Development (`.env.local`)
- `DATABASE_URL`: Use `localhost` as hostname
- `REDIS_URL`: Use `localhost` as hostname

#### Yandex Delivery (express API)
Для расчёта и создания заявки через Яндекс Доставку используются серверные эндпоинты:
- `POST /api/delivery/yandex/quote` — расчёт стоимости (только `courier` + `thermobag`)
- `POST /api/delivery/yandex/claim` — создание заявки (только `courier` + `thermobag`)
- `POST /api/delivery/yandex/info` — информация по заявке (polling статуса)
- `POST /api/delivery/yandex/accept` — подтверждение заявки (после оценки)

Нужно добавить в `.env.local`:
```
YANDEX_DELIVERY_TOKEN="Bearer token without 'Bearer' prefix"
```

Важно:
- В БД у ресторана должны быть заданы `latitude/longitude` (таблица `restaurants`), иначе расчёт/создание заявки вернёт ошибку.
- Адрес доставки берётся из `user_addresses` по `addressId` и должен принадлежать авторизованному пользователю.
- Контакт отправителя (точка `source`) берётся из БД:
  - имя: `restaurants.settings.contact_name` → `user_profiles.full_name` → `restaurants.name`
  - телефон: `restaurants.settings.contact_phone` → `users.phone` (владелец ресторана)
  - email: `restaurants.settings.contact_email` → `users.email`

### Docker (in `docker-compose.yml`)
- `DATABASE_URL`: Use `postgres` as hostname (Docker service name)
- `REDIS_URL`: Use `redis` as hostname (Docker service name)

