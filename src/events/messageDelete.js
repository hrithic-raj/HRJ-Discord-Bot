const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild || message.author?.bot) return;

    const settings = await getGuildSettings(message.guild.id);
    const logChannel = settings?.chat_log_channel ? message.guild.channels.cache.get(settings.chat_log_channel) : null;
    if (!logChannel) return;

    // Try to find who deleted it via audit log
    let deletedBy = null;
    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await message.guild.fetchAuditLogs({ type: AuditLogEvent.MessageDelete, limit: 5 });
      const entry = logs.entries.find(e =>
        e.target?.id === message.author?.id &&
        Date.now() - e.createdTimestamp < 5000
      );
      if (entry) deletedBy = entry.executor;
    } catch {}

    const truncate = (str, len) => str && str.length > len ? str.substring(0, len) + '...' : str;

    const embed = new EmbedBuilder()
      .setColor(0xf85149)
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: 'Author',  value: message.author ? `<@${message.author.id}>` : 'Unknown', inline: true },
        { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
        {
          name: 'Deleted By',
          value: deletedBy
            ? `<@${deletedBy.id}> (moderator action)`
            : (message.author ? `<@${message.author.id}> (self-deleted)` : 'Unknown'),
          inline: true,
        },
      );

    if (message.content) {
      embed.addFields({ name: '📄 Content', value: truncate(message.content, 1000), inline: false });
    }

    if (message.attachments?.size > 0) {
      embed.addFields({
        name: '📎 Attachments',
        value: message.attachments.map(a => a.name).join(', '),
        inline: false,
      });
    }

    embed
      .setFooter({ text: `Message ID: ${message.id} • User ID: ${message.author?.id ?? 'Unknown'}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
};
