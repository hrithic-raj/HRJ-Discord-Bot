const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    const settings = await getGuildSettings(newGuild.id);
    const logChannel = settings?.server_log_channel ? newGuild.channels.cache.get(settings.server_log_channel) : null;
    if (!logChannel) return;

    const changes = [];

    if (oldGuild.name !== newGuild.name)
      changes.push({ name: '📝 Server Name', value: `\`${oldGuild.name}\` → \`${newGuild.name}\``, inline: false });

    if (oldGuild.icon !== newGuild.icon)
      changes.push({ name: '🖼️ Server Icon', value: newGuild.iconURL() ? `[New Icon](${newGuild.iconURL({ size: 256 })})` : 'Removed', inline: true });

    if (oldGuild.banner !== newGuild.banner)
      changes.push({ name: '🏳️ Server Banner', value: newGuild.bannerURL() ? `[New Banner](${newGuild.bannerURL({ size: 512 })})` : 'Removed', inline: true });

    if (oldGuild.description !== newGuild.description)
      changes.push({ name: '📖 Description', value: `**Before:** ${oldGuild.description || '*None*'}\n**After:** ${newGuild.description || '*Removed*'}`, inline: false });

    if (oldGuild.verificationLevel !== newGuild.verificationLevel)
      changes.push({ name: '🛡️ Verification Level', value: `${oldGuild.verificationLevel} → ${newGuild.verificationLevel}`, inline: true });

    if (oldGuild.explicitContentFilter !== newGuild.explicitContentFilter)
      changes.push({ name: '🔍 Content Filter', value: `${oldGuild.explicitContentFilter} → ${newGuild.explicitContentFilter}`, inline: true });

    if (oldGuild.defaultMessageNotifications !== newGuild.defaultMessageNotifications)
      changes.push({ name: '🔔 Notifications', value: `${oldGuild.defaultMessageNotifications} → ${newGuild.defaultMessageNotifications}`, inline: true });

    if (oldGuild.afkChannelId !== newGuild.afkChannelId)
      changes.push({
        name: '😴 AFK Channel',
        value: `${oldGuild.afkChannel?.name ?? 'None'} → ${newGuild.afkChannel?.name ?? 'None'}`,
        inline: true,
      });

    if (oldGuild.rulesChannelId !== newGuild.rulesChannelId)
      changes.push({
        name: '📜 Rules Channel',
        value: `${oldGuild.rulesChannel ? `<#${oldGuild.rulesChannelId}>` : 'None'} → ${newGuild.rulesChannel ? `<#${newGuild.rulesChannelId}>` : 'None'}`,
        inline: true,
      });

    if (changes.length === 0) return;

    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await newGuild.fetchAuditLogs({ type: AuditLogEvent.GuildUpdate, limit: 3 });
      const entry = logs.entries.find(e => Date.now() - e.createdTimestamp < 5000);
      const executor = entry?.executor ?? null;

      const embed = new EmbedBuilder()
        .setColor(0xf0883e)
        .setTitle('🏠 Server Updated')
        .setThumbnail(newGuild.iconURL({ size: 64 }))
        .addFields(
          { name: 'Updated By', value: executor ? `<@${executor.id}>` : 'Unknown', inline: true },
          { name: '\u200b', value: '\u200b', inline: false },
          ...changes,
        )
        .setFooter({ text: `Server ID: ${newGuild.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (e) { console.error('guildUpdate log error:', e.message); }
  }
};
