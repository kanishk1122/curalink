const prisma = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client(process.env.GOOGLE_AUTH);

/**
 * Register a new user
 */
const register = async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name }
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * Claim guest chats for an authenticated user
 */
const claimChats = async (req, res) => {
  const { chatIds } = req.body; // Array of UUIDs
  const userId = req.user.id;

  try {
    await prisma.chat.updateMany({
      where: {
        id: { in: chatIds },
        userId: null // Only claim orphan chats
      },
      data: { userId }
    });
    res.json({ success: true, message: 'Chats claimed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to claim chats' });
  }
};

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, name: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

/**
 * Google Login / Signup
 */
const googleLogin = async (req, res) => {
  const { credential } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_AUTH
    });

    const { email, name, picture } = ticket.getPayload();

    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: null // Google users don't have a local password
        }
      });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      user: { id: user.id, email: user.email, name: user.name, picture }, 
      token 
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(400).json({ error: 'Google authentication failed' });
  }
};

module.exports = {
  register,
  login,
  claimChats,
  getProfile,
  googleLogin
};
