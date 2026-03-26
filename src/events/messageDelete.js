const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'messageDelete',
  async execute(message) {
    if (!message.guild) return;
    // Skip bots
    if (message.author?.bot) return;

    const settings = await getGuildSettings(message.guild.id);
    const logChannel = settings?.chat_log_channel
      ? message.guild.channels.cache.get(settings.chat_log_channel)
      : null;
    if (!logChannel) return;

    // ── Find who deleted it via audit log ───────────────────
    // Discord only creates an audit log entry when a MODERATOR deletes someone else's message.
    // Self-deletes don't appear in the audit log at all.
    let deletedBy = null;
    let deletedBySelf = false;

    try {
      await new Promise(r => setTimeout(r, 1000));
      const logs = await message.guild.fetchAuditLogs({
        type: AuditLogEvent.MessageDelete,
        limit: 5,
      });

      const entry = logs.entries.find(e => {
        const isRecent = Date.now() - e.createdTimestamp < 8000;
        // Match by target (the message author) and channel
        const targetMatch = e.target?.id === message.author?.id;
        const channelMatch = e.extra?.channel?.id === message.channelId;
        return isRecent && targetMatch && channelMatch;
      });

      if (entry) {
        // Someone else deleted it
        deletedBy = entry.executor;
      } else {
        // No audit log entry = author deleted their own message
        deletedBySelf = true;
      }
    } catch {}

    const truncate = (str, len) => str && str.length > len ? str.substring(0, len - 3) + '...' : str;

    // Who authored the message
    const authorText = message.author
      ? `<@${message.author.id}> (${message.author.tag})`
      : '*Unknown (message not cached)*';

    // Who deleted it
    let deletedByText;
    if (deletedBy) {
      deletedByText = `<@${deletedBy.id}> (moderator)`;
    } else if (deletedBySelf && message.author) {
      deletedByText = `<@${message.author.id}> (self-deleted)`;
    } else {
      deletedByText = 'Unknown';
    }

    const embed = new EmbedBuilder()
      .setColor(0xf85149)
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: 'Author',     value: authorText,    inline: true },
        { name: 'Channel',    value: `<#${message.channelId}>`, inline: true },
        { name: 'Deleted By', value: deletedByText, inline: true },
      );

    if (message.content) {
      embed.addFields({
        name: '📄 Content',
        value: '```\n' + truncate(message.content, 990) + '\n```',
        inline: false,
      });
    } else {
      embed.addFields({
        name: '📄 Content',
        value: '*Message content not available (not in cache)*',
        inline: false,
      });
    }

    if (message.attachments?.size > 0) {
      embed.addFields({
        name: '📎 Attachments',
        value: message.attachments.map(a => `[${a.name}](${a.url})`).join('\n'),
        inline: false,
      });
    }

    embed.setFooter({
      text: `Msg ID: ${message.id}` + (message.author ? ` • User ID: ${message.author.id}` : ''),
    }).setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
};
