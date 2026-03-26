const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;
    if (!oldMessage.content || !newMessage.content) return;
    if (oldMessage.content === newMessage.content) return;

    const settings = await getGuildSettings(newMessage.guild.id);
    const logChannel = settings?.chat_log_channel
      ? newMessage.guild.channels.cache.get(settings.chat_log_channel)
      : null;
    if (!logChannel) return;

    // Truncate long messages
    const truncate = (str, len) => str.length > len ? str.substring(0, len - 3) + '...' : str;

    const embed = new EmbedBuilder()
      .setColor(0xf0883e)
      .setAuthor({
        name: newMessage.author?.tag ?? 'Unknown',
        iconURL: newMessage.author?.displayAvatarURL({ size: 64 }) ?? undefined,
      })
      .setTitle('✏️ Message Edited')
      .addFields(
        { name: 'Author',  value: `<@${newMessage.author?.id}>`, inline: true },
        { name: 'Channel', value: `<#${newMessage.channelId}>`,  inline: true },
        { name: '🔗 Jump', value: `[View Message](${newMessage.url})`, inline: true },
        {
          name: '📄 Before',
          // Wrap in code block so Discord shows copy button
          value: '```\n' + truncate(oldMessage.content, 990) + '\n```',
          inline: false,
        },
        {
          name: '📄 After',
          value: '```\n' + truncate(newMessage.content, 990) + '\n```',
          inline: false,
        },
      )
      .setFooter({ text: `User ID: ${newMessage.author?.id} • Msg ID: ${newMessage.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  }
};
