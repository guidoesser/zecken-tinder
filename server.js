const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Database ────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'zecken.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS swipes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER,
    profile_idx INTEGER NOT NULL,
    type        TEXT    NOT NULL CHECK(type IN ('like','nope','super')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_profiles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    name       TEXT NOT NULL,
    age        INTEGER DEFAULT 25,
    location   TEXT DEFAULT '',
    bio        TEXT DEFAULT '',
    tags       TEXT DEFAULT '[]',
    emoji      TEXT DEFAULT '🧑',
    color      TEXT DEFAULT '#e84118',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Schema Migration for Existing DBs ──────────────────────────
// Add user_id to swipes if it doesn't exist (pre-v3 databases)
const swipesCols = db.prepare("PRAGMA table_info('swipes')").all().map(c => c.name);
if (!swipesCols.includes('user_id')) {
  db.exec("ALTER TABLE swipes ADD COLUMN user_id INTEGER REFERENCES users(id)");
  console.log('  ↳ Migration: user_id added to swipes');
}
// Add email/password_hash if users table was created by an older schema
const usersCols = db.prepare("PRAGMA table_info('users')").all().map(c => c.name);
if (!usersCols.includes('email')) {
  db.exec("ALTER TABLE users ADD COLUMN email TEXT UNIQUE NOT NULL DEFAULT ''");
  console.log('  ↳ Migration: email added to users');
}
if (!usersCols.includes('password_hash')) {
  db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''");
  console.log('  ↳ Migration: password_hash added to users');
}

// ─── JWT Secret ──────────────────────────────────────────────────
let jwtSecret = db.prepare("SELECT value FROM settings WHERE key='jwt_secret'").pluck().get();
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('jwt_secret', ?)").run(jwtSecret);
}

