import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { trackVisitor } from '../models/User.js';
import crypto from 'crypto';

const router = Router();

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || '';
  return Object.fromEntries(cookieHeader.split(';').map(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    return [name, decodeURIComponent(rest.join('='))];
  }).filter(([name]) => name));
}

function createVisitorId() {
  return crypto.randomBytes(16).toString('hex');
}

router.post('/track', (req, res) => {
  const cookies = parseCookies(req);
  let visitorId = cookies.visitor_id;
  let userId = null;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      // ignore invalid token for tracking
    }
  }

  if (!visitorId) {
    visitorId = createVisitorId();
  }

  trackVisitor(visitorId, userId);
  res.cookie('visitor_id', visitorId, {
    maxAge: 1000 * 60 * 60 * 24 * 30,
    httpOnly: true,
    sameSite: 'lax'
  });
  res.json({ visitorId });
});

export default router;
