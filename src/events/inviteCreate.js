const { EmbedBuilder } = require('discord.js');
const { upsertInvite, getGuildSettings } = require('../database');

module.exports = {
  name: 'inviteCreate',
  async execute(invite, client) {
    if (!invite.guild) return;

    // ── Save invite to DB snapshot ──────────────────────────
    try {
      await upsertInvite(
        invite.guild.id,
        invite.inviter?.id ?? null,
        invite.code,
        invite.uses ?? 0
      );
      console.log(`📨 Cached new invite: ${invite.code} by ${invite.inviter?.tag ?? 'unknown'}`);
    } catch (e) {
      console.error('inviteCreate cache error:', e.message);
    }

    // ── Send log embed ──────────────────────────────────────
    try {
      const settings = await getGuildSettings(invite.guild.id);
      const channelId = settings?.invite_log_channel;
      if (!channelId) return;

      const channel = invite.guild.channels.cache.get(channelId);
      if (!channel) return;

      // Resolve expiry
      let expiryText = 'Never';
      if (invite.maxAge && invite.maxAge > 0) {
        const expiresAt = Math.floor((Date.now() + invite.maxAge * 1000) / 1000);
        expiryText = `<t:${expiresAt}:R> (<t:${expiresAt}:f>)`;
      }

      // Max uses
      const maxUsesText = invite.maxUses > 0 ? `${invite.maxUses} uses` : 'Unlimited';

      // Channel the invite leads to
      const targetChannel = invite.channel
        ? `<#${invite.channel.id}>`
        : 'Unknown';

      const inviterMember = invite.inviter
        ? await invite.guild.members.fetch(invite.inviter.id).catch(() => null)
        : null;

      const embed = new EmbedBuilder()
        .setColor(0x58a6ff)
        .setTitle('🔗 New Invite Created')
        .setThumbnail(inviterMember?.displayAvatarURL({ size: 64 }) ?? null)
        .addFields(
          {
            name: '👤 Created By',
            value: invite.inviter
              ? `<@${invite.inviter.id}> (${inviterMember?.displayName ?? invite.inviter.username})`
              : 'Unknown',
            inline: true,
          },
          {
            name: '🎟️ Invite Code',
            value: `\`${invite.code}\``,
            inline: true,
          },
          {
            name: '📌 Links To',
            value: targetChannel,
            inline: true,
          },
          {
            name: '⏳ Expires',
            value: expiryText,
            inline: true,
          },
          {
            name: '🔢 Max Uses',
            value: maxUsesText,
            inline: true,
          },
          {
            name: '🔗 Full Link',
            value: `https://discord.gg/${invite.code}`,
            inline: true,
          },
        )
        .setFooter({ text: `${invite.guild.name} • Invite Tracker` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (e) {
      console.error('inviteCreate log error:', e.message);
    }
  }
};
