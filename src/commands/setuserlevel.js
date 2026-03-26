const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { setLevel, getUser, setLogChannel } = require('../database');
const { xpForLevel } = require('../database');
const { generateLevelUpCard } = require('../utils/canvas');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setuserlevel')
    .setDescription('🛠️ Admin: Set a user\'s level manually')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('The user to update')
        .setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('level')
        .setDescription('The new level (0–500)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(500)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const newLevel = interaction.options.getInteger('level');
    const guild = interaction.guild;

    const oldData = await getUser(guild.id, targetUser.id);
    await setLevel(guild.id, targetUser.id, newLevel);

    const embed = new EmbedBuilder()
      .setColor(0xf0883e)
      .setTitle('🛠️ Level Updated')
      .setThumbnail(targetUser.displayAvatarURL({ size: 64 }))
      .addFields(
        { name: 'Member', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Old Level', value: `${oldData.level}`, inline: true },
        { name: 'New Level', value: `**${newLevel}**`, inline: true },
        { name: 'Updated By', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setFooter({ text: 'LevelGuard • Admin Override' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
