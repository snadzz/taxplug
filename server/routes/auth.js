// server/routes/auth.js
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {Resend} from 'resend';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail, verifyPassword } from '../models/User.js'; // Added db import if needed directly here
import db from '../models/User.js'; // Importing db for direct queries in forgot/reset password
const router = Router();
const resend = new Resend('re_SDcoejzh_FfcswFt6AJMKXMgdtSFBViae');

// ==========================================
// 1. REGISTER ENDPOINT
// ==========================================
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    const user = await createUser(email, password, name);
    const token = jwt.sign({ userId: user.id, email: user.email, is_admin: user.is_admin }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ==========================================
// 2. LOGIN ENDPOINT
// ==========================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await verifyPassword(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id, email: user.email, is_admin: user.is_admin }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, is_admin: user.is_admin } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ==========================================
// 3. FORGOT PASSWORD ENDPOINT (Now Independent)
// ==========================================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email address required' });
  }

  try {
    const result = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email]
    });

    if (result.rows.length === 0) {
      return res.json({ message: 'If the account exists, a verification code has been generated.' });
    }

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    await db.execute({
      sql: 'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
      args: [verificationCode, expiresAt, email]
    });

   // ==========================================
    // RESEND EMAIL API ENGINE
    // ==========================================
    await resend.emails.send({
      from: 'TaxPlug Support <onboarding@resend.dev>', // Changes to your domain once verified
      to: email,
      subject: 'TaxPlug - Password Reset Verification Code',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #0f172a; text-align: center;">TaxPlug Support</h2>
          <p>We received a request to reset your password. Use this verification token:</p>
          <div style="background: #f1f5f9; font-size: 28px; font-weight: bold; text-align: center; padding: 15px; margin: 20px 0; border-radius: 8px; color: #1e293b;">
            ${verificationCode}
          </div>
          <p style="font-size: 13px; color: #64748b;">Valid for 15 minutes.</p>
        </div>
      `
    });
    console.log(`✉️ Resend API successfully dispatched token to: ${email}`);

    return res.json({ message: 'If the account exists, a verification code has been generated.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'An internal server error occurred' });
  }
});

// ==========================================
// 4. RESET PASSWORD ENDPOINT (Now Independent)
// ==========================================
router.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const result = await db.execute({
      sql: 'SELECT id, reset_token_expires FROM users WHERE email = ? AND reset_token = ?',
      args: [email, token.trim()]
    });

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid verification token code or email.' });
    }

    const user = result.rows[0];
    const now = new Date().toISOString();

    if (user.reset_token_expires && now > user.reset_token_expires) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.execute({
      sql: 'UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
      args: [hashedPassword, user.id]
    });

    return res.json({ message: 'Password has been updated successfully.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

export default router;