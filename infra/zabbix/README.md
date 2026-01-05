# Zabbix Monitoring Setup

## Обзор

Zabbix настроен для мониторинга всех контейнеров приложения и отправки алертов в Telegram.

## Компоненты

- **zabbix_db**: PostgreSQL база данных для Zabbix
- **zabbix_server**: Zabbix Server (порт 10051)
- **zabbix_web**: Веб-интерфейс Zabbix (порт 8080)
- **zabbix_agent**: Агент для мониторинга Docker хоста

## Быстрый старт

### 1. Настройте Telegram бота

Создайте файл `.env` в корне проекта (или добавьте в существующий):

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_chat_id
```

**Как получить токен:**
1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot` и следуйте инструкциям
3. Сохраните полученный токен

**Как получить Chat ID:**
1. Напишите вашему боту любое сообщение
2. Откройте: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Найдите `"chat":{"id":123456789}` в ответе

### 2. Запустите Zabbix

```bash
docker compose up -d zabbix_db zabbix_server zabbix_web zabbix_agent
```

Подождите 1-2 минуты для инициализации базы данных.

### 3. Войдите в Zabbix Web

- URL: http://localhost:8080
- Логин: `Admin`
- Пароль: `zabbix`

**⚠️ ВАЖНО:** Сразу после первого входа измените пароль!

### 4. Настройте Telegram Media Type

1. Перейдите: **Administration → Media types**
2. Нажмите **Create media type**
3. Заполните:
   - **Name**: `Telegram`
   - **Type**: `Script`
   - **Script name**: `telegram.sh`
   - **Script parameters**:
     ```
     {ALERT.SENDTO}
     {ALERT.MESSAGE}
     ```
4. Сохраните

### 5. Настройте пользователя с Telegram

1. Перейдите: **Administration → Users**
2. Выберите пользователя **Admin** (или создайте нового)
3. Вкладка **Media** → **Add**
4. Заполните:
   - **Type**: `Telegram`
   - **Send to**: ваш Chat ID (тот же, что в `.env`)
5. Сохраните

### 6. Создайте Action для отправки алертов

1. Перейдите: **Configuration → Actions → Trigger actions**
2. Нажмите **Create action**
3. **Name**: `Send to Telegram`
4. Вкладка **Operations**:
   - **Operation type**: `Send message`
   - **Send to users**: выберите пользователя с настроенным Telegram
   - **Send only to**: `Telegram`
5. Вкладка **Conditions** (опционально):
   - Настройте фильтры для отправки только важных алертов
6. Сохраните

### 7. Добавьте хост для мониторинга контейнеров

Zabbix Agent не регистрируется автоматически. Нужно добавить хост вручную:

1. Перейдите: **Configuration → Hosts**
2. Нажмите **Create host**
3. Заполните:
   - **Host name**: `docker-host` (должно совпадать с `ZBX_HOSTNAME` в docker-compose.yml)
   - **Groups**: выберите или создайте группу (например, "Docker Hosts")
   - **Agent interfaces**: 
     - **IP address**: `zabbix_agent` (имя контейнера в Docker сети)
     - **Port**: `10050`
4. Вкладка **Templates**:
   - Нажмите **Select** рядом с "Link new templates"
   - Найдите и выберите шаблоны:
     - `Linux by Zabbix agent` (базовый мониторинг Linux)
     - `Docker by Zabbix agent 2` (мониторинг Docker контейнеров)
   - Нажмите **Add**
5. Сохраните хост

**Важно:** Убедитесь, что имя хоста `docker-host` точно совпадает с переменной `ZBX_HOSTNAME` в docker-compose.yml!

### 8. Проверьте подключение агента

После добавления хоста подождите 1-2 минуты и проверьте:

1. **Configuration → Hosts → docker-host**
2. В колонке **Availability** должен быть зелёный индикатор "Available"
3. Если красный - проверьте логи агента:
   ```bash
   docker compose logs zabbix_agent | tail -30
   ```

### Важно про Docker-шаблон

Шаблон **`Docker by Zabbix agent 2`** требует контейнер **`zabbix-agent2`** и доступ к Docker socket.
В `docker-compose.yml` сервис `zabbix_agent` настроен именно как agent2 и монтирует `/var/run/docker.sock`.
Docker endpoint включается через файл `infra/zabbix/zabbix_agent2.d/plugins.d/docker.conf`,
который монтируется в `/etc/zabbix/zabbix_agent2.d/plugins.d/docker.conf` (так entrypoint образа не конфликтует с read-only конфигом).
Контейнер агента запускается от root, чтобы избежать проблем с правами на `docker.sock`.

## Мониторинг контейнеров

