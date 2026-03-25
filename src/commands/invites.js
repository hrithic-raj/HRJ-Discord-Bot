const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getInviteCount, getInviterOf } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('📨 Check how many members a user has invited')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to check (default: yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('user') || interaction.user;
    const guild = interaction.guild;

    let member;
    try {
      member = await guild.members.fetch(target.id);
    } catch {
      return interaction.editReply({ content: '❌ Could not find that member.' });
    }

    const count = await getInviteCount(guild.id, target.id);

    // Find who invited this user
    const joinRecord = await getInviterOf(guild.id, target.id);
    const invitedByText = joinRecord?.inviter_id
      ? `<@${joinRecord.inviter_id}>`
      : 'Unknown / Original member';

    const embed = new EmbedBuilder()
      .setColor(0x58a6ff)
      .setAuthor({
        name: member.displayName,
        iconURL: member.displayAvatarURL({ size: 64 }),
      })
      .setTitle('📨 Invite Stats')
      .setThumbnail(member.displayAvatarURL({ size: 128 }))
      .addFields(
        {
          name: '👥 Members Invited',
          value: `**${count}** member${count !== 1 ? 's' : ''}`,
          inline: true,
        },
        {
          name: '🔗 How They Joined',
          value: invitedByText,
          inline: true,
        },
        joinRecord?.invite_code
          ? { name: '🎟️ Via Invite', value: `\`${joinRecord.invite_code}\``, inline: true }
          : { name: '\u200b', value: '\u200b', inline: true },
      )
      .setFooter({ text: `${guild.name} • Invite Tracker` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
