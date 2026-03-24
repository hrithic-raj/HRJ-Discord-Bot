const { EmbedBuilder } = require('discord.js');
const { getGuildSettings, startVoiceSession, endVoiceSession } = require('../database');
const { handleVoiceXP } = require('../utils/levelSystem');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const settings = await getGuildSettings(guild.id);
    const logChannelId = settings?.log_channel;
    const logChannel = logChannelId ? guild.channels.cache.get(logChannelId) : null;

    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // ─── XP Tracking ───
    if (!oldChannel && newChannel) {
      // Joined voice
      await startVoiceSession(guild.id, member.id);
    } else if (oldChannel && !newChannel) {
      // Left voice
      const minutes = await endVoiceSession(guild.id, member.id);
      if (minutes > 0) {
        await handleVoiceXP(guild, member.id, minutes, client);
      }
    } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      // Moved — credit time in old channel, start new session
      const minutes = await endVoiceSession(guild.id, member.id);
      if (minutes > 0) {
        await handleVoiceXP(guild, member.id, minutes, client);
      }
      await startVoiceSession(guild.id, member.id);
    }

    // ─── Logging ───
    if (!logChannel) return;

    const avatarURL = member.displayAvatarURL({ size: 64 });
    const timestamp = new Date();

    if (!oldChannel && newChannel) {
      // Joined
      const embed = new EmbedBuilder()
        .setColor(0x3fb950)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle('🎙️ Voice Channel — Joined')
        .addFields(
          { name: 'Member', value: `<@${member.id}>`, inline: true },
          { name: 'Channel', value: `<#${newChannel.id}>`, inline: true },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp(timestamp);
      await logChannel.send({ embeds: [embed] });

    } else if (oldChannel && !newChannel) {
      // Left
      const embed = new EmbedBuilder()
        .setColor(0xf85149)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle('🔇 Voice Channel — Left')
        .addFields(
          { name: 'Member', value: `<@${member.id}>`, inline: true },
          { name: 'Channel', value: `<#${oldChannel.id}>`, inline: true },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp(timestamp);
      await logChannel.send({ embeds: [embed] });

    } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      // Detect if dragged by someone else (check audit log)
      let movedBy = null;
      try {
        await new Promise(r => setTimeout(r, 800)); // wait for audit log
        const auditLogs = await guild.fetchAuditLogs({ type: 26, limit: 5 }); // MEMBER_MOVE
        const entry = auditLogs.entries.first();
        if (entry && entry.target?.id === member.id && (Date.now() - entry.createdTimestamp) < 3000) {
          movedBy = entry.executor;
        }
      } catch {}

      const embed = new EmbedBuilder()
        .setColor(0xf0883e)
        .setAuthor({ name: member.displayName, iconURL: avatarURL })
        .setTitle(movedBy ? '↔️ Voice Channel — Moved (Dragged)' : '↔️ Voice Channel — Moved')
        .addFields(
          { name: 'Member', value: `<@${member.id}>`, inline: true },
          { name: 'From', value: `<#${oldChannel.id}>`, inline: true },
          { name: 'To', value: `<#${newChannel.id}>`, inline: true },
        );

      if (movedBy) {
        embed.addFields({ name: 'Moved By', value: `<@${movedBy.id}>`, inline: true });
      }

      embed
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp(timestamp);

      await logChannel.send({ embeds: [embed] });
    }
  }
};