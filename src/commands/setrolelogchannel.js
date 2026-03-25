const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setRoleLogChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrolelogchannel')
    .setDescription('⚙️ Set the channel for role change logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send role logs to')
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await setRoleLogChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Role Log Channel Set')
      .setDescription(`Role change logs will now be sent to <#${channel.id}>`)
      .addFields({
        name: '👤 Logged Events',
        value: '• ✅ Role Added (shows who assigned it)\n• ❌ Role Removed (shows who removed it)',
      })
      .setFooter({ text: 'LevelGuard • Role Logging' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};