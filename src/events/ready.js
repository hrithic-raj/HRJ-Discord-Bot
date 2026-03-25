const { upsertInvite } = require('../database');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);

    client.user.setPresence({
      activities: [{ name: '📊 Tracking levels', type: 3 }],
      status: 'online',
    });

    // ── Cache all existing invites for every guild ──────────
    // We store current use counts in DB so when someone joins
    // we can compare and find which invite's count went up.
    for (const [, guild] of client.guilds.cache) {
      try {
        const invites = await guild.fetchInvites();
        for (const [, invite] of invites) {
          await upsertInvite(guild.id, invite.inviter?.id || null, invite.code, invite.uses || 0);
        }
        console.log(`📋 Cached ${invites.size} invite(s) for: ${guild.name}`);
      } catch (e) {
        console.warn(`⚠️ Could not cache invites for ${guild.name}: ${e.message}`);
      }
    }
  }
};
