const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Profile Data ────────────────────────────────────────────────
const PROFILES = [
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

// Add photos to profiles before sending
function enrichProfiles(profiles) {
  return profiles.map(p => ({
    ...p,
    photo: `https://i.pravatar.cc/400?u=${p.name.toLowerCase()}@zecken-tinder.de`
  }));
}

// ─── Database ────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'zecken.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS swipes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_idx INTEGER NOT NULL,
    type        TEXT    NOT NULL CHECK(type IN ('like','nope','super')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);
// Ensure shuffled_order exists
const hasOrder = db.prepare("SELECT 1 FROM settings WHERE key='shuffled_order'").get();
if (!hasOrder) {
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('shuffled_order', ?)")
    .run(JSON.stringify([...Array(PROFILES.length).keys()]));
}

// ─── API Routes ──────────────────────────────────────────────────

// GET /api/profiles — shuffled order, with current index
app.get('/api/profiles', (req, res) => {
  const orderStr = db.prepare("SELECT value FROM settings WHERE key='shuffled_order'").pluck().get();
  let order = JSON.parse(orderStr || '[]');
  const maxSwiped = db.prepare("SELECT MAX(profile_idx) as m FROM swipes").get()?.m ?? -1;
  const currentIndex = maxSwiped + 1;
  const shuffled = order.map(i => PROFILES[i]);
  res.json({ profiles: enrichProfiles(shuffled), currentIndex, total: PROFILES.length });
});

// POST /api/swipe — record a swipe or super
app.post('/api/swipe', (req, res) => {
  const { profileIdx, type } = req.body;
  if (profileIdx === undefined || !['like', 'nope', 'super'].includes(type)) {
    return res.status(400).json({ error: 'profileIdx + type required (like/nope/super)' });
  }
  if (profileIdx < 0 || profileIdx >= PROFILES.length) {
    return res.status(400).json({ error: 'invalid profileIdx' });
  }
  db.prepare('INSERT INTO swipes (profile_idx, type) VALUES (?, ?)').run(profileIdx, type);
  res.json({ ok: true });
});

// GET /api/stats — aggregated stats
app.get('/api/stats', (req, res) => {
  const stats = db.prepare(`
    SELECT type, COUNT(*) as count FROM swipes GROUP BY type
  `).all();
  const likes = stats.find(s => s.type === 'like')?.count ?? 0;
  const nopes = stats.find(s => s.type === 'nope')?.count ?? 0;
  const supers = stats.find(s => s.type === 'super')?.count ?? 0;

  // Matched profiles (likes + supers)
  const matchedRows = db.prepare(`
    SELECT DISTINCT profile_idx FROM swipes WHERE type IN ('like','super')
  `).all();
  const orderStr = db.prepare("SELECT value FROM settings WHERE key='shuffled_order'").pluck().get();
  const order = JSON.parse(orderStr || '[]');
  const matchedProfiles = matchedRows.map(r => enrichProfiles([PROFILES[order[r.profile_idx]]])[0]).filter(Boolean);

  res.json({ likes, nopes, supers, totalSwipes: likes + nopes + supers, matchedProfiles });
});

// POST /api/reset — delete all swipes + reshuffle
app.post('/api/reset', (req, res) => {
  db.prepare('DELETE FROM swipes').run();
  const newOrder = [...Array(PROFILES.length).keys()].sort(() => Math.random() - 0.5);
  db.prepare("UPDATE settings SET value=? WHERE key='shuffled_order'").run(JSON.stringify(newOrder));
  res.json({ ok: true });
});

// ─── Start ───────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🕷️  Zecken-Tinder läuft auf http://0.0.0.0:${PORT}`);
  console.log(`   http://localhost:${PORT}`);
});
