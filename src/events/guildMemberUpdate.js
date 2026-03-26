const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings } = require('../database');

async function getAuditEntry(guild, type) {
  try {
    await new Promise(r => setTimeout(r, 800));
    const logs = await guild.fetchAuditLogs({ type, limit: 5 });
    return logs.entries.find(e => Date.now() - e.createdTimestamp < 5000) ?? null;
  } catch { return null; }
}

module.exports = {
  name: 'guildMemberUpdate',
  async execute(oldMember, newMember) {
    const guild = newMember.guild;
    const settings = await getGuildSettings(guild.id);
    const avatarURL = newMember.displayAvatarURL({ size: 64 });

    // ════════════════════════════════════════════════════════
    //  ROLE CHANGES  →  role_log_channel
    // ════════════════════════════════════════════════════════
    const roleLogChannel = settings?.role_log_channel
      ? guild.channels.cache.get(settings.role_log_channel)
      : null;

    if (roleLogChannel) {
      const added   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id) && r.id !== guild.id);
      const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id) && r.id !== guild.id);

      if (added.size > 0 || removed.size > 0) {
        const entry = await getAuditEntry(guild, AuditLogEvent.MemberRoleUpdate);
        const executor = entry?.executor ?? null;

        if (added.size > 0) {
          const embed = new EmbedBuilder()
            .setColor(0x3fb950)
            .setAuthor({ name: newMember.displayName, iconURL: avatarURL })
            .setTitle('✅ Role Added to Member')
            .addFields(
              { name: 'Member',      value: `<@${newMember.id}>`, inline: true },
              { name: 'Role(s)',     value: added.map(r => `<@&${r.id}>`).join(', '), inline: true },
              { name: 'Assigned By', value: executor ? `<@${executor.id}>` : 'Unknown', inline: true },
            )
            .setFooter({ text: `User ID: ${newMember.id}` })
            .setTimestamp();
          await roleLogChannel.send({ embeds: [embed] });
        }

        if (removed.size > 0) {
          const embed = new EmbedBuilder()
            .setColor(0xf85149)
            .setAuthor({ name: newMember.displayName, iconURL: avatarURL })
            .setTitle('❌ Role Removed from Member')
            .addFields(
              { name: 'Member',     value: `<@${newMember.id}>`, inline: true },
              { name: 'Role(s)',    value: removed.map(r => `<@&${r.id}>`).join(', '), inline: true },
              { name: 'Removed By', value: executor ? `<@${executor.id}>` : 'Unknown', inline: true },
            )
            .setFooter({ text: `User ID: ${newMember.id}` })
            .setTimestamp();
          await roleLogChannel.send({ embeds: [embed] });
        }
      }
    }

    // ════════════════════════════════════════════════════════
    //  MEMBER STATE CHANGES  →  member_log_channel
    //  NOTE: server mute/deafen are handled in voiceStateUpdate
    //  because guildMemberUpdate does NOT reliably fire for them.
    // ════════════════════════════════════════════════════════
    const memberLogChannel = settings?.member_log_channel
      ? guild.channels.cache.get(settings.member_log_channel)
      : null;

    if (!memberLogChannel) return;

    // ── Timeout ────────────────────────────────────────────
    const oldTimeout = oldMember.communicationDisabledUntil;
    const newTimeout = newMember.communicationDisabledUntil;
    const now = new Date();
    const wasTimedOut = oldTimeout && oldTimeout > now;
    const isTimedOut  = newTimeout && newTimeout > now;

    if (!wasTimedOut && isTimedOut) {
      const entry = await getAuditEntry(guild, AuditLogEvent.MemberUpdate);
      const embed = new EmbedBuilder()
        .setColor(0xf0883e)
        .setAuthor({ name: newMember.displayName, iconURL: avatarURL })
        .setTitle('⏱️ Member Timed Out')
        .addFields(
          { name: 'Member',   value: `<@${newMember.id}>`, inline: true },
          { name: 'Until',    value: `<t:${Math.floor(newTimeout.getTime() / 1000)}:F>`, inline: true },
          { name: 'Timed By', value: entry?.executor ? `<@${entry.executor.id}>` : 'Unknown', inline: true },
          { name: 'Reason',   value: entry?.reason ?? 'No reason provided', inline: false },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();
      await memberLogChannel.send({ embeds: [embed] });

    } else if (wasTimedOut && !isTimedOut) {
      const entry = await getAuditEntry(guild, AuditLogEvent.MemberUpdate);
      const embed = new EmbedBuilder()
        .setColor(0x3fb950)
        .setAuthor({ name: newMember.displayName, iconURL: avatarURL })
        .setTitle('✅ Timeout Removed')
        .addFields(
          { name: 'Member',     value: `<@${newMember.id}>`, inline: true },
          { name: 'Removed By', value: entry?.executor ? `<@${entry.executor.id}>` : 'Unknown', inline: true },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();
      await memberLogChannel.send({ embeds: [embed] });
    }

    // ── Nickname Change ────────────────────────────────────
    if (oldMember.nickname !== newMember.nickname) {
      const entry = await getAuditEntry(guild, AuditLogEvent.MemberUpdate);
      const embed = new EmbedBuilder()
        .setColor(0x58a6ff)
        .setAuthor({ name: newMember.displayName, iconURL: avatarURL })
        .setTitle('✏️ Nickname Changed')
        .addFields(
          { name: 'Member',       value: `<@${newMember.id}>`, inline: true },
          { name: 'Old Nickname', value: oldMember.nickname ?? '*None*', inline: true },
          { name: 'New Nickname', value: newMember.nickname ?? '*Removed*', inline: true },
          { name: 'Changed By',   value: entry?.executor ? `<@${entry.executor.id}>` : 'Unknown', inline: true },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();
      await memberLogChannel.send({ embeds: [embed] });
    }
  }
};
