const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'roleDelete',
  async execute(role) {
    const guild = role.guild;
    const settings = await getGuildSettings(guild.id);
    const channel = settings?.role_log_channel ? guild.channels.cache.get(settings.role_log_channel) : null;
    if (!channel) return;

    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 3 });
      const entry = logs.entries.find(e => e.target?.id === role.id);
      const executor = entry?.executor ?? null;

      const embed = new EmbedBuilder()
        .setColor(0xf85149)
        .setTitle('🗑️ Role Deleted')
        .addFields(
          { name: 'Role Name',  value: `\`${role.name}\``,                         inline: true },
          { name: 'Color',      value: role.hexColor,                               inline: true },
          { name: 'Deleted By', value: executor ? `<@${executor.id}>` : 'Unknown', inline: true },
        )
        .setFooter({ text: `Role ID: ${role.id}` })
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    } catch (e) { console.error('roleDelete log error:', e.message); }
  }
};
