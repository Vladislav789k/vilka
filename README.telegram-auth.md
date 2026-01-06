# Telegram авторизация (Telegram Login Widget)

## Что реализовано

- В `AuthModal` на шаге ввода телефона добавлена кнопка Telegram Login (виджет Telegram).
- Серверный роут `POST /api/auth/telegram`:
  - проверяет подпись (`hash`) по алгоритму Telegram;
  - создаёт пользователя в таблице `users` и выставляет cookie `vilka_user_id`.

> Важно: в текущей схеме БД `users.phone` **NOT NULL + UNIQUE**, поэтому для Telegram‑пользователей используется плейсхолдер `phone = tg:<telegram_id>`. В UI это скрыто (показывается просто “Telegram”).

## Настройка

1) Создай бота через `@BotFather`, включи Login Widget и задай домен (в BotFather: `/setdomain`).

2) Добавь в `.env.local` (для `app` контейнера/Next.js):

```bash
TELEGRAM_AUTH_BOT_TOKEN=123456:ABCDEF...
```

3) Перезапусти `app` контейнер.

## Проверка

- Открой окно входа и нажми “Войти через Telegram”.
- После успешного входа должна появиться cookie `vilka_user_id`, а `/api/auth/me` начнёт возвращать `user`.


