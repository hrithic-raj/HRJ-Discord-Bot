const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getInviteLeaderboard } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inviteleaderboard')
    .setDescription('🏆 View the top inviters in this server'),

  async execute(interaction) {
    await interaction.deferReply();

    const guild = interaction.guild;
    const entries = await getInviteLeaderboard(guild.id, 10);

    if (!entries.length) {
      return interaction.editReply({
        embeds: [{
          color: 0x58a6ff,
          title: '📨 Invite Leaderboard',
          description: 'No invite data yet. The bot tracks invites as members join.',
        }]
      });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const rank = i + 1;
      const prefix = rank <= 3 ? medals[rank - 1] : `**#${rank}**`;

      let name = `<@${entry._id}>`;
      try {
        const member = await guild.members.fetch(entry._id);
        name = `**${member.displayName}**`;
      } catch {}

      lines.push(`${prefix}  ${name} — **${entry.count}** invite${entry.count !== 1 ? 's' : ''}`);
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('📨 Invite Leaderboard')
      .setDescription(lines.join('\n'))
      .setThumbnail(guild.iconURL({ size: 128 }))
      .setFooter({ text: `${guild.name} • Top Inviters` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
