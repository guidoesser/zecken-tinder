#!/usr/bin/env node
/**
 * Erstellt einen Admin-Benutzer für Zecken-Tinder.
 *
 * Verwendung:
 *   node scripts/create-admin.js <username> <email> <password>
 *
 * Docker:
 *   docker compose exec zecken-tinder node scripts/create-admin.js admin admin@example.com meinpasswort
 */

const path = require('path');
const bcrypt = require('bcryptjs');

// DB-Pfad (gleiche Logik wie in server.js)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'zecken.db');

const [,, username, email, password] = process.argv;

if (!username || !email || !password) {
  console.log('');
  console.log('❌ Fehler: username, email und password sind erforderlich');
  console.log('');
  console.log('  Verwendung:');
  console.log('    node scripts/create-admin.js <username> <email> <password>');
  console.log('');
  console.log('  Docker:');
  console.log('    docker compose exec zecken-tinder \\');
  console.log('      node scripts/create-admin.js admin admin@example.com meinpasswort');
  console.log('');
  process.exit(1);
}

if (password.length < 6) {
  console.log('❌ Fehler: Passwort muss mindestens 6 Zeichen haben');
  process.exit(1);
}

let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.log('❌ Fehler: better-sqlite3 nicht gefunden.');
  console.log('   Führe das Skript aus dem Projektverzeichnis aus:');
  console.log('     cd zecken-tinder && npm install');
  process.exit(1);
}

let db;
try {
  db = new Database(DB_PATH);
} catch (e) {
  console.log(`❌ Fehler: Kann Datenbank nicht öffnen (${DB_PATH})`);
  console.log('   Prüfe den Pfad oder setze DB_PATH als Umgebungsvariable');
  process.exit(1);
}

// Prüfen ob User bereits existiert
const existing = db.prepare('SELECT id, username FROM users WHERE username = ? OR email = ?').get(username, email);
if (existing) {
  // User existiert → zum Admin machen
  db.prepare('UPDATE users SET is_admin=1, email_verified=1 WHERE id=?').run(existing.id);
  console.log(`✅ User "${existing.username}" (id=${existing.id}) wurde zum Admin erhoben`);
  db.close();
  process.exit(0);
}

// Neuen User anlegen
try {
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, email_verified, is_admin) VALUES (?, ?, ?, 1, 1)'
  ).run(username, email, hash);

  const userId = result.lastInsertRowid;

  // Automatisch ein Profil anlegen (optional, damit der User direkt swipen kann)
  db.prepare(
    'INSERT INTO user_profiles (user_id, name, age, location, bio, tags, emoji, color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, username, 99, 'Admin-Landung', 'Zecken-Tinder Admin', JSON.stringify(['Admin']), '⚙️', '#f1c40f');

  console.log('');
  console.log('✅ Admin-Benutzer erfolgreich angelegt!');
  console.log('');
  console.log(`   Username: ${username}`);
  console.log(`   Email:    ${email}`);
  console.log(`   Passwort: ${password}`);
  console.log('');
  console.log('   Jetzt einloggen unter http://localhost:3001');
  console.log('   und den ⚙️-Button für SMTP & Domain-Setup nutzen.');
  console.log('');

} catch (e) {
  if (e.message.includes('UNIQUE constraint')) {
    console.log('❌ Fehler: Username oder Email bereits vergeben');
  } else {
    console.log('❌ Fehler:', e.message);
  }
  process.exit(1);
} finally {
  db.close();
}
