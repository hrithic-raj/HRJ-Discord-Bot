const { incrementMessages } = require('../database');
const { handleMessageXP } = require('../utils/levelSystem');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // Track message count
    incrementMessages(message.guild.id, message.author.id);

    // Award XP
    await handleMessageXP(message, client);
  }
};