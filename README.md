# Zecken Tinder 💚

**Tinder für linksgrünversiffte Herzen.**

Ein satirischer Tinder-Klon mit liebevoll gestalteten Profilen von linksalternativen Menschen.
Swipe durch Karla (Klimacamp-Orga aus Neukölln), Felix (Soli-Party-Legende aus Leipzig) und viele mehr!

## Features

- 🃏 Karten-Swipe-Interface (Drag oder Buttons)
- 💚 Like / ✕ Nope / ⭐ Super-Like
- 🎊 Match-Animation mit Konfetti
- ⌨️ Tastatur-Steuerung (← → ↑)
- 📊 Live-Statistiken
- 🔄 Shuffle beim Neustart
- 🔐 Registrierung & Login mit E-Mail-Verifikation
- 👤 Eigene Profile erstellen
- ⚙️ Admin-Bereich (SMTP-Konfiguration, Domain, User-Verwaltung)
- 📱 Responsive — läuft auf Handy, Tablet, Desktop

## Schnellstart mit Docker (empfohlen)

### Voraussetzungen

- [Docker](https://docs.docker.com/get-docker/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)

### Installation & Start

```bash
# Repository klonen
git clone https://github.com/guidoesser/zecken-tinder.git
cd zecken-tinder

# Container bauen und starten
docker compose up -d
```

Die App läuft dann unter **http://localhost:3001**.

### Konfiguration

Die wichtigsten Einstellungen in `docker-compose.yml`:

| Variable | Standard | Beschreibung |
|----------|----------|-------------|
| `PORT` | `3001` | Server-Port |
| `SERVER_BASE` | `http://localhost:3001` | Öffentliche URL (für Verifikations-Links) |
| `DB_PATH` | `/app/data/zecken.db` | Pfad zur SQLite-Datenbank |

**Datenbank-Persistenz:** Die SQLite-Datenbank liegt in einem Docker-Volume (`zecken-data`).
Sie bleibt erhalten, auch wenn der Container neu gestartet oder aktualisiert wird.

### Logs anzeigen

```bash
docker compose logs -f
```

### Aktualisieren

```bash
git pull
docker compose up -d --build
```

### Admin-Benutzer erstellen (Docker-Konsole)

Beim ersten Start gibt es noch keinen Admin. Leg einen mit dem Create-Script an:

```bash
docker compose exec zecken-tinder \
  node scripts/create-admin.js admin admin@example.com deinpasswort
```

Ersetze `admin`, `admin@example.com` und `deinpasswort` durch deine Wunschdaten.
Der User wird automatisch verifiziert, zum Admin gemacht und bekommt ein Profil.
Danach unter http://localhost:3001 einloggen und ⚙️ für SMTP & Domain-Setup nutzen.

→ Das Skript funktioniert auch ohne Docker, direkt im Projektverzeichnis:

```bash
node scripts/create-admin.js <username> <email> <passwort>
```

### Stoppen

```bash
docker compose down
```

## Manuelle Installation (ohne Docker)

### Voraussetzungen

- Node.js 22+ (getestet mit v22.22.2)
- npm 10+

### Setup

```bash
git clone https://github.com/guidoesser/zecken-tinder.git
cd zecken-tinder
npm install
node server.js
```

Die App läuft dann unter **http://localhost:3001**.

### Als systemd-Service (Linux)

```bash
# Service-Datei kopieren und anpassen
cp zecken-tinder.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now zecken-tinder.service
```

## Admin-Bereich

Nach dem Login als Admin (⚙️-Button in der User-Leiste):

### SMTP konfigurieren

Für E-Mail-Verifikation wird ein SMTP-Server benötigt:

1. Im Admin-Bereich auf **📧 SMTP** die Zugangsdaten eintragen
2. **Test-Mail senden** prüft die Konfiguration
3 Neue User erhalten dann eine Bestätigungs-Mail

### Domain ändern

Die **🌐 Domain** bestimmt die Basis-URL für Verifikations-Links in Mails.
Standard: `http://localhost:3001` — bei Produktivbetrieb auf die echte URL ändern.

## Technologie

- **Backend:** Node.js, Express, better-sqlite3
- **Frontend:** Pure HTML + CSS + JavaScript (kein Framework)
- **Datenbank:** SQLite (WAL-Modus)
- **Auth:** JWT (jsonwebtoken) + bcryptjs
- **E-Mail:** nodemailer
- **Container:** Docker + Docker Compose

## Lizenz

MIT — fühl dich frei zu forken, zu erweitern, oder eigene Profile hinzuzufügen!
