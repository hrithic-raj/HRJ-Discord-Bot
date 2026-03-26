const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setLevelChannel, setWeeklyChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevelchannel')
    .setDescription('⚙️ Configure level-up and weekly announcement channels')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel for level-up announcements')
        .setRequired(true)
    )
    .addChannelOption(opt =>
      opt.setName('weekly_channel')
        .setDescription('Channel for weekly winner announcements (defaults to level channel)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const weeklyChannel = interaction.options.getChannel('weekly_channel');

    await setLevelChannel(interaction.guild.id, channel.id);

    if (weeklyChannel) {
      await setWeeklyChannel(interaction.guild.id, weeklyChannel.id);
    } else {
      await setWeeklyChannel(interaction.guild.id, channel.id);
    }

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Level Channels Configured')
      .addFields(
        { name: '📢 Level-Up Channel', value: `<#${channel.id}>`, inline: true },
        { name: '🏆 Weekly Winner Channel', value: `<#${weeklyChannel?.id || channel.id}>`, inline: true },
      )
      .setFooter({ text: 'LevelGuard • Configuration' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
