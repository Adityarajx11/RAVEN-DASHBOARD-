const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');

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

module.exports = router;
