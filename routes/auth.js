const express = require('express');
const axios = require('axios');
const router = express.Router();

const DISCORD_API_BASE = 'https://discord.com/api/v10';

/**
 * GET /auth/login
 * Redirects user to Discord OAuth authorize endpoint
 */
router.get('/login', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = `${process.env.DASHBOARD_URL}/auth/callback`;
  const scope = 'identify guilds';

  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

  // DEBUG: Log the redirect URI and Discord auth URL
  console.log('🔐 OAuth Login initiated');
  console.log('   redirectUri:', redirectUri);
  console.log('   discordAuthUrl:', discordAuthUrl);

  res.redirect(discordAuthUrl);
});

/**
 * GET /auth/callback
 * Receives authorization code from Discord, exchanges it for access token,
 * fetches user info and guilds, stores in session
 */
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      `${DISCORD_API_BASE}/oauth2/token`,
      {
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.DASHBOARD_URL}/auth/callback`
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch user information
    const userResponse = await axios.get(`${DISCORD_API_BASE}/users/@me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const user = userResponse.data;

    // Fetch user's guilds
    const guildsResponse = await axios.get(`${DISCORD_API_BASE}/users/@me/guilds`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const guilds = guildsResponse.data;

    // Store in session
    req.session.user = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar,
      email: user.email,
      accessToken: accessToken
    };

    req.session.guilds = guilds;

    // Redirect to dashboard
    res.redirect('/dashboard/servers');
  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Discord' });
  }
});

/**
 * GET /auth/logout
 * Destroys session and redirects to home
 */
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.redirect('/');
  });
});

module.exports = router;
