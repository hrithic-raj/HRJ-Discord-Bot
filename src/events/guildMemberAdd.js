const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const {
  getAllGuildInvites, upsertInvite,
  logJoin, getGuildSettings,
} = require('../database');
const { generateWelcomeCard } = require('../utils/canvas');
const path = require('path');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client) {
    const guild = member.guild;

    // ─── Detect which invite was used ──────────────────────
    //
    // HOW IT WORKS:
    // 1. BEFORE the join: DB holds each invite's use count (snapshot)
    // 2. AFTER the join:  we fetch live counts from Discord
    // 3. Whichever invite's live count is HIGHER than our snapshot = the used one
    // 4. We then update our snapshot to match the new live count
    //
    // Key fix: we update DB AFTER finding the match, not before.
    // Previous bug: upsertInvite ran before we finished searching, corrupting the snapshot.

    let usedInvite  = null;
    let inviterId   = null;

    try {
      // Step 1 — get our stored snapshot BEFORE touching anything
      const storedInvites = await getAllGuildInvites(guild.id);
      const storedMap = new Map(storedInvites.map(i => [i.invite_code, i.uses ?? 0]));

      // Step 2 — fetch live invite counts from Discord right now
      const liveInvites = await guild.invites.fetch();

      // Step 3 — find the invite whose live count is higher than our snapshot
      for (const [code, invite] of liveInvites) {
        const storedUses = storedMap.get(code) ?? 0;
        const liveUses   = invite.uses ?? 0;

        if (liveUses > storedUses) {
          usedInvite = invite;
          inviterId  = invite.inviter?.id ?? null;

          console.log(
            `✅ Invite match: code=${code} storedUses=${storedUses} liveUses=${liveUses}` +
            ` inviter=${invite.inviter?.tag ?? 'unknown'}`
          );
          break;
        }
      }

      // Step 4 — sync ALL live invite counts to DB now that we've identified the winner
      for (const [code, invite] of liveInvites) {
        await upsertInvite(
          guild.id,
          invite.inviter?.id ?? null,
          code,
          invite.uses ?? 0
        );
      }

      if (!usedInvite) {
        console.warn(`⚠️ Could not identify invite used by ${member.user.tag} — no count diff found`);
      }
    } catch (e) {
      console.error('Invite detection error:', e.message);
    }

    // ─── Save join log to DB ────────────────────────────────
    await logJoin(guild.id, member.id, inviterId, usedInvite?.code ?? null);

    // ─── Send log embed ─────────────────────────────────────
    const settings = await getGuildSettings(guild.id);
    const channelId = settings?.invite_log_channel;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    // Resolve inviter member for display name + avatar
    let inviterMember = null;
    if (inviterId) {
      try { inviterMember = await guild.members.fetch(inviterId); } catch {}
    }

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('👋 New Member Joined')
      .setThumbnail(member.displayAvatarURL({ size: 128 }));

    embed.addFields(
      { name: 'Member',  value: `<@${member.id}>`, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
    );

    if (inviterId) {
      embed.addFields(
        {
          name: '🔗 Invited By',
          value: inviterMember
            ? `<@${inviterId}> (${inviterMember.displayName})`
            : `<@${inviterId}>`,
          inline: true,
        },
        {
          name: '🎟️ Invite Code',
          value: `\`${usedInvite?.code}\``,
          inline: true,
        },
      );

      // Show inviter's total invite count
      const { getInviteCount } = require('../database');
      const totalInvites = await getInviteCount(guild.id, inviterId);
      embed.addFields({
        name: '📊 Inviter Total',
        value: `${inviterMember?.displayName ?? 'This user'} has now invited **${totalInvites}** member${totalInvites !== 1 ? 's' : ''}`,
        inline: false,
      });
    } else {
      embed.addFields({
        name: '🔗 Invited By',
        value: 'Unknown — vanity URL, OAuth, or bot couldn\'t detect',
        inline: true,
      });
    }

    embed
      .setFooter({ text: `Member #${guild.memberCount} • User ID: ${member.id}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });

    // ─── Welcome Card ───────────────────────────────────────
    try {
      const welcomeChannelId = settings?.welcome_channel;
      if (welcomeChannelId) {
        const welcomeChannel = guild.channels.cache.get(welcomeChannelId);
        if (welcomeChannel) {
          const bgPath = settings?.welcome_bg
            ? path.join(__dirname, '..', 'assets', settings.welcome_bg)
            : null;
          const imageBuffer = await generateWelcomeCard(member, guild, bgPath);
          const attachment = new AttachmentBuilder(imageBuffer, { name: 'welcome.png' });
          await welcomeChannel.send({
            content: `👋 Welcome to **${guild.name}**, <@${member.id}>! We're glad you're here.`,
            files: [attachment],
          });
        }
      }
    } catch (e) {
      console.error('Welcome card error:', e.message);
    }
  }
};
