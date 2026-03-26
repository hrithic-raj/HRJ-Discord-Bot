const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    const guild = ban.guild;
    const settings = await getGuildSettings(guild.id);
    const logChannel = settings?.member_log_channel ? guild.channels.cache.get(settings.member_log_channel) : null;
    if (!logChannel) return;

    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
      const entry = logs.entries.find(e => e.target?.id === ban.user.id && Date.now() - e.createdTimestamp < 5000);
      const executor = entry?.executor ?? null;

      const embed = new EmbedBuilder()
        .setColor(0xda3633)
        .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL({ size: 64 }) })
        .setTitle('🔨 Member Banned')
        .addFields(
          { name: 'User',     value: `<@${ban.user.id}> (${ban.user.tag})`, inline: true },
          { name: 'Banned By',value: executor ? `<@${executor.id}>` : 'Unknown', inline: true },
          { name: 'Reason',   value: entry?.reason ?? 'No reason provided', inline: false },
        )
        .setFooter({ text: `User ID: ${ban.user.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (e) { console.error('guildBanAdd log error:', e.message); }
  }
};
