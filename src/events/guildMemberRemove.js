const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const guild = member.guild;
    const settings = await getGuildSettings(guild.id);
    const logChannel = settings?.member_log_channel ? guild.channels.cache.get(settings.member_log_channel) : null;
    if (!logChannel) return;

    const avatarURL = member.displayAvatarURL({ size: 64 });

    try {
      await new Promise(r => setTimeout(r, 1000));

      // Check if this was a kick via audit log
      const kickLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
      const kickEntry = kickLogs.entries.find(
        e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 5000
      );

      if (kickEntry) {
        // It was a kick
        const embed = new EmbedBuilder()
          .setColor(0xf0883e)
          .setAuthor({ name: member.displayName, iconURL: avatarURL })
          .setTitle('👢 Member Kicked')
          .addFields(
            { name: 'Member',    value: `<@${member.id}> (${member.user.tag})`, inline: true },
            { name: 'Kicked By', value: `<@${kickEntry.executor.id}>`,          inline: true },
            { name: 'Reason',    value: kickEntry.reason ?? 'No reason provided', inline: false },
          )
          .setFooter({ text: `User ID: ${member.id}` })
          .setTimestamp();
        return await logChannel.send({ embeds: [embed] });
      }

      // Check if this was a ban (ban event handles the main log, but member leaves first)
      const banLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
      const banEntry = banLogs.entries.find(
        e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 5000
      );
      if (banEntry) return; // Ban event (guildBanAdd) will handle this

      // Otherwise it was a voluntary leave
      const roles = member.roles.cache.filter(r => r.id !== guild.id).map(r => `<@&${r.id}>`);
      const embed = new EmbedBuilder()
        .setColor(0x8b949e)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle('🚪 Member Left')
        .addFields(
          { name: 'Member',   value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Joined',   value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Unknown', inline: true },
          { name: 'Roles',    value: roles.length ? roles.join(', ').substring(0, 1000) : 'None', inline: false },
        )
        .setFooter({ text: `User ID: ${member.id} • Members: ${guild.memberCount}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (e) { console.error('guildMemberRemove log error:', e.message); }
  }
};
