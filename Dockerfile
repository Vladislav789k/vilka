FROM node:20-alpine

WORKDIR /usr/src/app

# зависимости отдельно для кеша
COPY package.json package-lock.json ./
# npm ci требует синхронизации lock; используем install, чтобы не падать при локальных dev-добавлениях
RUN npm install --no-audit --no-fund

# остальной код
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
