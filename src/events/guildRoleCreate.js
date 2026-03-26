const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'roleCreate',
  async execute(role) {
    const guild = role.guild;
    const settings = await getGuildSettings(guild.id);
    const channel = settings?.role_log_channel ? guild.channels.cache.get(settings.role_log_channel) : null;
    if (!channel) return;

    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 3 });
      const entry = logs.entries.find(e => e.target?.id === role.id);
      const executor = entry?.executor ?? null;

      const perms = role.permissions.toArray();
      const keyPerms = ['Administrator','ManageGuild','ManageRoles','ManageChannels','BanMembers','KickMembers','ManageMessages'];
      const highlighted = perms.filter(p => keyPerms.includes(p));

      const embed = new EmbedBuilder()
        .setColor(role.color || 0x58a6ff)
        .setTitle('🎨 Role Created')
        .addFields(
          { name: 'Role',       value: `<@&${role.id}> (${role.name})`, inline: true },
          { name: 'Color',      value: role.hexColor,                   inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: 'Hoisted',    value: role.hoist ? 'Yes' : 'No',       inline: true },
          { name: 'Created By', value: executor ? `<@${executor.id}>` : 'Unknown', inline: true },
          { name: 'Key Perms',  value: highlighted.length ? highlighted.join(', ') : 'None', inline: false },
        )
        .setFooter({ text: `Role ID: ${role.id}` })
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    } catch (e) { console.error('roleCreate log error:', e.message); }
  }
};
