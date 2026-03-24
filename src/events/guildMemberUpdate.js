const { EmbedBuilder } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember, client) {
    const guild = newMember.guild;
    const settings = getGuildSettings(guild.id);
    if (!settings?.log_channel) return;

    const logChannel = guild.channels.cache.get(settings.log_channel);
    if (!logChannel) return;

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const addedRoles = newRoles.filter(r => !oldRoles.has(r.id) && r.id !== guild.id);
    const removedRoles = oldRoles.filter(r => !newRoles.has(r.id) && r.id !== guild.id);

    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const avatarURL = newMember.displayAvatarURL({ size: 64 });

    // Fetch audit logs to find who made the change
    let executor = null;
    try {
      await new Promise(r => setTimeout(r, 800));
      const auditLogs = await guild.fetchAuditLogs({ type: 25, limit: 5 }); // MEMBER_ROLE_UPDATE
      const entry = auditLogs.entries.find(e =>
        e.target?.id === newMember.id && (Date.now() - e.createdTimestamp) < 4000
      );
      if (entry) executor = entry.executor;
    } catch {}

    if (addedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setColor(0x3fb950)
        .setAuthor({ name: newMember.displayName, iconURL: avatarURL })
        .setTitle('✅ Role Added')
        .addFields(
          { name: 'Member', value: `<@${newMember.id}>`, inline: true },
          { name: 'Role(s) Added', value: addedRoles.map(r => `<@&${r.id}>`).join(', '), inline: true },
        );

      if (executor) {
        embed.addFields({ name: 'Assigned By', value: `<@${executor.id}>`, inline: true });
      }

      embed
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }

    if (removedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setColor(0xf85149)
        .setAuthor({ name: newMember.displayName, iconURL: avatarURL })
        .setTitle('❌ Role Removed')
        .addFields(
          { name: 'Member', value: `<@${newMember.id}>`, inline: true },
          { name: 'Role(s) Removed', value: removedRoles.map(r => `<@&${r.id}>`).join(', '), inline: true },
        );

      if (executor) {
        embed.addFields({ name: 'Removed By', value: `<@${executor.id}>`, inline: true });
      }

      embed
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] });
    }
  }
};