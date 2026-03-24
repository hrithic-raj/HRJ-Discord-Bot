const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'levelguard.db'));

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 0,
      messages INTEGER DEFAULT 0,
      voice_minutes INTEGER DEFAULT 0,
      last_message INTEGER DEFAULT 0,
      weekly_xp INTEGER DEFAULT 0,
      PRIMARY KEY (guild_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      level_channel TEXT,
      log_channel TEXT,
      weekly_channel TEXT
    );

    CREATE TABLE IF NOT EXISTS rewards (
      guild_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      role_id TEXT NOT NULL,
      PRIMARY KEY (guild_id, level)
    );

    CREATE TABLE IF NOT EXISTS voice_sessions (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      join_time INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    );
  `);
  console.log('✅ Database initialized');
}

// --- User XP/Level ---
function getUser(guildId, userId) {
  return db.prepare(`
    SELECT * FROM users WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId) || createUser(guildId, userId);
}

function createUser(guildId, userId) {
  db.prepare(`
    INSERT OR IGNORE INTO users (guild_id, user_id) VALUES (?, ?)
  `).run(guildId, userId);
  return db.prepare(`SELECT * FROM users WHERE guild_id = ? AND user_id = ?`).get(guildId, userId);
}

function updateXP(guildId, userId, xpToAdd) {
  db.prepare(`
    INSERT INTO users (guild_id, user_id, xp, weekly_xp)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      xp = xp + excluded.xp,
      weekly_xp = weekly_xp + excluded.weekly_xp
  `).run(guildId, userId, xpToAdd, xpToAdd);
}

function setLevel(guildId, userId, level) {
  const xp = xpForLevel(level);
  db.prepare(`
    UPDATE users SET level = ?, xp = ? WHERE guild_id = ? AND user_id = ?
  `).run(level, xp, guildId, userId);
}

function incrementMessages(guildId, userId) {
  db.prepare(`
    INSERT INTO users (guild_id, user_id, messages)
    VALUES (?, ?, 1)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET messages = messages + 1
  `).run(guildId, userId);
}

function setLastMessage(guildId, userId, timestamp) {
  db.prepare(`UPDATE users SET last_message = ? WHERE guild_id = ? AND user_id = ?`)
    .run(timestamp, guildId, userId);
}

function updateLevel(guildId, userId, level) {
  db.prepare(`UPDATE users SET level = ? WHERE guild_id = ? AND user_id = ?`)
    .run(level, guildId, userId);
}

function addVoiceMinutes(guildId, userId, minutes) {
  db.prepare(`
    INSERT INTO users (guild_id, user_id, voice_minutes)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET voice_minutes = voice_minutes + ?
  `).run(guildId, userId, minutes, minutes);
}

function getLeaderboard(guildId, limit = 10, offset = 0) {
  return db.prepare(`
    SELECT * FROM users WHERE guild_id = ?
    ORDER BY xp DESC LIMIT ? OFFSET ?
  `).all(guildId, limit, offset);
}

function getTotalUsers(guildId) {
  return db.prepare(`SELECT COUNT(*) as count FROM users WHERE guild_id = ?`).get(guildId).count;
}

function getWeeklyLeaderboard(guildId) {
  return db.prepare(`
    SELECT * FROM users WHERE guild_id = ?
    ORDER BY weekly_xp DESC LIMIT 1
  `).get(guildId);
}

function resetWeeklyXP(guildId) {
  db.prepare(`UPDATE users SET weekly_xp = 0 WHERE guild_id = ?`).run(guildId);
}

// --- Guild Settings ---
function getGuildSettings(guildId) {
  return db.prepare(`SELECT * FROM guild_settings WHERE guild_id = ?`).get(guildId);
}

function setLevelChannel(guildId, channelId) {
  db.prepare(`
    INSERT INTO guild_settings (guild_id, level_channel)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET level_channel = ?
  `).run(guildId, channelId, channelId);
}

function setLogChannel(guildId, channelId) {
  db.prepare(`
    INSERT INTO guild_settings (guild_id, log_channel)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET log_channel = ?
  `).run(guildId, channelId, channelId);
}

function setWeeklyChannel(guildId, channelId) {
  db.prepare(`
    INSERT INTO guild_settings (guild_id, weekly_channel)
    VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET weekly_channel = ?
  `).run(guildId, channelId, channelId);
}

// --- Rewards ---
function setReward(guildId, level, roleId) {
  db.prepare(`
    INSERT INTO rewards (guild_id, level, role_id)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id, level) DO UPDATE SET role_id = ?
  `).run(guildId, level, roleId, roleId);
}

function getReward(guildId, level) {
  return db.prepare(`SELECT * FROM rewards WHERE guild_id = ? AND level = ?`).get(guildId, level);
}

function getAllRewards(guildId) {
  return db.prepare(`SELECT * FROM rewards WHERE guild_id = ? ORDER BY level ASC`).all(guildId);
}

// --- Voice Sessions ---
function startVoiceSession(guildId, userId) {
  db.prepare(`
    INSERT OR REPLACE INTO voice_sessions (guild_id, user_id, join_time)
    VALUES (?, ?, ?)
  `).run(guildId, userId, Date.now());
}

function endVoiceSession(guildId, userId) {
  const session = db.prepare(`
    SELECT * FROM voice_sessions WHERE guild_id = ? AND user_id = ?
  `).get(guildId, userId);
  if (session) {
    db.prepare(`DELETE FROM voice_sessions WHERE guild_id = ? AND user_id = ?`).run(guildId, userId);
    return Math.floor((Date.now() - session.join_time) / 60000);
  }
  return 0;
}

// --- XP Formula ---
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function xpToNextLevel(level) {
  return xpForLevel(level + 1);
}

module.exports = {
  initDatabase, db,
  getUser, createUser, updateXP, setLevel, incrementMessages,
  setLastMessage, updateLevel, addVoiceMinutes,
  getLeaderboard, getTotalUsers, getWeeklyLeaderboard, resetWeeklyXP,
  getGuildSettings, setLevelChannel, setLogChannel, setWeeklyChannel,
  setReward, getReward, getAllRewards,
  startVoiceSession, endVoiceSession,
  xpForLevel, xpToNextLevel,
};