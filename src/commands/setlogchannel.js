const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setLogChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('⚙️ Set the channel for server logs (roles, voice)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('The channel to send logs to')
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    setLogChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Log Channel Set')
      .setDescription(`All server logs will now be sent to <#${channel.id}>`)
      .addFields(
        {
          name: '📋 Logged Events',
          value: '• ✅ Role Added\n• ❌ Role Removed\n• 🎙️ Voice Join\n• 🔇 Voice Leave\n• ↔️ Voice Move / Drag',
        }
      )
      .setFooter({ text: 'LevelGuard • Logging' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};