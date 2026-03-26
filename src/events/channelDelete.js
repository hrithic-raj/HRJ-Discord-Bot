const { EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildSettings } = require('../database');

const CHANNEL_TYPES = {
  [ChannelType.GuildText]:        '💬 Text Channel',
  [ChannelType.GuildVoice]:       '🔊 Voice Channel',
  [ChannelType.GuildCategory]:    '📁 Category',
  [ChannelType.GuildAnnouncement]:'📢 Announcement',
  [ChannelType.GuildStageVoice]:  '🎙️ Stage',
  [ChannelType.GuildForum]:       '💬 Forum',
};

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild) return;
    const guild = channel.guild;
    const settings = await getGuildSettings(guild.id);
    const logChannel = settings?.channel_log_channel ? guild.channels.cache.get(settings.channel_log_channel) : null;
    if (!logChannel) return;

    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 3 });
      const entry = logs.entries.find(e => e.target?.id === channel.id);
      const executor = entry?.executor ?? null;

      const embed = new EmbedBuilder()
        .setColor(0xf85149)
        .setTitle('🗑️ Channel Deleted')
        .addFields(
          { name: 'Channel Name', value: `\`#${channel.name}\``,                      inline: true },
          { name: 'Type',         value: CHANNEL_TYPES[channel.type] ?? 'Unknown',     inline: true },
          { name: 'Category',     value: channel.parent?.name ?? 'None',               inline: true },
          { name: 'Deleted By',   value: executor ? `<@${executor.id}>` : 'Unknown',   inline: true },
        )
        .setFooter({ text: `Channel ID: ${channel.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (e) { console.error('channelDelete log error:', e.message); }
  }
};
