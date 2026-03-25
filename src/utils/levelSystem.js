const {
  getUser, updateXP, updateLevel, getGuildSettings,
  getReward, xpForLevel, setLastMessage, addVoiceMinutes,
} = require('../database');
const { generateLevelUpCard } = require('./canvas');
const { AttachmentBuilder } = require('discord.js');

const XP_PER_MESSAGE = 10;
const XP_PER_VOICE_MINUTE = 2;
const MESSAGE_COOLDOWN_MS = 60 * 1000;

async function handleMessageXP(message, client) {
  if (message.author.bot) return;
  const { guild, author } = message;

  const user = await getUser(guild.id, author.id);
  const now = Date.now();

  // Cooldown to prevent spam
  if (now - (user.last_message || 0) < MESSAGE_COOLDOWN_MS) return;

  const xpGain = XP_PER_MESSAGE + Math.floor(Math.random() * 10);
  await updateXP(guild.id, author.id, xpGain);
  await setLastMessage(guild.id, author.id, now);

  await checkLevelUp(guild, author, user, client);
}

async function handleVoiceXP(guild, userId, minutes, client) {
  if (minutes <= 0) return;
  const user = await getUser(guild.id, userId);
  const xpGain = minutes * XP_PER_VOICE_MINUTE;
  await updateXP(guild.id, userId, xpGain);
  await addVoiceMinutes(guild.id, userId, minutes);

  await checkLevelUp(guild, { id: userId }, user, client);
}

async function checkLevelUp(guild, author, oldUserData, client) {
  const newUser = await getUser(guild.id, author.id);
  const currentLevel = oldUserData.level;
  const newLevel = calculateLevel(newUser.xp);

  if (newLevel > currentLevel) {
    await updateLevel(guild.id, author.id, newLevel);

    const settings = await getGuildSettings(guild.id);
    if (!settings?.level_channel) return;

    const channel = guild.channels.cache.get(settings.level_channel);
    if (!channel) return;

    let member;
    try {
      member = await guild.members.fetch(author.id);
    } catch { return; }

    // Award role reward if exists
    const reward = await getReward(guild.id, newLevel);
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
        content: `<@${author.id}>`,
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