const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway')
    ? { rejectUnauthorized: false }
    : false
});

/**
 * Get guild settings from database
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<Object>} - Guild settings row or empty object
 */
async function getGuildSettings(guildId) {
  try {
    const result = await pool.query(
      'SELECT * FROM guild_settings WHERE guild_id = $1',
      [guildId]
    );
    return result.rows.length > 0 ? result.rows[0] : {};
  } catch (error) {
    console.error('Error fetching guild settings:', error);
    return {};
  }
}

/**
 * Update guild settings in database (upsert)
 * @param {string} guildId - Discord guild ID
 * @param {Object} patch - Settings to update (welcome_message, welcome_channel_id, auto_role_id)
 * @returns {Promise<Object>} - Updated settings row
 */
async function updateGuildSettings(guildId, patch) {
  try {
    // Build dynamic SET clause for only the columns in patch
    const columns = Object.keys(patch);
    const values = Object.values(patch);
    
    if (columns.length === 0) {
      return {};
    }

    // Add guildId to values array
    values.unshift(guildId);

    // Build SET clause: col1 = $2, col2 = $3, etc.
    const setClause = columns
      .map((col, idx) => `${col} = $${idx + 2}`)
      .join(', ');

    const query = `
      INSERT INTO guild_settings (guild_id, ${columns.join(', ')})
      VALUES ($1, ${columns.map((_, idx) => `$${idx + 2}`).join(', ')})
      ON CONFLICT (guild_id)
      DO UPDATE SET ${setClause}
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || {};
  } catch (error) {
    console.error('Error updating guild settings:', error);
    return {};
  }
}

module.exports = { pool, getGuildSettings, updateGuildSettings };