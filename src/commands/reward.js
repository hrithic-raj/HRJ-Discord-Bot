const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setReward, getAllRewards, setLogChannel } = require('../database');

const rewardCommand = {
  data: new SlashCommandBuilder()
    .setName('reward')
    .setDescription('🎁 Manage level-based role rewards')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set a role reward for a specific level')
        .addIntegerOption(opt =>
          opt.setName('level').setDescription('Required level').setRequired(true).setMinValue(1)
        )
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to assign').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all configured level rewards')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'set') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');

      // Check bot can assign this role
      const botMember = guild.members.me;
      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: '❌ I cannot assign this role — it is higher than my highest role. Please move my role above it.',
          ephemeral: true,
        });
      }

      await setReward(guild.id, level, role.id);

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎁 Reward Set')
        .addFields(
          { name: 'Level Required', value: `**${level}**`, inline: true },
          { name: 'Role Reward', value: `<@&${role.id}>`, inline: true },
        )
        .setDescription('Members who reach this level will automatically receive this role!')
        .setFooter({ text: 'LevelGuard • Rewards' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'list') {
      const rewards = await getAllRewards(guild.id);

      if (!rewards.length) {
        return interaction.reply({
          embeds: [{
            color: 0x58a6ff,
            title: '🎁 Level Rewards',
            description: 'No rewards configured yet. Use `/reward set` to add some!',
          }],
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎁 Level Rewards')
        .setDescription(
          rewards.map(r => `**Level ${r.level}** → <@&${r.role_id}>`).join('\n')
        )
        .setFooter({ text: `${rewards.length} reward(s) configured • LevelGuard` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }
};

module.exports = rewardCommand;