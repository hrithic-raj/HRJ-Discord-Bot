const mongoose = require('mongoose');

// ─── Schemas ───────────────────────────────────────────────

const userSchema = new mongoose.Schema({
  guild_id:      { type: String, required: true },
  user_id:       { type: String, required: true },
  xp:            { type: Number, default: 0 },
  level:         { type: Number, default: 0 },
  messages:      { type: Number, default: 0 },
  voice_minutes: { type: Number, default: 0 },
  last_message:  { type: Number, default: 0 },
  weekly_xp:     { type: Number, default: 0 },
});
userSchema.index({ guild_id: 1, user_id: 1 }, { unique: true });

const guildSettingsSchema = new mongoose.Schema({
  guild_id:          { type: String, required: true, unique: true },
  level_channel:     { type: String, default: null },
  voice_log_channel: { type: String, default: null },
  role_log_channel:  { type: String, default: null },
  weekly_channel:    { type: String, default: null },
});

const rewardSchema = new mongoose.Schema({
  guild_id: { type: String, required: true },
  level:    { type: Number, required: true },
  role_id:  { type: String, required: true },
});
rewardSchema.index({ guild_id: 1, level: 1 }, { unique: true });

const voiceSessionSchema = new mongoose.Schema({
  guild_id:  { type: String, required: true },
  user_id:   { type: String, required: true },
  join_time: { type: Number, required: true },
});
voiceSessionSchema.index({ guild_id: 1, user_id: 1 }, { unique: true });

// ─── Models ────────────────────────────────────────────────

const User          = mongoose.model('User', userSchema);
const GuildSettings = mongoose.model('GuildSettings', guildSettingsSchema);
const Reward        = mongoose.model('Reward', rewardSchema);
const VoiceSession  = mongoose.model('VoiceSession', voiceSessionSchema);

// ─── Connect ───────────────────────────────────────────────

async function initDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
}

// ─── XP Formula ────────────────────────────────────────────

function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.5));
}

function xpToNextLevel(level) {
  return xpForLevel(level + 1);
}

// ─── User helpers ──────────────────────────────────────────

async function getUser(guildId, userId) {
  return await User.findOneAndUpdate(
    { guild_id: guildId, user_id: userId },
    { $setOnInsert: { guild_id: guildId, user_id: userId } },
    { upsert: true, new: true }
  );
}

async function updateXP(guildId, userId, xpToAdd) {
  await User.findOneAndUpdate(
    { guild_id: guildId, user_id: userId },
    { $inc: { xp: xpToAdd, weekly_xp: xpToAdd } },
    { upsert: true }
  );
}

async function setLevel(guildId, userId, level) {
  const xp = xpForLevel(level);
  await User.findOneAndUpdate(
    { guild_id: guildId, user_id: userId },
    { $set: { level, xp } },
    { upsert: true }
  );
}

async function updateLevel(guildId, userId, level) {
  await User.findOneAndUpdate(
    { guild_id: guildId, user_id: userId },
    { $set: { level } },
    { upsert: true }
  );
}

async function incrementMessages(guildId, userId) {
  await User.findOneAndUpdate(
    { guild_id: guildId, user_id: userId },
    { $inc: { messages: 1 } },
    { upsert: true }
  );
}

async function setLastMessage(guildId, userId, timestamp) {
  await User.findOneAndUpdate(
    { guild_id: guildId, user_id: userId },
    { $set: { last_message: timestamp } },
    { upsert: true }
  );
}

async function addVoiceMinutes(guildId, userId, minutes) {
  await User.findOneAndUpdate(
    { guild_id: guildId, user_id: userId },
    { $inc: { voice_minutes: minutes } },
    { upsert: true }
  );
}

async function getLeaderboard(guildId, limit = 10, offset = 0) {
  return await User.find({ guild_id: guildId })
    .sort({ xp: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
}

async function getTotalUsers(guildId) {
  return await User.countDocuments({ guild_id: guildId });
}

async function getWeeklyLeaderboard(guildId) {
  return await User.findOne({ guild_id: guildId })
    .sort({ weekly_xp: -1 })
    .lean();
}

async function resetWeeklyXP(guildId) {
  await User.updateMany({ guild_id: guildId }, { $set: { weekly_xp: 0 } });
}

// ─── Guild Settings ────────────────────────────────────────

async function getGuildSettings(guildId) {
  return await GuildSettings.findOne({ guild_id: guildId }).lean();
}

async function setLevelChannel(guildId, channelId) {
  await GuildSettings.findOneAndUpdate(
    { guild_id: guildId },
    { $set: { level_channel: channelId } },
    { upsert: true }
  );
}

async function setVoiceLogChannel(guildId, channelId) {
  await GuildSettings.findOneAndUpdate(
    { guild_id: guildId },
    { $set: { voice_log_channel: channelId } },
    { upsert: true }
  );
}

async function setRoleLogChannel(guildId, channelId) {
  await GuildSettings.findOneAndUpdate(
    { guild_id: guildId },
    { $set: { role_log_channel: channelId } },
    { upsert: true }
  );
}

async function setWeeklyChannel(guildId, channelId) {
  await GuildSettings.findOneAndUpdate(
    { guild_id: guildId },
    { $set: { weekly_channel: channelId } },
    { upsert: true }
  );
}

// ─── Rewards ───────────────────────────────────────────────

async function setReward(guildId, level, roleId) {
  await Reward.findOneAndUpdate(
    { guild_id: guildId, level },
    { $set: { role_id: roleId } },
    { upsert: true }
  );
}

async function getReward(guildId, level) {
  return await Reward.findOne({ guild_id: guildId, level }).lean();
}

async function getAllRewards(guildId) {
  return await Reward.find({ guild_id: guildId }).sort({ level: 1 }).lean();
}

// ─── Voice Sessions ────────────────────────────────────────

async function startVoiceSession(guildId, userId) {
  await VoiceSession.findOneAndUpdate(
    { guild_id: guildId, user_id: userId },
    { $set: { join_time: Date.now() } },
    { upsert: true }
  );
}

async function endVoiceSession(guildId, userId) {
  const session = await VoiceSession.findOneAndDelete({
    guild_id: guildId,
    user_id: userId,
  });
  if (!session) return 0;
  return Math.floor((Date.now() - session.join_time) / 60000);
}

// ─── Exports ───────────────────────────────────────────────

module.exports = {
  initDatabase,
  getUser, updateXP, setLevel, updateLevel,
  incrementMessages, setLastMessage, addVoiceMinutes,
  getLeaderboard, getTotalUsers, getWeeklyLeaderboard, resetWeeklyXP,
  getGuildSettings, setLevelChannel, setVoiceLogChannel, setRoleLogChannel, setWeeklyChannel,
  setReward, getReward, getAllRewards,
  startVoiceSession, endVoiceSession,
  xpForLevel, xpToNextLevel,
};