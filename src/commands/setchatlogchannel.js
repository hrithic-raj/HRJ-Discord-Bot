const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setChatLogChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchatlogchannel')
    .setDescription('⚙️ Set the channel for message edit/delete logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send logs to').setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await setChatLogChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Chat Log Channel Set')
      .setDescription(`Chat logs → <#${channel.id}>`)
      .addFields({ name: '📋 Logs', value: '• ✏️ Message edited (before & after)\n• 🗑️ Message deleted (content + who deleted)\n• 📎 Attachment info on deleted messages' })
      .setFooter({ text: 'LevelGuard • Chat Logging' }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
