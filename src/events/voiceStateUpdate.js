const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings, startVoiceSession, endVoiceSession } = require('../database');
const { handleVoiceXP } = require('../utils/levelSystem');

// Returns true if this member should currently earn XP in their voice channel
function shouldEarnXP(member, channel, guild) {
  if (!channel) return false;

  // No XP if muted or deafened (self or server)
  const vs = member.voice;
  if (vs.selfMute || vs.serverMute) return false;
  if (vs.selfDeaf || vs.serverDeaf) return false;

  // No XP in AFK channel
  if (guild.afkChannelId && channel.id === guild.afkChannelId) return false;

  // Count real (non-bot) members in the channel
  const realMembers = channel.members.filter(m => !m.user.bot);
  if (realMembers.size < 2) return false;

  return true;
}

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // ─── XP Tracking ───────────────────────────────────────
    // We only award XP for time spent in a valid channel.
    // "Valid" = not muted, not deafened, not AFK channel, 2+ real members.
    //
    // Edge cases handled:
    // - Mute/unmute while staying in same channel → end/start session
    // - Moving channels → end old session (award if valid), start new
    // - Leaving → end session, award if the OLD channel was valid

    const wasEligible = oldChannel ? shouldEarnXP(oldState.member ?? member, oldChannel, guild) : false;
    const nowEligible = newChannel ? shouldEarnXP(member, newChannel, guild) : false;

    if (!oldChannel && newChannel) {
      // Joined voice
      if (nowEligible) await startVoiceSession(guild.id, member.id);

    } else if (oldChannel && !newChannel) {
      // Left voice — end session and award if they were eligible
      if (wasEligible) {
        const minutes = await endVoiceSession(guild.id, member.id);
        if (minutes > 0) await handleVoiceXP(guild, member.id, minutes, client);
      } else {
        await endVoiceSession(guild.id, member.id); // clean up even if no XP
      }

    } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      // Moved to different channel
      if (wasEligible) {
        const minutes = await endVoiceSession(guild.id, member.id);
        if (minutes > 0) await handleVoiceXP(guild, member.id, minutes, client);
      } else {
        await endVoiceSession(guild.id, member.id);
      }
      if (nowEligible) await startVoiceSession(guild.id, member.id);

    } else if (oldChannel && newChannel && oldChannel.id === newChannel.id) {
      // Stayed in same channel but state changed (mute/unmute/deafen)
      if (wasEligible && !nowEligible) {
        // Was earning XP, now shouldn't — end session and award
        const minutes = await endVoiceSession(guild.id, member.id);
        if (minutes > 0) await handleVoiceXP(guild, member.id, minutes, client);
      } else if (!wasEligible && nowEligible) {
        // Wasn't earning XP, now should — start session
        await startVoiceSession(guild.id, member.id);
      }
    }

    // ─── Logging ───────────────────────────────────────────
    const settings = await getGuildSettings(guild.id);
    const voiceLogChannelId = settings?.voice_log_channel;
    if (!voiceLogChannelId) return;

    const logChannel = guild.channels.cache.get(voiceLogChannelId);
    if (!logChannel) return;

    const avatarURL = member.displayAvatarURL({ size: 64 });
    const timestamp = new Date();

    // ── Joined ──
    if (!oldChannel && newChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x3fb950)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle('🎙️ Voice Channel — Joined')
        .addFields(
          { name: 'Member',  value: `<@${member.id}>`,     inline: true },
          { name: 'Channel', value: `<#${newChannel.id}>`, inline: true },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp(timestamp);
      await logChannel.send({ embeds: [embed] });
      return;
    }

    // ── Left ──
    if (oldChannel && !newChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xf85149)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle('🔇 Voice Channel — Left')
        .addFields(
          { name: 'Member',  value: `<@${member.id}>`,     inline: true },
          { name: 'Channel', value: `<#${oldChannel.id}>`, inline: true },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp(timestamp);
      await logChannel.send({ embeds: [embed] });
      return;
    }

    // ── Moved ──
    if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      let movedBy = null;
      try {
        await new Promise(r => setTimeout(r, 800));
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberMove, limit: 5 });
        const entry = auditLogs.entries.find(e =>
          Date.now() - e.createdTimestamp < 5000 &&
          e.executor?.id !== member.id
        );
        if (entry) movedBy = entry.executor;
      } catch {}

      const embed = new EmbedBuilder()
        .setColor(0xf0883e)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle(movedBy ? '↔️ Voice Channel — Dragged' : '↔️ Voice Channel — Moved')
        .addFields(
          { name: 'Member', value: `<@${member.id}>`,     inline: true },
          { name: 'From',   value: `<#${oldChannel.id}>`, inline: true },
          { name: 'To',     value: `<#${newChannel.id}>`, inline: true },
        );

      if (movedBy) embed.addFields({ name: 'Dragged By', value: `<@${movedBy.id}>`, inline: true });
      embed.setFooter({ text: `User ID: ${member.id}` }).setTimestamp(timestamp);
      await logChannel.send({ embeds: [embed] });
    }

    // ── Server Mute / Deafen (fires here, not in guildMemberUpdate) ──
    // These changes appear as voiceStateUpdate because they affect voice state,
    // not the member object itself.
    const memberLogChannelId = settings?.member_log_channel;
    const memberLogChannel = memberLogChannelId
      ? guild.channels.cache.get(memberLogChannelId)
      : null;

    if (memberLogChannel) {
      // Server Mute
      if (oldState.serverMute !== newState.serverMute) {
        const muted = newState.serverMute;
        let mutedBy = null;
        try {
          await new Promise(r => setTimeout(r, 800));
          const logs = await guild.fetchAuditLogs({ type: 24, limit: 5 }); // MemberUpdate
          const entry = logs.entries.find(e =>
            e.target?.id === member.id && Date.now() - e.createdTimestamp < 5000
          );
          mutedBy = entry?.executor ?? null;
        } catch {}

        const muteEmbed = new EmbedBuilder()
          .setColor(muted ? 0xf85149 : 0x3fb950)
          .setAuthor({ name: member.displayName, iconURL: avatarURL })
          .setTitle(muted ? '🔇 Member Server Muted' : '🔊 Member Server Unmuted')
          .addFields(
            { name: 'Member', value: `<@${member.id}>`, inline: true },
            { name: muted ? 'Muted By' : 'Unmuted By', value: mutedBy ? `<@${mutedBy.id}>` : 'Unknown', inline: true },
          )
          .setFooter({ text: `User ID: ${member.id}` })
          .setTimestamp(timestamp);
        await memberLogChannel.send({ embeds: [muteEmbed] });
      }

      // Server Deafen
      if (oldState.serverDeaf !== newState.serverDeaf) {
        const deafened = newState.serverDeaf;
        let deafenedBy = null;
        try {
          await new Promise(r => setTimeout(r, 800));
          const logs = await guild.fetchAuditLogs({ type: 24, limit: 5 }); // MemberUpdate
          const entry = logs.entries.find(e =>
            e.target?.id === member.id && Date.now() - e.createdTimestamp < 5000
          );
          deafenedBy = entry?.executor ?? null;
        } catch {}

        const deafEmbed = new EmbedBuilder()
          .setColor(deafened ? 0xf85149 : 0x3fb950)
          .setAuthor({ name: member.displayName, iconURL: avatarURL })
          .setTitle(deafened ? '🔕 Member Server Deafened' : '🔔 Member Server Undeafened')
          .addFields(
            { name: 'Member', value: `<@${member.id}>`, inline: true },
            { name: deafened ? 'Deafened By' : 'Undeafened By', value: deafenedBy ? `<@${deafenedBy.id}>` : 'Unknown', inline: true },
          )
          .setFooter({ text: `User ID: ${member.id}` })
          .setTimestamp(timestamp);
        await memberLogChannel.send({ embeds: [deafEmbed] });
      }
    }
  }
};
