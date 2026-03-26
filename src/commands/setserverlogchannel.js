const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setServerLogChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setserverlogchannel')
    .setDescription('⚙️ Set the channel for server-level logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send logs to').setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await setServerLogChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Server Log Channel Set')
      .setDescription(`Server logs → <#${channel.id}>`)
      .addFields({ name: '📋 Logs', value: '• 🏠 Server name changed\n• 🖼️ Icon/banner updated\n• 📖 Description changed\n• 🛡️ Verification level\n• 🔍 Content filter\n• 🔔 Notification settings\n• 😴 AFK channel\n• 📜 Rules channel' })
      .setFooter({ text: 'LevelGuard • Server Logging' }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
