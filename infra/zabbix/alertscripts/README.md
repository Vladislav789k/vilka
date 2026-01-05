# Zabbix AlertScripts

## Telegram Integration

Скрипт `telegram.sh` отправляет уведомления из Zabbix в Telegram бота.

### Настройка

1. **Создайте Telegram бота:**
   - Откройте [@BotFather](https://t.me/BotFather) в Telegram
   - Отправьте команду `/newbot`
   - Следуйте инструкциям для создания бота
   - Сохраните полученный токен

2. **Получите Chat ID:**
   - Напишите вашему боту любое сообщение
   - Откройте в браузере: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Найдите `chat.id` в ответе

3. **Настройте переменные окружения:**
   - Добавьте в `docker-compose.yml` или `.env`:
     ```yaml
     TELEGRAM_BOT_TOKEN: "your_bot_token_here"
     TELEGRAM_CHAT_ID: "your_chat_id_here"
     ```

4. **Настройте Media Type в Zabbix:**
   - Войдите в Zabbix Web (http://localhost:8080)
   - Перейдите в **Administration → Media types**
   - Нажмите **Create media type**
   - Заполните:
     - **Name**: `Telegram`
     - **Type**: `Script`
     - **Script name**: `telegram.sh`
     - **Script parameters** (добавьте две строки):
       ```
       {ALERT.SENDTO}
       {ALERT.MESSAGE}
       ```
   - Сохраните

5. **Настройте Actions:**
   - Перейдите в Configuration → Actions → Trigger actions
   - Создайте или отредактируйте Action
   - В Operations добавьте отправку через Media Type "Telegram"
   - В Send to users укажите пользователя с Telegram в качестве контакта

### Использование

Скрипт автоматически вызывается Zabbix при срабатывании триггеров, настроенных для отправки в Telegram.