// ─── Profile Data (hardcoded) ────────────────────────────────────
const HARDCODED_PROFILES = [
  { name: 'Karla',   age: 28, location: 'Berlin-Neukölln',  emoji: '🎓', color: '#e84118', tags: ['Soziologie','Klimacamp','Lastenrad','Vegan'], bio: '"Das System ändern, nicht das Klima." Organisiere grad nen Riesen-Klimacamp. Such jemanden für gemeinsame Soli-Kochabende und Diskussionen über Postwachstum.' },
  { name: 'Felix',   age: 31, location: 'Leipzig',          emoji: '🎸', color: '#2ecc71', tags: ['Kulturamt','Soli-Party','Vegan-Kochen','Plattenbau'], bio: 'Arbeite im Kulturamt und schmeiß die besten Soli-Partys in Linden. Hab 3 externe Festplatten voller linker Musik. Such jemanden, der auch auf apokalyptische Zukunftsromane steht.' },
  { name: 'Jana',    age: 26, location: 'Hamburg-St. Pauli', emoji: '🎨', color: '#9b59b6', tags: ['Grafikdesign','Hausbesetzung','Demo-Plakate','Flinta*'], bio: 'Mache Plakate für Demos und designe den nächsten Sampler. Wohne im kollektiv und such jemanden, der auch findet, dass Eigentum Diebstahl ist.' },
  { name: 'Tarek',   age: 33, location: 'Köln-Ehrenfeld',   emoji: '🎙️', color: '#3498db', tags: ['Journalismus','Freies Radio','Spenden sammeln','Kaffeehaus'], bio: 'Schreib für ne linke Tageszeitung und mach Radio auf FreeFM. Such jemanden für lange Nächte im Café über Gramsci und wer grad die beste Falafel in Ehrenfeld hat.' },
  { name: 'Lotta',   age: 24, location: 'Freiburg',         emoji: '🚲', color: '#f1c40f', tags: ['"Ich mach BWL nur fürs System"','Fahrrad','CSD-Orga','Zero Waste'], bio: '"BWL-Studentin — aber nur um das System von innen zu verändern!" Fahre Fahrrad (ohne Helm, aus Prinzip). Organisiere den CSD in Freiburg mit.' },
  { name: 'Benno',   age: 29, location: 'Jena',             emoji: '💻', color: '#e74c3c', tags: ['Informatik','Antifa','Matrix-Server','Verschlüsselung'], bio: 'Hacke für die Antifa und betreibe einen eigenen Matrix-Server. Such jemanden, der Signal installiert hat und weiss, was ein PAHE ist. Kiffe nicht, hab aber nix dagegen.' },
  { name: 'Marie',   age: 27, location: 'Dresden',          emoji: '🐱', color: '#e67e22', tags: ['Pflege','Kundgebungen','4 Katzen','Strickkreis'], bio: 'Arbeite in der Pflege und organisier Kundgebungen gegen rechts. Hab 4 Katzen (alle gerettet). Such jemanden, der sonntags mit mir in den Strickkreis kommt.' },
  { name: 'Can',     age: 30, location: 'München',          emoji: '🌯', color: '#1abc9c', tags: ['Jura','NGO','Vegane Döner-Bowl','Theorie'], bio: 'Mach Jura für ne NGO — Prozesskostenhilfe und Asylrecht. Koch die beste vegane Döner-Bowl der Stadt. Such jemanden, der Bock hat abends mal über Staatstheorie zu diskutieren.' },
  { name: 'Fine',    age: 25, location: 'Hannover',         emoji: '🎵', color: '#e84393', tags: ['Veranstaltungstechnik','Soli-Konzerte','Punk','Kabelmanagement'], bio: 'Schmeiß die besten Soli-Konzerte im UJZ. Hab n Kabelmanagement, von dem Benno nur träumen kann. Such jemanden zum Moshpitten und danach Tee trinken.' },
  { name: 'Ole',     age: 32, location: 'Bremen',           emoji: '🪚', color: '#00b894', tags: ['Tischler','Kollektiv-Werkstatt','Mobile Bühnen','Permakultur'], bio: 'Tischler in ner kollektiv betriebenen Werkstatt. Bau mobile Bühnen für Demos und grad nen Tiny House. Such jemanden für gemeinsame Projekte und Permakultur-Wochenenden.' },
  { name: 'Svenja',  age: 29, location: 'Münster',          emoji: '📚', color: '#fd79a8', tags: ['Verlag','Lektorat','Antirassismus','Buchmesse'], bio: 'Lektorin in nem linken Verlag. Korrekturlese Flugblätter gratis. Such jemanden, der auf der Buchmesse mit mir anstellt und über Verteilungsgerechtigkeit diskutiert.' },
  { name: 'Nick',    age: 27, location: 'Kassel',           emoji: '🎭', color: '#6c5ce7', tags: ['Theater','postmigrantisch','Impro','Kulturschaffend'], bio: 'Mache postmigrantisches Theater und Impro-Shows. Organisiere die nächste Kulturwoche. Such jemanden, der mit mir über nasses vs idealistischen Materialismus streitet — und dann lachen kann.' }
];

// Ensure shuffled_order exists
const numHardcoded = HARDCODED_PROFILES.length;
let totalProfileCount = numHardcoded + db.prepare('SELECT COUNT(*) as c FROM user_profiles').get().c;

let hasOrder = db.prepare("SELECT 1 FROM settings WHERE key='shuffled_order'").get();
if (!hasOrder) {
  const initialOrder = [...Array(numHardcoded).keys()];
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('shuffled_order', ?)")
    .run(JSON.stringify(initialOrder));
}

// ─── Auth Middleware ──────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht eingeloggt' });
  }
  try {
    const token = header.slice(7);
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token ungültig' });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      const decoded = jwt.verify(token, jwtSecret);
      req.userId = decoded.userId;
    } catch (e) { /* ignore */ }
  }
  next();
}

// ─── Helpers ──────────────────────────────────────────────────────
function enrichProfile(p, isUserProfile = false) {
  return {
    ...p,
    photo: isUserProfile
      ? `https://i.pravatar.cc/400?u=user${p.id}@zecken-tinder.de`
      : `https://i.pravatar.cc/400?u=${p.name.toLowerCase()}@zecken-tinder.de`,
    isUserProfile: !!isUserProfile
  };
}

