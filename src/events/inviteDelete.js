const { deleteInvite } = require('../database');

module.exports = {
  name: 'inviteDelete',
  async execute(invite, client) {
    if (!invite.guild) return;
    try {
      await deleteInvite(invite.guild.id, invite.code);
      console.log(`🗑️ Removed deleted invite from cache: ${invite.code}`);
    } catch (e) {
      console.error('inviteDelete error:', e.message);
    }
  }
};
