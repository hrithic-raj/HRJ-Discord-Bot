const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getLeaderboard, getTotalUsers } = require('../database');
const { generateLeaderboardCard } = require('../utils/canvas');

const PAGE_SIZE = 10;

async function buildLeaderboardPage(guild, page) {
  const totalUsers = await getTotalUsers(guild.id);
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const entries = await getLeaderboard(guild.id, PAGE_SIZE, offset);

  const imageBuffer = await generateLeaderboardCard(entries, safePage, totalPages, guild);
  const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lb_prev_${safePage}`)
      .setLabel('◀ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 1),
    new ButtonBuilder()
      .setCustomId(`lb_page_${safePage}`)
      .setLabel(`Page ${safePage} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`lb_next_${safePage}`)
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages),
  );

  return { attachment, row };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('🏆 View the server XP leaderboard')
    .addIntegerOption(opt =>
      opt.setName('page')
        .setDescription('Page number')
        .setRequired(false)
        .setMinValue(1)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const page = interaction.options.getInteger('page') || 1;
    const guild = interaction.guild;

    try {
      const { attachment, row } = await buildLeaderboardPage(guild, page);
      await interaction.editReply({ files: [attachment], components: [row] });
    } catch (err) {
      console.error('Leaderboard error:', err);
      await interaction.editReply({ content: '❌ Failed to generate leaderboard.' });
    }
  },

  async handleButton(interaction, client) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split('_');
    const direction = parts[1]; // prev or next
    const currentPage = parseInt(parts[2]);

    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    const guild = interaction.guild;

    try {
      const { attachment, row } = await buildLeaderboardPage(guild, newPage);
      await interaction.editReply({ files: [attachment], components: [row] });
    } catch (err) {
      console.error('Leaderboard pagination error:', err);
    }
  }
};