function getAllProfiles() {
  // hardcoded profiles
  const hardcoded = HARDCODED_PROFILES.map((p, i) => enrichProfile({ ...p, idx: i }));
  // user-created profiles from DB
  const userRows = db.prepare('SELECT up.*, u.username FROM user_profiles up JOIN users u ON u.id = up.user_id ORDER BY up.id').all();
  const userProfiles = userRows.map(r => enrichProfile({
    idx: numHardcoded + r.id,
    name: r.name,
    age: r.age,
    location: r.location,
    bio: r.bio,
    tags: JSON.parse(r.tags || '[]'),
    emoji: r.emoji || '🧑',
    color: r.color || '#e84118',
    username: r.username,
  }, true));
  return [...hardcoded, ...userProfiles];
}

// ─── Auth Routes ──────────────────────────────────────────────────

// POST /api/register — create account
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email und password sind erforderlich' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)').run(username, email, hash);
    const token = jwt.sign({ userId: result.lastInsertRowid }, jwtSecret, { expiresIn: '30d' });
    res.json({ token, user: { id: result.lastInsertRowid, username, email } });
  } catch (e) {
    if (e.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Username oder Email bereits vergeben' });
    }
    throw e;
  }
});

// POST /api/login — log in
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username und password sind erforderlich' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Falscher Username oder Passwort' });
  }
  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// GET /api/me — current user info + profile
app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User nicht gefunden' });
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId);
  res.json({ user, profile: profile ? { ...profile, tags: JSON.parse(profile.tags || '[]') } : null });
});

// ─── Profile Routes ───────────────────────────────────────────────

