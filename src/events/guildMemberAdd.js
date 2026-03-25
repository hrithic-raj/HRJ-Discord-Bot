const { EmbedBuilder } = require('discord.js');
const {
  getAllGuildInvites, upsertInvite,
  incrementInviteUses, logJoin, getGuildSettings,
} = require('../database');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const guild = member.guild;

    // ─── Detect which invite was used ──────────────────────
    // Strategy: fetch current invite list, compare use counts
    // against our cached counts to find which one increased.
    let usedInvite = null;
    let inviterId = null;

    try {
      // Fetch live invites from Discord
      const currentInvites = await guild.invites.fetch();

      // Get our stored invite records
      const storedInvites = await getAllGuildInvites(guild.id);
      const storedMap = new Map(storedInvites.map(i => [i.invite_code, i]));

      // Find the invite whose use count increased by 1
      for (const [code, invite] of currentInvites) {
        const stored = storedMap.get(code);
        const storedUses = stored?.uses ?? 0;

        if (invite.uses > storedUses) {
          usedInvite = invite;
          inviterId = invite.inviter?.id ?? null;

          // Update stored use count
          await upsertInvite(guild.id, inviterId, code, invite.uses);
          await incrementInviteUses(guild.id, code);
          break;
        }
      }

      // Also sync any new invites we haven't seen before
      for (const [code, invite] of currentInvites) {
        if (!storedMap.has(code)) {
          await upsertInvite(guild.id, invite.inviter?.id ?? 'unknown', code, invite.uses);
        }
      }
    } catch (e) {
      console.error('Invite detection error:', e.message);
    }

    // ─── Save join log ─────────────────────────────────────
    await logJoin(guild.id, member.id, inviterId, usedInvite?.code ?? null);

    // ─── Send log to voice_log_channel (or level_channel) ──
    const settings = await getGuildSettings(guild.id);
    const channelId = settings?.invite_log_channel;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('👋 New Member Joined')
      .setThumbnail(member.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: 'Member',    value: `<@${member.id}>`,   inline: true },
        { name: 'Account',   value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      );

    if (inviterId) {
      embed.addFields(
        { name: 'Invited By',   value: `<@${inviterId}>`,         inline: true },
        { name: 'Invite Code',  value: `\`${usedInvite?.code}\``, inline: true },
      );
    } else {
      embed.addFields({ name: 'Invited By', value: 'Unknown (vanity URL / OAuth)', inline: true });
    }

    embed
      .setFooter({ text: `Member #${guild.memberCount} • User ID: ${member.id}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
};
