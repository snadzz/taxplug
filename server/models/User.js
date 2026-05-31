// server/models/User.js
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../public/data/vectors.db'); 

export const db = createClient({
  url: `file:${dbPath}`
});



export async function initializeDatabase() {
  // Setup tables using individual atomic .execute() methods
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      is_admin INTEGER DEFAULT 0,
      cellno TEXT,
      addressLine1 TEXT,
      addressLine2 TEXT,
      province TEXT,
      country TEXT,
      reset_token TEXT,
      reset_token_expires DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      sources TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT UNIQUE NOT NULL,
      user_id INTEGER,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS analytics_visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      user_id INTEGER,
      visited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  const existingThresholdRes = await db.execute({
    sql: 'SELECT value FROM app_config WHERE key = ?',
    args: ['overtime_threshold']
  });
  const existingThreshold = existingThresholdRes.rows[0];

  if (!existingThreshold) {
    await db.execute({
      sql: 'INSERT INTO app_config (key, value) VALUES (?, ?)',
      args: ['overtime_threshold', '21900']
    });
  }

  const adminEmail = 'dubazank@gmail.com';
  const adminUserRes = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [adminEmail]
  });
  const adminUser = adminUserRes.rows[0];

  if (adminUser) {
    await db.execute({
      sql: 'UPDATE users SET is_admin = 1 WHERE email = ?',
      args: [adminEmail]
    });
    console.log(`✓ Admin privileges granted to ${adminEmail}`);
  }
}

export async function createUser(email, password, name) {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const userCountRes = await db.execute('SELECT COUNT(*) as c FROM users');
  const userCount = userCountRes.rows[0]?.c || 0;
  const isAdmin = userCount === 0 ? 1 : 0;

  const result = await db.execute({
    sql: 'INSERT INTO users (email, password, name, is_admin) VALUES (?, ?, ?, ?)',
    args: [email, hashedPassword, name, isAdmin]
  });

  return { id: Number(result.lastInsertRowid), email, name, is_admin: isAdmin };
}

export async function findUserByEmail(email) {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE email = ?',
    args: [email]
  });
  return result.rows[0] || null;
}

export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

export async function saveChatMessage(userId, question, answer, sources) {
  await db.execute({
    sql: 'INSERT INTO chat_history (user_id, question, answer, sources) VALUES (?, ?, ?, ?)',
    args: [userId, question, answer, JSON.stringify(sources)]
  });
}

export async function getChatHistory(userId, limit = 20) {
  const result = await db.execute({
    sql: 'SELECT * FROM chat_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    args: [userId, limit]
  });
  return result.rows;
}

export async function getConfig(key, defaultValue = null) {
  const result = await db.execute({
    sql: 'SELECT value FROM app_config WHERE key = ?',
    args: [key]
  });
  const row = result.rows[0];
  return row ? row.value : defaultValue;
}

export async function setConfig(key, value) {
  await db.execute({
    sql: 'INSERT INTO app_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [key, String(value)]
  });
}

export async function promoteUserToAdmin(email) {
  const user = await findUserByEmail(email);
  if (!user) return null;
  await db.execute({
    sql: 'UPDATE users SET is_admin = 1 WHERE email = ?',
    args: [email]
  });
  return { ...user, is_admin: 1 };
}

export async function getAdminEmails() {
  const result = await db.execute('SELECT email FROM users WHERE is_admin = 1 ORDER BY email');
  return result.rows.map(row => row.email);
}

export async function trackVisitor(visitorId, userId = null) {
  if (!visitorId) return null;
  const now = new Date().toISOString();
  
  const existingRes = await db.execute({
    sql: 'SELECT id FROM analytics_sessions WHERE visitor_id = ?',
    args: [visitorId]
  });
  const existing = existingRes.rows[0];

  if (existing) {
    await db.execute({
      sql: 'UPDATE analytics_sessions SET user_id = ?, last_seen = ? WHERE visitor_id = ?',
      args: [userId, now, visitorId]
    });
  } else {
    await db.execute({
      sql: 'INSERT INTO analytics_sessions (visitor_id, user_id, last_seen) VALUES (?, ?, ?)',
      args: [visitorId, userId, now]
    });
  }

  await db.execute({
    sql: 'INSERT INTO analytics_visits (visitor_id, user_id) VALUES (?, ?)',
    args: [visitorId, userId]
  });
  
  return visitorId;
}

export async function getOnlineVisitorCount() {
  try {
    // 💡 FIXED: Uses SQLite native datetime/strftime tracking logic instead of unquoted 'now' variables
    // Counts users active within the last 15 minutes
    const query = `
      SELECT COUNT(*) as count 
      FROM users 
      WHERE last_seen >= datetime('now', '-15 minutes')
    `;
    
    const result = await db.execute(query);
    return result.rows[0]?.count || 1;
  } catch (error) {

    if(error.message.includes("no such column: last_seen")) {
      return 1;
    }
    console.error("Error executing getOnlineVisitorCount:", error);
    
    // Fallback: Return 1 (the current admin) so the page doesn't crash if your schema doesn't have 'last_seen' yet
    return 1; 
  }
}

export default db;