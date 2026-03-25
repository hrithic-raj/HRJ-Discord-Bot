const cron = require('node-cron');
const { getWeeklyLeaderboard, resetWeeklyXP, getGuildSettings } = require('../database');
const { generateWeeklyWinnerCard } = require('./canvas');
const { AttachmentBuilder } = require('discord.js');

function scheduleWeeklyAnnouncement(client) {
  // Every Sunday at 11:55 PM
  cron.schedule('55 23 * * 0', async () => {
    console.log('Running weekly winner announcement...');

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        const settings = await getGuildSettings(guildId);
        if (!settings?.weekly_channel && !settings?.level_channel) continue;

        const channelId = settings.weekly_channel || settings.level_channel;
        const channel = guild.channels.cache.get(channelId);
        if (!channel) continue;

        const winner = await getWeeklyLeaderboard(guildId);
        if (!winner || winner.weekly_xp === 0) {
          await channel.send({
            embeds: [{
              color: 0x58a6ff,
              title: '📊 Weekly Wrap-up',
              description: 'No activity recorded this week. Be active for a chance to win next week!',
              footer: { text: 'LevelGuard • Weekly Reset' },
            }]
          });
          await resetWeeklyXP(guildId);
          continue;
        }

        let member;
        try {
          member = await guild.members.fetch(winner.user_id);
        } catch {
          await resetWeeklyXP(guildId);
          continue;
        }

        const imageBuffer = await generateWeeklyWinnerCard(member, winner, guild);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'weekly_winner.png' });

        await channel.send({
          content: `🎊 <@${winner.user_id}> is this week's **Most Active Member**! Congratulations!`,
          files: [attachment],
        });

        await resetWeeklyXP(guildId);
        console.log(`✅ Weekly winner announced for guild: ${guild.name}`);
      } catch (err) {
        console.error(`Weekly announcement error for guild ${guildId}:`, err.message);
      }
    }
  }, {
    timezone: 'UTC'
  });

  console.log('⏰ Weekly announcement scheduler started (Every Sunday 11:55 PM UTC)');
}

module.exports = { scheduleWeeklyAnnouncement };