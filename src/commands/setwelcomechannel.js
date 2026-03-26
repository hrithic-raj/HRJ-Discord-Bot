const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setWelcomeChannel } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('⚙️ Set the welcome channel and optional background image')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send welcome messages to')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('background')
        .setDescription('Filename of your background image in the assets folder (e.g. welcome_bg.png)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const bg = interaction.options.getString('background') ?? null;

    await setWelcomeChannel(interaction.guild.id, channel.id, bg);

    const embed = new EmbedBuilder()
      .setColor(0x3fb950)
      .setTitle('✅ Welcome Channel Set')
      .addFields(
        { name: '👋 Welcome Channel', value: `<#${channel.id}>`, inline: true },
        {
          name: '🖼️ Background Image',
          value: bg
            ? `\`${bg}\` (must be in \`src/assets/\` folder)`
            : 'Default gradient (no custom image set)',
          inline: true,
        },
      )
      .setDescription('When a new member joins, a welcome card with their profile picture will be sent here.')
      .addFields({
        name: '💡 How to use custom background',
        value: 'Place your image in the `src/assets/` folder in your project, then run `/setwelcomechannel` again with the filename.',
      })
      .setFooter({ text: 'LevelGuard • Welcome System' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};
