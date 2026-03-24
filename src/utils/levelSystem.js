const {
  getUser, updateXP, updateLevel, getGuildSettings,
  getReward, xpForLevel, xpToNextLevel,
} = require('../database');
const { generateLevelUpCard } = require('./canvas');
const { AttachmentBuilder } = require('discord.js');

const XP_PER_MESSAGE = 15;
const XP_PER_VOICE_MINUTE = 5;
const MESSAGE_COOLDOWN_MS = 60 * 1000; // 1 minute cooldown between XP gains

async function handleMessageXP(message, client) {
  if (message.author.bot) return;
  const { guild, author } = message;

  const user = getUser(guild.id, author.id);
  const now = Date.now();

  // Cooldown to prevent spam
  if (now - (user.last_message || 0) < MESSAGE_COOLDOWN_MS) return;

  const xpGain = XP_PER_MESSAGE + Math.floor(Math.random() * 10);
  updateXP(guild.id, author.id, xpGain);

  // Update last message time
  const db = require('../database').db;
  db.prepare(`UPDATE users SET last_message = ? WHERE guild_id = ? AND user_id = ?`)
    .run(now, guild.id, author.id);

  await checkLevelUp(guild, author, user, client);
}

async function handleVoiceXP(guild, userId, minutes, client) {
  if (minutes <= 0) return;
  const user = getUser(guild.id, userId);
  const xpGain = minutes * XP_PER_VOICE_MINUTE;
  updateXP(guild.id, userId, xpGain);

  const db = require('../database').db;
  db.prepare(`UPDATE users SET voice_minutes = voice_minutes + ? WHERE guild_id = ? AND user_id = ?`)
    .run(minutes, guild.id, userId);

  await checkLevelUp(guild, { id: userId }, user, client);
}

async function checkLevelUp(guild, author, oldUserData, client) {
  const newUser = getUser(guild.id, author.id);
  const currentLevel = newUser.level;
  const newLevel = calculateLevel(newUser.xp);

  if (newLevel > currentLevel) {
    updateLevel(guild.id, author.id, newLevel);

    const settings = getGuildSettings(guild.id);
    if (!settings?.level_channel) return;

    const channel = guild.channels.cache.get(settings.level_channel);
    if (!channel) return;

    let member;
    try {
      member = await guild.members.fetch(author.id);
    } catch { return; }

    // Award role reward if exists
    const reward = getReward(guild.id, newLevel);
    let rewardRole = null;
    if (reward) {
      try {
        rewardRole = guild.roles.cache.get(reward.role_id);
        await member.roles.add(reward.role_id);
      } catch (e) {
        console.error('Could not assign reward role:', e.message);
      }
    }

    try {
      const imageBuffer = await generateLevelUpCard(member, currentLevel, newLevel, newUser.xp, guild);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'levelup.png' });

      await channel.send({
        content: `🎉 <@${author.id}>`,
        files: [attachment],
      });

      if (rewardRole) {
        await channel.send({
          embeds: [{
            color: 0xFFD700,
            description: `🏆 <@${author.id}> earned the **${rewardRole.name}** role for reaching Level **${newLevel}**!`,
            thumbnail: { url: member.displayAvatarURL({ size: 128 }) },
          }]
        });
      }
    } catch (e) {
      console.error('Level up card error:', e.message);
    }
  }
}

function calculateLevel(xp) {
  let level = 0;
  while (xp >= xpForLevel(level + 1)) {
    level++;
  }
  return level;
}

module.exports = { handleMessageXP, handleVoiceXP, checkLevelUp, calculateLevel };