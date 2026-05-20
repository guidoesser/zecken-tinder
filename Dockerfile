FROM node:22-alpine

WORKDIR /app

# Abhängigkeiten installieren
COPY package*.json ./
RUN npm ci --only=production

# App-Code kopieren
COPY . .

# Datenbank-Verzeichnis für persistente Speicherung
VOLUME /app/data

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

EXPOSE 3001

CMD ["node", "server.js"]
