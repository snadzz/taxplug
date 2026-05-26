import { Router } from 'express';
import { getConfig } from '../models/User.js';

const router = Router();

router.get('/overtime-threshold', (req, res) => {
  const threshold = parseFloat(getConfig('overtime_threshold', '22466.74')) || 21900;
  res.json({ threshold });
});

export default router;
