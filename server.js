const express = require('express');
const session = require('express-session');
require('dotenv').config();

// Validate required environment variables
if (!process.env.SESSION_SECRET) {
  console.error('❌ SESSION_SECRET environment variable is required. Set it on Railway and redeploy.');
  process.exit(1);
}

const app = express();

// Middleware
app.use(express.json());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Routes
app.get('/', (req, res) => {
  res.send('RAVEN Dashboard - Coming Soon');
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// Dashboard routes
const dashboardRoutes = require('./routes/dashboard');
app.use('/dashboard', dashboardRoutes);

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🐦 RAVEN Dashboard server running on port ${PORT}`);
});
