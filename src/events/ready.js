module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);

    client.user.setPresence({
      activities: [{
        name: '📊 Tracking levels',
        type: 3, // Watching
      }],
      status: 'online',
    });
  }
};