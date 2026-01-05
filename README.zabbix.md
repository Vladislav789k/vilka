# Zabbix Monitoring

## Краткая инструкция

Zabbix настроен для мониторинга всех контейнеров и отправки алертов в Telegram.

### Быстрый старт

1. **Создайте Telegram бота** через [@BotFather](https://t.me/BotFather)
2. **Добавьте в `.env` или `docker-compose.yml`:**
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token
   TELEGRAM_CHAT_ID=your_chat_id
   ```
3. **Запустите Zabbix:**
   ```bash
   docker compose up -d zabbix_db zabbix_server zabbix_web zabbix_agent
   ```
4. **Войдите в Zabbix Web:** http://localhost:8080
   - Логин: `Admin`
   - Пароль: `zabbix` (сразу измените!)

### Настройка Telegram

Подробная инструкция: [infra/zabbix/README.md](./infra/zabbix/README.md)

### Доступ

- **Zabbix Web**: http://localhost:8080
- **Zabbix Server**: localhost:10051
- **Zabbix DB**: localhost:5433

### Полная документация

См. [infra/zabbix/README.md](./infra/zabbix/README.md) для детальной настройки.

