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
 * @param {Object} patch - Settings to update (greeting_voice_channel_id, greeting_member_role_id, etc.)
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

/**
 * Initialize database schema (idempotent - safe to call on every startup)
 * Creates guild_settings table with minimal columns if it doesn't exist
 * Adds new columns if they don't exist
 */
async function initializeDatabase() {
  try {
    // Create guild_settings table if it doesn't exist
    // Only include guild_id and the new voice greeting columns
    // (other columns are managed by the main bot repo)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        greeting_voice_channel_id TEXT,
        greeting_member_role_id TEXT
      );
    `);

    // Add new columns if they don't exist (idempotent approach)
    const checkColumnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'guild_settings' 
      AND column_name IN ('greeting_voice_channel_id', 'greeting_member_role_id');
    `;
    
    const result = await pool.query(checkColumnsQuery);
    const existingColumns = new Set(result.rows.map(row => row.column_name));

    if (!existingColumns.has('greeting_voice_channel_id')) {
      await pool.query(`
        ALTER TABLE guild_settings 
        ADD COLUMN greeting_voice_channel_id TEXT;
      `);
      console.log('✅ Added greeting_voice_channel_id column');
    }

    if (!existingColumns.has('greeting_member_role_id')) {
      await pool.query(`
        ALTER TABLE guild_settings 
        ADD COLUMN greeting_member_role_id TEXT;
      `);
      console.log('✅ Added greeting_member_role_id column');
    }

    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database schema:', error);
    // Don't exit - the app can still run if the columns already exist
  }
}

module.exports = { pool, getGuildSettings, updateGuildSettings, initializeDatabase };
