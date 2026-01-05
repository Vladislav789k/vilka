#!/bin/bash
# Zabbix AlertScript для отправки уведомлений в Telegram
# Использование: telegram.sh <chat_id> <message>
#
# Переменные окружения (из docker-compose.yml):
# - TELEGRAM_BOT_TOKEN: токен бота от @BotFather
# - TELEGRAM_CHAT_ID: ID чата (можно передать как первый аргумент)

# Параметры: chat_id передается как первый аргумент, message - как второй
CHAT_ID="${1:-${TELEGRAM_CHAT_ID:-}}"
MESSAGE="${2:-${ALERT.MESSAGE:-}}"

# Токен берется из переменной окружения контейнера
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
    echo "ERROR: TELEGRAM_BOT_TOKEN and CHAT_ID must be set"
    echo "TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:+SET}"
    echo "CHAT_ID: ${CHAT_ID:+SET}"
    exit 1
fi

# Форматирование сообщения для Telegram (Markdown)
# Экранируем специальные символы Markdown, но оставляем UTF-8 (кириллицу) как есть.
MESSAGE=$(echo "$MESSAGE" | sed 's/_/\\_/g' | sed 's/\*/\\*/g' | sed 's/\[/\\[/g' | sed 's/\]/\\]/g' | sed 's/(/\\(/g' | sed 's/)/\\)/g' | sed 's/~/\\~/g' | sed 's/`/\\`/g' | sed 's/>/\\>/g' | sed 's/#/\\#/g' | sed 's/+/\\+/g' | sed 's/-/\\-/g' | sed 's/=/\\=/g' | sed 's/|/\\|/g' | sed 's/{/\\{/g' | sed 's/}/\\}/g' | sed 's/\./\\./g' | sed 's/!/\\!/g')

# URL для отправки сообщения в Telegram
URL="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"

form_escape() {
  # Escape only the characters that break application/x-www-form-urlencoded.
  # Keep UTF-8 bytes intact so Cyrillic is delivered correctly.
  local s="$1"
  s=${s//'%'/%25}
  s=${s//'&'/%26}
  s=${s//'='/%3D}
  s=${s//'+'/%2B}
  s=${s//$'\r'/%0D}
  s=${s//$'\n'/%0A}
  # spaces are safe, but encode for consistency
  s=${s//' '/%20}
  echo "$s"
}

POST_DATA="chat_id=$(form_escape "$CHAT_ID")&text=$(form_escape "$MESSAGE")&parse_mode=Markdown&disable_web_page_preview=true"

# Отправка сообщения (curl если есть, иначе wget)
if command -v curl >/dev/null 2>&1; then
  RESPONSE=$(curl -sS -X POST "$URL" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      --data "$POST_DATA")
elif command -v wget >/dev/null 2>&1; then
  RESPONSE=$(wget -qO- \
      --header="Content-Type: application/x-www-form-urlencoded" \
      --post-data="$POST_DATA" \
      "$URL")
else
  echo "ERROR: Neither curl nor wget is available in the container"
  exit 1
fi

# Проверка результата
if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo "OK: Message sent to Telegram"
    exit 0
else
    echo "ERROR: Failed to send message to Telegram"
    echo "Response: $RESPONSE"
    exit 1
fi

