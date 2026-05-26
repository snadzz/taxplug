// server/models/User.js
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '../../data/users.db'));

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sources TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS analytics_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS analytics_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      user_id INTEGER,
      visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  const existingThreshold = db.prepare('SELECT value FROM app_config WHERE key = ?').get('overtime_threshold');
  if (!existingThreshold) {
    db.prepare('INSERT INTO app_config (key, value) VALUES (?, ?)').run('overtime_threshold', '21900');
  }

  // Ensure specific admin user is promoted if user exists
  const adminEmail = 'dubazank@gmail.com';
  const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (adminUser) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(adminEmail);
    console.log(`✓ Admin privileges granted to ${adminEmail}`);
  }
}

export async function createUser(email, password, name) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const isAdmin = userCount === 0 ? 1 : 0;
  const stmt = db.prepare('INSERT INTO users (email, password, name, is_admin) VALUES (?, ?, ?, ?)');
  const result = stmt.run(email, hashedPassword, name, isAdmin);
  return { id: result.lastInsertRowid, email, name, is_admin: isAdmin };
}

export function findUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export function saveChatMessage(userId, question, answer, sources) {
  const stmt = db.prepare(
    'INSERT INTO chat_history (user_id, question, answer, sources) VALUES (?, ?, ?, ?)'
  );
  stmt.run(userId, question, answer, JSON.stringify(sources));
}

export function getChatHistory(userId, limit = 20) {
  const stmt = db.prepare(
    'SELECT * FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
  );
  return stmt.all(userId, limit);
}

export function getConfig(key, defaultValue = null) {
  const stmt = db.prepare('SELECT value FROM app_config WHERE key = ?');
  const row = stmt.get(key);
  return row ? row.value : defaultValue;
}

export function setConfig(key, value) {
  const stmt = db.prepare(
    'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  stmt.run(key, String(value));
}

export function promoteUserToAdmin(email) {
  const user = findUserByEmail(email);
  if (!user) return null;
  db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(email);
  return { ...user, is_admin: 1 };
}

export function getAdminEmails() {
  const stmt = db.prepare('SELECT email FROM users WHERE is_admin = 1 ORDER BY email');
  return stmt.all().map(row => row.email);
}

export function trackVisitor(visitorId, userId = null) {
  if (!visitorId) return null;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM analytics_sessions WHERE visitor_id = ?').get(visitorId);

  if (existing) {
    db.prepare('UPDATE analytics_sessions SET user_id = ?, last_seen = ? WHERE visitor_id = ?')
      .run(userId, now, visitorId);
  } else {
    db.prepare('INSERT INTO analytics_sessions (visitor_id, user_id, last_seen) VALUES (?, ?, ?)')
      .run(visitorId, userId, now);
  }

  db.prepare('INSERT INTO analytics_visits (visitor_id, user_id) VALUES (?, ?)').run(visitorId, userId);
  return visitorId;
}

export function getOnlineVisitorCount(cutoffMinutes = 5) {
  const stmt = db.prepare(
    'SELECT COUNT(*) as count FROM analytics_sessions WHERE last_seen >= datetime("now", ?)' 
  );
  return stmt.get(`-${cutoffMinutes} minutes`).count;
}

export function getTodaysVisitCount() {
  const stmt = db.prepare(
    'SELECT COUNT(*) as count FROM analytics_visits WHERE date(visited_at) = date("now", "localtime")'
  );
  return stmt.get().count;
}

export default db;
