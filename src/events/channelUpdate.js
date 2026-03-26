const { EmbedBuilder, AuditLogEvent, ChannelType } = require('discord.js');
const { getGuildSettings } = require('../database');

// Converts a permission overwrite collection to a readable map: roleId/userId -> [allow[], deny[]]
function permMap(overwrites) {
  const map = new Map();
  for (const [id, ow] of overwrites.cache) {
    map.set(id, {
      type: ow.type, // 0=role, 1=member
      allow: ow.allow.toArray(),
      deny:  ow.deny.toArray(),
    });
  }
  return map;
}

function diffPermissions(guild, oldMap, newMap) {
  const lines = [];

  // Check all IDs in new map
  for (const [id, newOw] of newMap) {
    const oldOw = oldMap.get(id);
    const label = newOw.type === 0
      ? (guild.roles.cache.get(id)?.name ? `@${guild.roles.cache.get(id).name}` : `<@&${id}>`)
      : `<@${id}>`;

    if (!oldOw) {
      // Newly added overwrite
      lines.push(`**${label}** added to permissions`);
      if (newOw.allow.length) lines.push(`  ✅ Allowed: ${newOw.allow.join(', ')}`);
      if (newOw.deny.length)  lines.push(`  ❌ Denied:  ${newOw.deny.join(', ')}`);
    } else {
      // Changed overwrite — find what changed
      const granted  = newOw.allow.filter(p => !oldOw.allow.includes(p));
      const revoked  = oldOw.allow.filter(p => !newOw.allow.includes(p));
      const newDeny  = newOw.deny.filter(p => !oldOw.deny.includes(p));
      const unDenied = oldOw.deny.filter(p => !newOw.deny.includes(p));

      if (granted.length || revoked.length || newDeny.length || unDenied.length) {
        lines.push(`**${label}** permissions changed:`);
        if (granted.length)  lines.push(`  ✅ Allowed: ${granted.join(', ')}`);
        if (revoked.length)  lines.push(`  ↩️ Unallowed: ${revoked.join(', ')}`);
        if (newDeny.length)  lines.push(`  ❌ Denied: ${newDeny.join(', ')}`);
        if (unDenied.length) lines.push(`  ↩️ Undenied: ${unDenied.join(', ')}`);
      }
    }
  }

  // Check for removed overwrites
  for (const [id, oldOw] of oldMap) {
    if (!newMap.has(id)) {
      const label = oldOw.type === 0
        ? (guild.roles.cache.get(id)?.name ? `@${guild.roles.cache.get(id).name}` : `<@&${id}>`)
        : `<@${id}>`;
      lines.push(`**${label}** removed from permissions`);
    }
  }

  return lines;
}

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel) {
    if (!newChannel.guild) return;
    const guild = newChannel.guild;
    const settings = await getGuildSettings(guild.id);
    const logChannel = settings?.channel_log_channel
      ? guild.channels.cache.get(settings.channel_log_channel)
      : null;
    if (!logChannel) return;

    const changes = [];

    // ── Basic property changes ──────────────────────────────
    if (oldChannel.name !== newChannel.name)
      changes.push({ name: '📝 Name', value: `\`${oldChannel.name}\` → \`${newChannel.name}\``, inline: true });

    if (oldChannel.topic !== newChannel.topic)
      changes.push({
        name: '📌 Topic',
        value: `**Before:** ${oldChannel.topic || '*None*'}\n**After:** ${newChannel.topic || '*Removed*'}`,
        inline: false,
      });

    if (oldChannel.nsfw !== newChannel.nsfw)
      changes.push({ name: '🔞 NSFW', value: `${oldChannel.nsfw} → ${newChannel.nsfw}`, inline: true });

    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser)
      changes.push({ name: '🐌 Slowmode', value: `${oldChannel.rateLimitPerUser}s → ${newChannel.rateLimitPerUser}s`, inline: true });

    if (oldChannel.parentId !== newChannel.parentId)
      changes.push({
        name: '📁 Category Moved',
        value: `${oldChannel.parent?.name ?? 'None'} → ${newChannel.parent?.name ?? 'None'}`,
        inline: true,
      });

    if (newChannel.type === ChannelType.GuildVoice) {
      if (oldChannel.bitrate !== newChannel.bitrate)
        changes.push({ name: '🎵 Bitrate', value: `${oldChannel.bitrate / 1000}kbps → ${newChannel.bitrate / 1000}kbps`, inline: true });
      if (oldChannel.userLimit !== newChannel.userLimit)
        changes.push({ name: '👥 User Limit', value: `${oldChannel.userLimit || '∞'} → ${newChannel.userLimit || '∞'}`, inline: true });
    }

    // ── Permission overwrite changes ────────────────────────
    const oldPerms = permMap(oldChannel.permissionOverwrites);
    const newPerms = permMap(newChannel.permissionOverwrites);
    const permLines = diffPermissions(guild, oldPerms, newPerms);

    if (permLines.length > 0) {
      // Split into chunks of max 1024 chars per field
      let chunk = '';
      let chunkIndex = 1;
      for (const line of permLines) {
        if ((chunk + '\n' + line).length > 1020) {
          changes.push({ name: `🔒 Permission Changes (${chunkIndex++})`, value: chunk, inline: false });
          chunk = line;
        } else {
          chunk = chunk ? chunk + '\n' + line : line;
        }
      }
      if (chunk) changes.push({ name: `🔒 Permission Changes${chunkIndex > 1 ? ` (${chunkIndex})` : ''}`, value: chunk, inline: false });
    }

    if (changes.length === 0) return;

    try {
      await new Promise(r => setTimeout(r, 800));
      const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelUpdate, limit: 5 });
      const entry = logs.entries.find(e => e.target?.id === newChannel.id && Date.now() - e.createdTimestamp < 5000);

      // Also check ChannelOverwriteCreate/Update/Delete for permission changes
      let executor = entry?.executor ?? null;
      if (!executor && permLines.length > 0) {
        for (const type of [
          AuditLogEvent.ChannelOverwriteCreate,
          AuditLogEvent.ChannelOverwriteUpdate,
          AuditLogEvent.ChannelOverwriteDelete,
        ]) {
          const permLogs = await guild.fetchAuditLogs({ type, limit: 3 });
          const permEntry = permLogs.entries.find(
            e => e.extra?.id === newChannel.id || e.target?.id === newChannel.id
              ? true
              : permLogs.entries.first()?.createdTimestamp > Date.now() - 5000
          );
          if (permEntry) { executor = permEntry.executor; break; }
        }
        // Fallback: just grab the most recent overwrite log
        if (!executor) {
          const permLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelOverwriteUpdate, limit: 1 });
          const recent = permLogs.entries.first();
          if (recent && Date.now() - recent.createdTimestamp < 5000) executor = recent.executor;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xf0883e)
        .setTitle('✏️ Channel Updated')
        .addFields(
          { name: 'Channel',    value: `<#${newChannel.id}> (${newChannel.name})`, inline: true },
          { name: 'Updated By', value: executor ? `<@${executor.id}>` : 'Unknown',  inline: true },
          { name: '\u200b',     value: '\u200b', inline: true },
          ...changes,
        )
        .setFooter({ text: `Channel ID: ${newChannel.id}` })
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    } catch (e) { console.error('channelUpdate log error:', e.message); }
  }
};
