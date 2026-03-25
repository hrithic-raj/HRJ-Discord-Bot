const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { getGuildSettings, startVoiceSession, endVoiceSession } = require('../database');
const { handleVoiceXP } = require('../utils/levelSystem');

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
    if (!oldChannel && newChannel) {
      await startVoiceSession(guild.id, member.id);
    } else if (oldChannel && !newChannel) {
      const minutes = await endVoiceSession(guild.id, member.id);
      if (minutes > 0) await handleVoiceXP(guild, member.id, minutes, client);
    } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      const minutes = await endVoiceSession(guild.id, member.id);
      if (minutes > 0) await handleVoiceXP(guild, member.id, minutes, client);
      await startVoiceSession(guild.id, member.id);
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
          { name: 'Member',  value: `<@${member.id}>`,       inline: true },
          { name: 'Channel', value: `<#${newChannel.id}>`,   inline: true },
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
          { name: 'Member',  value: `<@${member.id}>`,       inline: true },
          { name: 'Channel', value: `<#${oldChannel.id}>`,   inline: true },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp(timestamp);
      await logChannel.send({ embeds: [embed] });
      return;
    }

    // ── Moved ──
    if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      // Check audit log to find who dragged this member
      let movedBy = null;
      try {
        // Small delay so audit log has time to register
        await new Promise(r => setTimeout(r, 1000));

        const auditLogs = await guild.fetchAuditLogs({
          type: AuditLogEvent.MemberMove,
          limit: 10,
        });

        // Find an entry targeting this member within the last 5 seconds
        const entry = auditLogs.entries.find(e => {
          const isRecent = Date.now() - e.createdTimestamp < 5000;
          // MemberMove entries don't always have a target user directly,
          // but the executor is who did the drag — we match by recency
          return isRecent;
        });

        if (entry && entry.executor && entry.executor.id !== member.id) {
          movedBy = entry.executor;
        }
      } catch (e) {
        // Missing Permissions for audit log — just skip
      }

      const embed = new EmbedBuilder()
        .setColor(0xf0883e)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle(movedBy ? '↔️ Voice Channel — Dragged to Another Channel' : '↔️ Voice Channel — Moved')
        .addFields(
          { name: 'Member', value: `<@${member.id}>`,     inline: true },
          { name: 'From',   value: `<#${oldChannel.id}>`, inline: true },
          { name: 'To',     value: `<#${newChannel.id}>`, inline: true },
        );

      if (movedBy) {
        embed.addFields({
          name: 'Dragged By',
          value: `<@${movedBy.id}> (${movedBy.username})`,
          inline: true,
        });
      } else {
        embed.addFields({
          name: 'Moved By',
          value: 'Self-moved',
          inline: true,
        });
      }

      embed
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp(timestamp);

      await logChannel.send({ embeds: [embed] });
    }
  }
};