После настройки хоста Zabbix Agent будет мониторить:
- Использование CPU и памяти контейнеров
- Сетевой трафик
- Статус контейнеров (running/stopped)
- Использование дискового пространства
- Системные метрики хоста

**Просмотр метрик:**
1. Перейдите: **Monitoring → Latest data**
2. Выберите хост `docker-host`
3. Вы увидите все собранные метрики

**Просмотр контейнеров:**
1. Перейдите: **Monitoring → Latest data**
2. Выберите хост `docker-host`
3. Найдите метрики с префиксом `docker.containers` или `docker.container`
4. Там будут данные по каждому контейнеру

## Тестирование Telegram интеграции

1. В Zabbix Web: **Administration → Media types → Telegram → Test**
2. Или создайте тестовый триггер и принудительно вызовите его

## Порты

- **8080**: Zabbix Web Interface
- **10051**: Zabbix Server (для агентов)
- **5433**: PostgreSQL для Zabbix (отдельно от основной БД)

## Troubleshooting

### Zabbix не запускается

Проверьте логи:
```bash
docker compose logs zabbix_server
docker compose logs zabbix_db
```

### Telegram не отправляет сообщения

1. Проверьте переменные окружения:
   ```bash
   docker compose exec zabbix_server env | grep TELEGRAM
   ```

2. Проверьте скрипт вручную:
   ```bash
   docker compose exec zabbix_server /usr/lib/zabbix/alertscripts/telegram.sh <chat_id> "Test message"
   ```

3. Проверьте логи Zabbix Server:
   ```bash
   docker compose logs zabbix_server | grep -i telegram
   ```

### База данных не инициализируется

Если Zabbix не может подключиться к БД:
```bash
docker compose down -v zabbix_db
docker compose up -d zabbix_db
# Подождите 30 секунд
docker compose up -d zabbix_server zabbix_web
```

### Проблема "Zabbix agent is not available" на хосте "Zabbix server"

Это нормально! Хост "Zabbix server" в Zabbix Web - это встроенный хост для мониторинга самого Zabbix server. 

**Решение:**

1. **Вариант 1 (рекомендуется):** Отключите мониторинг встроенного хоста "Zabbix server":
   - Перейдите: **Configuration → Hosts**
   - Найдите хост "Zabbix server"
   - Нажмите на него
   - В поле **Status** выберите **Disabled**
   - Сохраните

2. **Вариант 2:** Настройте правильный хост для мониторинга:
   - Перейдите: **Configuration → Hosts**
   - Найдите хост "Zabbix server"
   - В поле **Agent interfaces** укажите:
     - **IP address**: `zabbix_server` (имя контейнера)
     - **Port**: `10050`
   - Но это не сработает, так как на самом Zabbix server контейнере нет агента

3. **Вариант 3:** Используйте только хост `docker-host` (Zabbix Agent):
   - Хост `docker-host` уже настроен и работает
   - Он мониторит все контейнеры Docker
   - Просто отключите встроенный хост "Zabbix server"

**Проверка работы агента:**
```bash
# Проверьте, что агент запущен
docker compose ps zabbix_agent

# Проверьте логи агента
docker compose logs zabbix_agent | tail -30

# Проверьте подключение к серверу
docker compose exec zabbix_agent zabbix_agentd -t agent.ping

# Проверьте, что агент видит контейнеры
docker compose exec zabbix_agent zabbix_agentd -t docker.containers.discovery
```

### Хост не появляется или не подключается

1. **Проверьте имя хоста:**
   ```bash
   # Должно быть "docker-host"
   docker compose exec zabbix_agent printenv ZBX_HOSTNAME
   ```

2. **Проверьте подключение агента к серверу:**
   ```bash
   # Из контейнера агента должен быть доступен zabbix_server
   docker compose exec zabbix_agent ping -c 2 zabbix_server
   ```

3. **Проверьте порт в интерфейсе хоста:**
   - В Zabbix Web: **Configuration → Hosts → docker-host → Agent interfaces**
   - IP должен быть: `zabbix_agent` (имя контейнера)
   - Порт: `10050`

4. **Проверьте логи сервера:**
   ```bash
   docker compose logs zabbix_server | grep -i "docker-host" | tail -20
   ```

5. **Перезапустите агент:**
   ```bash
   docker compose restart zabbix_agent
   ```

## Дополнительные настройки

### Мониторинг конкретных метрик приложения

Для мониторинга метрик Next.js приложения можно:
1. Добавить Zabbix Agent в контейнер `app`
2. Использовать Zabbix Trapper для отправки метрик из приложения
3. Настроить HTTP checks для мониторинга API endpoints

### Настройка уведомлений по расписанию

В Actions можно настроить:
- Отправку только в рабочее время
- Эскалацию алертов (повторная отправка, если проблема не решена)
- Разные каналы для разных уровней критичности

