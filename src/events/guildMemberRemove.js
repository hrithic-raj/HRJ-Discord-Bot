const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    const guild = member.guild;
    const settings = await getGuildSettings(guild.id);
    const logChannel = settings?.member_log_channel
      ? guild.channels.cache.get(settings.member_log_channel)
      : null;
    if (!logChannel) return;

    const avatarURL = member.displayAvatarURL({ size: 64 });

    try {
      // Wait for Discord audit log to register the action
      await new Promise(r => setTimeout(r, 1500));

      // ── Check for ban FIRST (ban fires guildMemberRemove too) ──
      // If there's a recent ban entry for this user, let guildBanAdd handle it
      const banLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 5 });
      const banEntry = banLogs.entries.find(
        e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 8000
      );
      if (banEntry) return; // guildBanAdd.js will log this

      // ── Check for kick ──────────────────────────────────────
      const kickLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 5 });
      const kickEntry = kickLogs.entries.find(
        e => e.target?.id === member.id && Date.now() - e.createdTimestamp < 8000
      );

      if (kickEntry) {
        const embed = new EmbedBuilder()
          .setColor(0xf0883e)
          .setAuthor({ name: member.displayName, iconURL: avatarURL })
          .setTitle('👢 Member Kicked')
          .addFields(
            { name: 'Member',    value: `<@${member.id}> (${member.user.tag})`,       inline: true },
            { name: 'Kicked By', value: `<@${kickEntry.executor.id}>`,                inline: true },
            { name: 'Reason',    value: kickEntry.reason ?? 'No reason provided', inline: false },
          )
          .setFooter({ text: `User ID: ${member.id}` })
          .setTimestamp();
        return await logChannel.send({ embeds: [embed] });
      }

      // ── Voluntary leave ─────────────────────────────────────
      const roles = member.roles.cache
        .filter(r => r.id !== guild.id)
        .map(r => `<@&${r.id}>`);

      const embed = new EmbedBuilder()
        .setColor(0x8b949e)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle('🚪 Member Left')
        .addFields(
          { name: 'Member', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          {
            name: 'Joined',
            value: member.joinedAt
              ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`
              : 'Unknown',
            inline: true,
          },
          {
            name: 'Roles',
            value: roles.length ? roles.join(', ').substring(0, 1000) : 'None',
            inline: false,
          },
        )
        .setFooter({ text: `User ID: ${member.id} • Members: ${guild.memberCount}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });

    } catch (e) { console.error('guildMemberRemove log error:', e.message); }
  }
};
