const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getUser, getTotalUsers, getLeaderboard } = require('../database');
const { generateProfileCard } = require('../utils/canvas');
const { calculateLevel } = require('../utils/levelSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('📊 View your level card or another member\'s')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user to check (default: yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guild = interaction.guild;

    let member;
    try {
      member = await guild.members.fetch(targetUser.id);
    } catch {
      return interaction.editReply({ content: '❌ Could not find that member in this server.' });
    }

    const userData = await getUser(guild.id, targetUser.id);

    // Calculate rank
    const allUsers = await getLeaderboard(guild.id, 1000, 0);
    const rank = allUsers.findIndex(u => u.user_id === targetUser.id) + 1 || allUsers.length + 1;

    try {
      const imageBuffer = await generateProfileCard(member, userData, rank, guild);
      const attachment = new AttachmentBuilder(imageBuffer, { name: 'profile.png' });

      await interaction.editReply({
        files: [attachment],
      });
    } catch (err) {
      console.error('Profile card error:', err);
      await interaction.editReply({ content: '❌ Failed to generate profile card.' });
    }
  }
};