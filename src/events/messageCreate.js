const { incrementMessages } = require('../database');
const { handleMessageXP } = require('../utils/levelSystem');

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // Track message count (fire and forget — no need to await)
    incrementMessages(message.guild.id, message.author.id).catch(console.error);

    // Award XP
    await handleMessageXP(message, client);
  }
};
