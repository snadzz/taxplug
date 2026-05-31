// server/index.js
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import qaRoutes from './routes/qa.js';
import { initializeDatabase } from './models/User.js';
import adminRoutes from './routes/admin.js';
import configRoutes from './routes/config.js';
import analyticsRoutes from './routes/analytics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize SQLite database for users
initializeDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/qa', qaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/config', configRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve frontend
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/chat.html', (req, res, next) => {
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
