const { upsertInvite } = require('../database');

module.exports = {
  name: 'inviteCreate',
  async execute(invite, client) {
    if (!invite.guild) return;
    try {
      await upsertInvite(
        invite.guild.id,
        invite.inviter?.id ?? 'unknown',
        invite.code,
        invite.uses ?? 0
      );
      console.log(`📨 Cached new invite: ${invite.code} by ${invite.inviter?.tag ?? 'unknown'}`);
    } catch (e) {
      console.error('inviteCreate error:', e.message);
    }
  }
};
