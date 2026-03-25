const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setInviteLogChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setinvitelogchannel')
    .setDescription('⚙️ Set the channel for invite & join logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send join/invite logs to')
        .setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await setInviteLogChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Invite Log Channel Set')
      .setDescription(`Join and invite logs will now be sent to <#${channel.id}>`)
      .addFields({
        name: '📋 Logged Events',
        value: '• 👋 New member joined\n• 🔗 Which invite link was used\n• 👤 Who invited them\n• 🕐 Account age of new member',
      })
      .setFooter({ text: 'LevelGuard • Invite Tracking' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