// POST /api/profile — create a profile
app.post('/api/profile', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT id FROM user_profiles WHERE user_id = ?').get(req.userId);
  if (existing) {
    return res.status(409).json({ error: 'Du hast bereits ein Profil. Bearbeite es via PUT /api/profile' });
  }
  const { name, age, location, bio, tags, emoji, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name ist erforderlich' });
  db.prepare(`
    INSERT INTO user_profiles (user_id, name, age, location, bio, tags, emoji, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.userId,
    name,
    age || 25,
    location || '',
    bio || '',
    JSON.stringify(tags || []),
    emoji || '🧑',
    color || '#e84118'
  );
  // Recompute total profile count for shuffled order
  const newTotal = numHardcoded + db.prepare('SELECT COUNT(*) as c FROM user_profiles').get().c;
  const orderStr = db.prepare("SELECT value FROM settings WHERE key='shuffled_order'").pluck().get();
  let order = JSON.parse(orderStr || '[]');
  // Ensure order covers all hardcoded + user profiles
  while (order.length < newTotal) order.push(order.length);
  db.prepare("UPDATE settings SET value=? WHERE key='shuffled_order'").run(JSON.stringify(order));
  res.json({ ok: true });
});

// PUT /api/profile — update profile
app.put('/api/profile', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT id FROM user_profiles WHERE user_id = ?').get(req.userId);
  if (!existing) {
    return res.status(404).json({ error: 'Kein Profil vorhanden. Erstelle eins via POST /api/profile' });
  }
  const { name, age, location, bio, tags, emoji, color } = req.body;
  db.prepare(`
    UPDATE user_profiles SET name=?, age=?, location=?, bio=?, tags=?, emoji=?, color=?
    WHERE user_id=?
  `).run(
    name || 'Unbekannt',
    age ?? 25,
    location || '',
    bio || '',
    JSON.stringify(tags || []),
    emoji || '🧑',
    color || '#e84118',
    req.userId
  );
  res.json({ ok: true });
});

// GET /api/profile — get my profile
app.get('/api/profile', authMiddleware, (req, res) => {
  const profile = db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').get(req.userId);
  if (!profile) return res.json({ profile: null });
  res.json({ profile: { ...profile, tags: JSON.parse(profile.tags || '[]') } });
});

// ─── Swipe Routes ─────────────────────────────────────────────────

// GET /api/profiles — shuffled order, with current index
app.get('/api/profiles', optionalAuth, (req, res) => {
  const allProfiles = getAllProfiles();
  const orderStr = db.prepare("SELECT value FROM settings WHERE key='shuffled_order'").pluck().get();
  let order = JSON.parse(orderStr || '[]');

  // Ensure order covers all profiles
  while (order.length < allProfiles.length) order.push(order.length);
  if (order.length > allProfiles.length) order = order.slice(0, allProfiles.length);

  // Find current index: last swipe for this user, or global
  let maxSwiped;
  if (req.userId) {
    maxSwiped = db.prepare("SELECT MAX(profile_idx) as m FROM swipes WHERE user_id=?").get(req.userId)?.m;
  }
  if (maxSwiped === undefined || maxSwiped === null) {
    maxSwiped = db.prepare("SELECT MAX(profile_idx) as m FROM swipes").get()?.m ?? -1;
  }
  const currentIndex = maxSwiped + 1;

  const shuffled = order.slice(0, allProfiles.length).map(i => allProfiles[i]);
  res.json({ profiles: shuffled, currentIndex, total: allProfiles.length });
});

// POST /api/swipe — record a swipe
app.post('/api/swipe', optionalAuth, (req, res) => {
  const { profileIdx, type } = req.body;
  if (profileIdx === undefined || !['like', 'nope', 'super'].includes(type)) {
    return res.status(400).json({ error: 'profileIdx + type required (like/nope/super)' });
  }
  const allProfiles = getAllProfiles();
  if (profileIdx < 0 || profileIdx >= allProfiles.length) {
    return res.status(400).json({ error: 'invalid profileIdx' });
  }
  const userId = req.userId || null;
  db.prepare('INSERT INTO swipes (user_id, profile_idx, type) VALUES (?, ?, ?)').run(userId, profileIdx, type);
  res.json({ ok: true });
});

// GET /api/stats — aggregated stats
app.get('/api/stats', optionalAuth, (req, res) => {
  let stats;
  if (req.userId) {
    stats = db.prepare(`
      SELECT type, COUNT(*) as count FROM swipes WHERE user_id=? GROUP BY type
    `).all(req.userId);
  } else {
    stats = db.prepare(`
      SELECT type, COUNT(*) as count FROM swipes GROUP BY type
    `).all();
  }
  const likes = stats.find(s => s.type === 'like')?.count ?? 0;
  const nopes = stats.find(s => s.type === 'nope')?.count ?? 0;
  const supers = stats.find(s => s.type === 'super')?.count ?? 0;

  const allProfiles = getAllProfiles();
  let matchedRows;
  if (req.userId) {
    matchedRows = db.prepare(`
      SELECT DISTINCT profile_idx FROM swipes WHERE user_id=? AND type IN ('like','super')
    `).all(req.userId);
  } else {
    matchedRows = db.prepare(`
      SELECT DISTINCT profile_idx FROM swipes WHERE type IN ('like','super')
    `).all();
  }
  const matchedProfiles = matchedRows.map(r => allProfiles[r.profile_idx]).filter(Boolean);

  res.json({ likes, nopes, supers, totalSwipes: likes + nopes + supers, matchedProfiles });
});

// POST /api/reset — delete all swipes + reshuffle
app.post('/api/reset', optionalAuth, (req, res) => {
  const allProfiles = getAllProfiles();
  if (req.userId) {
    db.prepare('DELETE FROM swipes WHERE user_id=?').run(req.userId);
  } else {
    db.prepare('DELETE FROM swipes').run();
  }
  const newOrder = [...Array(allProfiles.length).keys()].sort(() => Math.random() - 0.5);
  db.prepare("UPDATE settings SET value=? WHERE key='shuffled_order'").run(JSON.stringify(newOrder));
  res.json({ ok: true });
});

// ─── Start ───────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🕷️  Zecken-Tinder läuft auf http://0.0.0.0:${PORT}`);
  console.log(`   http://localhost:${PORT}`);
});
