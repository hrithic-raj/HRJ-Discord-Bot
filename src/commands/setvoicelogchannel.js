const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setVoiceLogChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setvoicelogchannel')
    .setDescription('⚙️ Set the channel for voice activity logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send voice logs to')
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await setVoiceLogChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Voice Log Channel Set')
      .setDescription(`Voice activity logs will now be sent to <#${channel.id}>`)
      .addFields({
        name: '🎙️ Logged Events',
        value: '• 🎙️ Voice Join\n• 🔇 Voice Leave\n• ↔️ Voice Move\n• ↔️ Dragged (shows who dragged)',
      })
      .setFooter({ text: 'LevelGuard • Voice Logging' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};