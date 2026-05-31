// server/routes/admin.js
import express from 'express';
import { requireAdmin } from '../middleware/admin.js';
import { authenticateToken } from '../middleware/auth.js';

import db, { getOnlineVisitorCount } from '../models/User.js';

const router = express.Router();

// Apply your middleware
router.use(authenticateToken, requireAdmin);

// 1. GET ALL USERS ROUTE
router.get('/users', async (req, res) => {
  try {
    // 💡 SWAPPED: db.prepare().all() -> await db.execute()
    const result = await db.execute("SELECT id, name, email, is_admin, created_at FROM users ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Admin user fetch error:", error);
    res.status(500).json({ error: "Failed to fetch user database records" });
  }
});

// 2. GET STATS ROUTE
router.get('/stats', async (req, res) => {
  try {
    const totalUsersResult = await db.execute("SELECT COUNT(*) as count FROM users");
    const onlineCount = await getOnlineVisitorCount(); // Calls our fixed model function below
    
    // Get your threshold configuration value from your settings/config table if you have one
    const thresholdResult = await db.execute("SELECT value FROM config WHERE key = 'overtime_threshold' LIMIT 1").catch(() => null);
    const overtimeThreshold = thresholdResult?.rows[0]?.value || 21900;

    // Get admin email list
    const adminsResult = await db.execute("SELECT email FROM users WHERE is_admin = 1");
    const adminEmails = adminsResult.rows.map(row => row.email);

    res.json({
      onlineVisitors: onlineCount,
      visitsToday: totalUsersResult.rows[0].count, // Fallback placeholder to total users for now
      overtimeThreshold: overtimeThreshold,
      adminEmails: adminEmails
    });
  } catch (error) {
    console.error("Admin stats fetch error:", error);
    res.status(500).json({ error: "Failed to aggregate admin dashboard telemetry data" });
  }
});

export default router;