const { EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel) {
    if (!newChannel.guild) return;
    const guild = newChannel.guild;
    const settings = await getGuildSettings(guild.id);
    const logChannel = settings?.channel_log_channel ? guild.channels.cache.get(settings.channel_log_channel) : null;
    if (!logChannel) return;

    const changes = [];

    if (oldChannel.name !== newChannel.name)
      changes.push({ name: '📝 Name', value: `\`${oldChannel.name}\` → \`${newChannel.name}\``, inline: true });

    if (oldChannel.topic !== newChannel.topic)
      changes.push({
        name: '📌 Topic',
        value: `**Before:** ${oldChannel.topic || '*None*'}\n**After:** ${newChannel.topic || '*Removed*'}`,
        inline: false,
      });

    if (oldChannel.nsfw !== newChannel.nsfw)
      changes.push({ name: '🔞 NSFW', value: `${oldChannel.nsfw} → ${newChannel.nsfw}`, inline: true });

    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser)
      changes.push({
        name: '🐌 Slowmode',
        value: `${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`,
        inline: true,
      });

    if (oldChannel.parentId !== newChannel.parentId)
      changes.push({
        name: '📁 Category Moved',
        value: `${oldChannel.parent?.name ?? 'None'} → ${newChannel.parent?.name ?? 'None'}`,
        inline: true,
      });

    if (oldChannel.position !== newChannel.position)
      changes.push({ name: '↕️ Position', value: `${oldChannel.position} → ${newChannel.position}`, inline: true });

    // Voice-specific
    if (newChannel.type === ChannelType.GuildVoice) {
      if (oldChannel.bitrate !== newChannel.bitrate)
        changes.push({ name: '🎵 Bitrate', value: `${oldChannel.bitrate / 1000}kbps → ${newChannel.bitrate / 1000}kbps`, inline: true });
      if (oldChannel.userLimit !== newChannel.userLimit)
        changes.push({ name: '👥 User Limit', value: `${oldChannel.userLimit || '∞'} → ${newChannel.userLimit || '∞'}`, inline: true });
    }

    if (changes.length === 0) return;

    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 5 });
      const entry = logs.entries.find(e => e.target?.id === newChannel.id && Date.now() - e.createdTimestamp < 5000);
      const executor = entry?.executor ?? null;

      const embed = new EmbedBuilder()
        .setColor(0xf0883e)
        .setTitle('✏️ Channel Updated')
        .addFields(
          { name: 'Channel',    value: `<#${newChannel.id}> (${newChannel.name})`, inline: true },
          { name: 'Updated By', value: executor ? `<@${executor.id}>` : 'Unknown',  inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          ...changes,
        )
        .setFooter({ text: `Channel ID: ${newChannel.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (e) { console.error('channelUpdate log error:', e.message); }
  }
};
