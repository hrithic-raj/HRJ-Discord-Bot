const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    const guild = newRole.guild;
    const settings = await getGuildSettings(guild.id);
    const channel = settings?.role_log_channel ? guild.channels.cache.get(settings.role_log_channel) : null;
    if (!channel) return;

    const changes = [];

    if (oldRole.name !== newRole.name)
      changes.push({ name: '📝 Name', value: `\`${oldRole.name}\` → \`${newRole.name}\``, inline: true });

    if (oldRole.color !== newRole.color)
      changes.push({ name: '🎨 Color', value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\``, inline: true });

    if (oldRole.hoist !== newRole.hoist)
      changes.push({ name: '📌 Hoisted', value: `${oldRole.hoist} → ${newRole.hoist}`, inline: true });

    if (oldRole.mentionable !== newRole.mentionable)
      changes.push({ name: '🔔 Mentionable', value: `${oldRole.mentionable} → ${newRole.mentionable}`, inline: true });

    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      const oldPerms = oldRole.permissions.toArray();
      const newPerms = newRole.permissions.toArray();
      const granted = newPerms.filter(p => !oldPerms.includes(p));
      const revoked = oldPerms.filter(p => !newPerms.includes(p));
      if (granted.length) changes.push({ name: '✅ Permissions Granted', value: granted.join(', '), inline: false });
      if (revoked.length) changes.push({ name: '❌ Permissions Revoked', value: revoked.join(', '), inline: false });
    }

    if (changes.length === 0) return;

    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 3 });
      const entry = logs.entries.find(e => e.target?.id === newRole.id && Date.now() - e.createdTimestamp < 5000);
      const executor = entry?.executor ?? null;

      const embed = new EmbedBuilder()
        .setColor(newRole.color || 0xf0883e)
        .setTitle('✏️ Role Updated')
        .addFields(
          { name: 'Role',       value: `<@&${newRole.id}> (${newRole.name})`, inline: true },
          { name: 'Updated By', value: executor ? `<@${executor.id}>` : 'Unknown', inline: true },
          { name: '\u200b', value: '\u200b', inline: true },
          ...changes,
        )
        .setFooter({ text: `Role ID: ${newRole.id}` })
        .setTimestamp();
      await channel.send({ embeds: [embed] });
    } catch (e) { console.error('roleUpdate log error:', e.message); }
  }
};
