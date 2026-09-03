const express = require('express');
const axios = require('axios');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const { getGuildSettings, updateGuildSettings } = require('../lib/db');

const DISCORD_API_BASE = 'https://discord.com/api/v10';

/**
 * GET /dashboard/servers
 * Protected route - renders user's guilds where they have ADMINISTRATOR permission
 * Checks for permission bit 0x8 (ADMINISTRATOR)
 */
router.get('/servers', requireAuth, (req, res) => {
  const guilds = req.session.guilds || [];
  const user = req.session.user;

  // Filter guilds where user has ADMINISTRATOR permission
  // Permission bit 0x8 = ADMINISTRATOR
  const adminGuilds = guilds.filter((guild) => {
    // Convert permissions string to integer
    const permissions = BigInt(guild.permissions);
    const hasAdmin = (permissions & 0x8n) === 0x8n;
    return hasAdmin;
  });

  // Only pass safe user data to template (no accessToken)
  const safeUser = {
    id: user.id,
    username: user.username,
    avatar: user.avatar
  };

  res.render('servers', {
    user: safeUser,
    adminGuilds: adminGuilds,
    adminGuildCount: adminGuilds.length
  });
});

// Temporary test route to validate error page rendering
router.get('/test-error', (req, res) => {
  res.status(403).render('error', { statusCode: 403, message: 'This is a test error page' });
});

/**
 * GET /dashboard/:guildId
 * Protected route - render guild settings page
 * Verifies user has admin access to this guild
 * Fetches guild roles via Discord API
 */
router.get('/:guildId', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const guilds = req.session.guilds || [];
  const user = req.session.user;

  // Find guild in user's guilds and verify ADMINISTRATOR permission
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) {
    return res.status(403).render('error', {
      statusCode: 403,
      message: 'Forbidden - Guild not found in your servers'
    });
  }

  const permissions = BigInt(guild.permissions);
  const hasAdmin = (permissions & 0x8n) === 0x8n;
  if (!hasAdmin) {
    return res.status(403).render('error', {
      statusCode: 403,
      message: 'Forbidden - You do not have ADMINISTRATOR permission in this server'
    });
  }

  // Fetch current guild settings
  const settings = await getGuildSettings(guildId);

  // Fetch guild roles via Discord API
  let roles = [];
  try {
    const rolesResponse = await axios.get(
      `${DISCORD_API_BASE}/guilds/${guildId}/roles`,
      {
        headers: {
          Authorization: `Bot ${process.env.BOT_TOKEN}`
        }
      }
    );
    roles = rolesResponse.data || [];
  } catch (error) {
    console.error('Error fetching guild roles:', error.response?.data || error.message);
    // Continue without roles if fetch fails
    roles = [];
  }

  // Only pass safe user data
  const safeUser = {
    id: user.id,
    username: user.username,
    avatar: user.avatar
  };

  res.render('guild-settings', {
    user: safeUser,
    guildId: guildId,
    guildName: guild.name,
    settings: settings,
    roles: roles,
    saved: req.query.saved || null
  });
});

/**
 * POST /dashboard/:guildId/welcome
 * Protected route - update welcome message setting
 * Verifies user has admin access to this guild
 */
router.post('/:guildId/welcome', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { welcomeMessage } = req.body;
  const guilds = req.session.guilds || [];

  // Find guild in user's guilds and verify ADMINISTRATOR permission
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) {
    return res.status(403).json({ error: 'Forbidden - Guild not found' });
  }

  const permissions = BigInt(guild.permissions);
  const hasAdmin = (permissions & 0x8n) === 0x8n;
  if (!hasAdmin) {
    return res.status(403).json({ error: 'Forbidden - No admin permission' });
  }

  // Update welcome message
  await updateGuildSettings(guildId, { welcome_message: welcomeMessage });

  // Redirect back with success indicator
  res.redirect(`/dashboard/${guildId}?saved=welcome`);
});

/**
 * POST /dashboard/:guildId/auto-role
 * Protected route - update auto-role setting
 * Verifies user has admin access to this guild
 */
router.post('/:guildId/auto-role', requireAuth, async (req, res) => {
  const { guildId } = req.params;
  const { autoRoleId } = req.body;
  const guilds = req.session.guilds || [];

  // Find guild in user's guilds and verify ADMINISTRATOR permission
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) {
    return res.status(403).json({ error: 'Forbidden - Guild not found' });
  }

  const permissions = BigInt(guild.permissions);
  const hasAdmin = (permissions & 0x8n) === 0x8n;
  if (!hasAdmin) {
    return res.status(403).json({ error: 'Forbidden - No admin permission' });
  }

  // Update auto-role (or set to null if "none" is selected)
  const roleId = autoRoleId === 'none' ? null : autoRoleId;
  await updateGuildSettings(guildId, { auto_role_id: roleId });

  // Redirect back with success indicator
  res.redirect(`/dashboard/${guildId}?saved=auto-role`);
});

module.exports = router;
