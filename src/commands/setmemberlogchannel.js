const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setMemberLogChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setmemberlogchannel')
    .setDescription('⚙️ Set the channel for member action logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send logs to').setRequired(true)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    await setMemberLogChannel(interaction.guild.id, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Member Log Channel Set')
      .setDescription(`Member action logs → <#${channel.id}>`)
      .addFields({ name: '📋 Logs', value: '• 🔨 Ban / ✅ Unban\n• 👢 Kick\n• 🚪 Member left\n• ⏱️ Timeout applied / removed\n• 🔇 Server mute / unmute\n• 🔕 Server deafen / undeafen\n• ✏️ Nickname changed' })
      .setFooter({ text: 'LevelGuard • Member Logging' }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};
