const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setChannelLogChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannellogchannel')
    .setDescription('⚙️ Set the channel for channel & category logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send logs to').setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await setChannelLogChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Channel Log Channel Set')
      .setDescription(`Channel/category logs → <#${channel.id}>`)
      .addFields({ name: '📋 Logs', value: '• 📋 Channel Created\n• ✏️ Channel Updated (name, topic, slowmode, category, bitrate)\n• 🗑️ Channel Deleted' })
      .setFooter({ text: 'LevelGuard • Channel Logging' }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
