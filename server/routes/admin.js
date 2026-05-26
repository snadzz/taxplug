import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import db, { getConfig, setConfig, promoteUserToAdmin, getAdminEmails, getOnlineVisitorCount, getTodaysVisitCount } from '../models/User.js';

const router = Router();

router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare(
    'SELECT id, name, email, is_admin, created_at FROM users'
  ).all();

  res.json(users);
});

router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  const onlineVisitors = getOnlineVisitorCount(5);
  const visitsToday = getTodaysVisitCount();
  const overtimeThreshold = parseFloat(getConfig('overtime_threshold', '21900')) || 21900;
  const adminEmails = getAdminEmails();

  res.json({ onlineVisitors, visitsToday, overtimeThreshold, adminEmails });
});

router.put('/config', authenticateToken, requireAdmin, (req, res) => {
  const { overtimeThreshold } = req.body;

  if (overtimeThreshold === undefined || overtimeThreshold === null) {
    return res.status(400).json({ error: 'overtimeThreshold is required' });
  }

  const numericThreshold = Number(overtimeThreshold);
  if (Number.isNaN(numericThreshold) || numericThreshold < 0) {
    return res.status(400).json({ error: 'overtimeThreshold must be a valid positive number' });
  }

  setConfig('overtime_threshold', numericThreshold);
  res.json({ success: true, overtimeThreshold: numericThreshold });
});

router.post('/admins', authenticateToken, requireAdmin, (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = promoteUserToAdmin(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ success: true, user });
});

export default router;
