# AI ассистент (LLaMA 3.x Instruct + Postgres/Redis read-only)

## Что сделано

- Контейнер `ollama` для запуска LLaMA 3.x Instruct
- API: `POST /api/ai/chat` — **чат‑бот для обычных пользователей**. Модель может читать данные **только текущего пользователя** через безопасные tools.
- UI: чат‑бот встроен в главную страницу (кнопка **«Чат‑бот»**) и также доступен на `/debug/ai` для тестов.

## Запуск

### 1) Поднять Ollama

```bash
docker compose up -d ollama
```

### 2) Скачать модель (нужен интернет)

Укажите модель в `.env`/`.env.local` (пример):

```env
OLLAMA_MODEL=llama3.2:3b
```

Затем:

```bash
docker compose up -d ollama_init
```

Или вручную:

```bash
docker compose exec ollama ollama pull llama3.2:3b

### Если мало памяти

Если видите в логах Ollama:
`model request too large for system`

Поставьте более лёгкую модель, например:

```env
OLLAMA_MODEL=llama3.2:1b
```

и скачайте:

```bash
docker compose exec ollama ollama pull llama3.2:1b
```
```

### 3) Открыть UI

`http://localhost:3000` → кнопка **«Чат‑бот»** в хедере

или тестовая страница:

`http://localhost:3000/debug/ai`

Для просмотра персональных данных (корзина/адреса) требуется авторизация.

## Переменные окружения

- **`OLLAMA_MODEL`**: имя модели в Ollama (по умолчанию `llama3.1:8b-instruct`)
- **`OLLAMA_BASE_URL`**: URL Ollama из контейнера app (по умолчанию `http://ollama:11434`)

## Как работает tool-calling (безопасно для пользователей)

Модель отвечает JSON-ом и может запросить инструменты:

- `my_profile` — профиль текущего пользователя
- `my_addresses` — адреса текущего пользователя
- `my_cart` — корзина текущего пользователя (читается из Redis через текущую cart identity)
- `search_menu_items` — поиск блюд по названию (read-only)

Любые write-операции запрещены на уровне сервера, а доступ к персональным данным возможен только при наличии cookie авторизации.


