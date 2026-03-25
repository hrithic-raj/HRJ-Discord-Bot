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

    // ── Cache all existing invites on startup ───────────────
    // guild.invites.fetch() is the correct discord.js v14 API
    for (const [, guild] of client.guilds.cache) {
      try {
        const invites = await guild.invites.fetch();
        for (const [, invite] of invites) {
          await upsertInvite(
            guild.id,
            invite.inviter?.id ?? null,
            invite.code,
            invite.uses ?? 0
          );
        }
        console.log(`📋 Cached ${invites.size} invite(s) for: ${guild.name}`);
      } catch (e) {
        console.warn(`⚠️ Could not cache invites for ${guild.name}: ${e.message}`);
      }
    }
  }
};
