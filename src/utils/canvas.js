const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const { xpForLevel } = require('../database');

// ─── Register fonts ────────────────────────────────────────
// Fonts are downloaded by index.js before this module is required.
// GlobalFonts.registerFromPath is safe to call multiple times.
const ASSETS = path.join(__dirname, '..', 'assets');
const FONT_BOLD    = path.join(ASSETS, 'NotoSans-Bold.ttf');
const FONT_REGULAR = path.join(ASSETS, 'NotoSans-Regular.ttf');

function registerFonts() {
  let registered = false;
  if (fs.existsSync(FONT_BOLD)) {
    GlobalFonts.registerFromPath(FONT_BOLD, 'Noto');
    registered = true;
    console.log('✅ Font registered: NotoSans-Bold');
  } else {
    console.warn('⚠️ NotoSans-Bold.ttf not found at', FONT_BOLD);
  }
  if (fs.existsSync(FONT_REGULAR)) {
    GlobalFonts.registerFromPath(FONT_REGULAR, 'Noto');
    console.log('✅ Font registered: NotoSans-Regular');
  } else {
    console.warn('⚠️ NotoSans-Regular.ttf not found at', FONT_REGULAR);
  }
  return registered;
}
registerFonts();

const FONT = 'Noto, Arial, sans-serif';

const C = {
  bg: '#0d1117', card: '#161b22', accent: '#58a6ff',
  gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32',
  text: '#e6edf3', subtext: '#8b949e', bar_bg: '#21262d', success: '#3fb950',
};

function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === 'number') r = [r, r, r, r];
  const [tl, tr, br, bl] = r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

async function drawAvatar(ctx, url, cx, cy, radius) {
  try {
    const img = await loadImage(url);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
  } catch {
    ctx.save();
    ctx.fillStyle = '#30363d';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function xpProgress(xp, level) {
  const cur  = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const progress = Math.min(Math.max((xp - cur) / (next - cur), 0), 1);
  return { progress, xpInLevel: xp - cur, xpNeeded: next - cur };
}

// ══ LEVEL UP CARD ══
async function generateLevelUpCard(member, oldLevel, newLevel, xp, guild) {
  const W = 800, H = 240;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1117'); bg.addColorStop(1, '#161b22');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 16); ctx.fill();

  const bar = ctx.createLinearGradient(0, 0, 0, H);
  bar.addColorStop(0, C.accent); bar.addColorStop(1, C.success);
  ctx.fillStyle = bar;
  roundRect(ctx, 0, 0, 6, H, [16, 0, 0, 16]); ctx.fill();

  ctx.fillStyle = 'rgba(88,166,255,0.10)';
  for (let i = 0; i < 25; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
  await drawAvatar(ctx, avatarURL, 110, H / 2, 70);

  const ring = ctx.createLinearGradient(40, 50, 180, 190);
  ring.addColorStop(0, C.accent); ring.addColorStop(1, C.gold);
  ctx.strokeStyle = ring; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(110, H / 2, 73, 0, Math.PI * 2); ctx.stroke();

  const titleGrad = ctx.createLinearGradient(210, 0, 500, 0);
  titleGrad.addColorStop(0, C.accent); titleGrad.addColorStop(1, C.success);
  ctx.fillStyle = titleGrad;
  ctx.font = `bold 44px "${FONT}"`;
  ctx.fillText('LEVEL UP!', 210, 72);

  ctx.fillStyle = C.text;
  ctx.font = `bold 26px "${FONT}"`;
  ctx.fillText(member.displayName.substring(0, 20), 212, 112);

  ctx.fillStyle = C.subtext;
  ctx.font = `20px "${FONT}"`;
  ctx.fillText(`Level ${oldLevel}  \u2192  `, 212, 150);
  const arrowW = ctx.measureText(`Level ${oldLevel}  \u2192  `).width;
  ctx.fillStyle = C.gold;
  ctx.font = `bold 28px "${FONT}"`;
  ctx.fillText(`${newLevel}`, 212 + arrowW, 150);

  const { progress, xpInLevel, xpNeeded } = xpProgress(xp, newLevel);
  const bx = 212, by = 168, bw = 530, bh = 20;

  ctx.fillStyle = C.bar_bg;
  roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();

  if (progress > 0) {
    const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fg.addColorStop(0, '#238636'); fg.addColorStop(1, C.accent);
    ctx.fillStyle = fg;
    roundRect(ctx, bx, by, Math.max(bw * progress, 10), bh, 10); ctx.fill();
  }

  ctx.fillStyle = C.subtext;
  ctx.font = `13px "${FONT}"`;
  ctx.fillText(
    `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP  \u2022  ${Math.floor(progress * 100)}% to Level ${newLevel + 1}`,
    bx, by + bh + 16
  );

  return canvas.toBuffer('image/png');
}

// ══ PROFILE CARD ══
async function generateProfileCard(member, userData, rank, guild) {
  const W = 800, H = 300;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1117'); bg.addColorStop(0.6, '#161b22'); bg.addColorStop(1, '#0d1117');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 18); ctx.fill();

  ctx.strokeStyle = 'rgba(88,166,255,0.04)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  const side = ctx.createLinearGradient(0, 0, 0, H);
  side.addColorStop(0, C.accent); side.addColorStop(0.5, C.success); side.addColorStop(1, C.gold);
  ctx.fillStyle = side;
  roundRect(ctx, 0, 0, 6, H, [18,0,0,18]); ctx.fill();

  const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
  await drawAvatar(ctx, avatarURL, 115, H / 2, 80);

  const ring = ctx.createLinearGradient(35, 30, 195, 270);
  ring.addColorStop(0, C.accent); ring.addColorStop(1, C.gold);
  ctx.strokeStyle = ring; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(115, H / 2, 84, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = C.text;
  ctx.font = `bold 32px "${FONT}"`;
  ctx.fillText(member.displayName.substring(0, 18), 222, 72);

  ctx.fillStyle = C.subtext;
  ctx.font = `17px "${FONT}"`;
  ctx.fillText(`@${member.user.username}`, 224, 100);

  const rankColor = rank === 1 ? C.gold : rank === 2 ? C.silver : rank === 3 ? C.bronze : C.accent;
  ctx.fillStyle = rankColor;
  ctx.font = `bold 24px "${FONT}"`;
  ctx.fillText(`# ${rank}`, 660, 68);
  ctx.fillStyle = C.subtext;
  ctx.font = `13px "${FONT}"`;
  ctx.fillText('Server Rank', 655, 88);

  const level    = userData.level    ?? 0;
  const xp       = userData.xp       ?? 0;
  const messages = userData.messages ?? 0;
  const voice    = userData.voice_minutes ?? 0;

  const stats = [
    { label: 'LEVEL',       value: String(level) },
    { label: 'TOTAL XP',    value: xp.toLocaleString() },
    { label: 'MESSAGES',    value: messages.toLocaleString() },
    { label: 'VOICE (min)', value: voice.toLocaleString() },
  ];

  stats.forEach((stat, i) => {
    const sx = 222 + i * 140, sy = 132;
    ctx.fillStyle = 'rgba(88,166,255,0.07)';
    roundRect(ctx, sx - 4, sy - 24, 128, 54, 8); ctx.fill();

    ctx.fillStyle = C.accent;
    ctx.font = `bold 22px "${FONT}"`;
    ctx.fillText(stat.value, sx, sy);

    ctx.fillStyle = C.subtext;
    ctx.font = `11px "${FONT}"`;
    ctx.fillText(stat.label, sx, sy + 18);
  });

  const { progress, xpInLevel, xpNeeded } = xpProgress(xp, level);
  const bx = 222, by = 212, bw = 530, bh = 22;

  ctx.fillStyle = C.bar_bg;
  roundRect(ctx, bx, by, bw, bh, 11); ctx.fill();

  if (progress > 0) {
    const fg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    fg.addColorStop(0, '#238636'); fg.addColorStop(0.5, C.accent); fg.addColorStop(1, C.gold);
    ctx.fillStyle = fg;
    roundRect(ctx, bx, by, Math.max(bw * progress, 11), bh, 11); ctx.fill();
  }

  ctx.fillStyle = C.text;
  ctx.font = `bold 13px "${FONT}"`;
  ctx.fillText(
    `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP  \u2022  ${Math.floor(progress * 100)}% to Level ${level + 1}`,
    bx, by + bh + 18
  );

  return canvas.toBuffer('image/png');
}

// ══ LEADERBOARD CARD ══
async function generateLeaderboardCard(entries, page, totalPages, guild) {
  const W = 780, ROW_H = 65, HEADER_H = 100, FOOTER_H = 50;
  const H = HEADER_H + entries.length * ROW_H + FOOTER_H;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d1117'); bg.addColorStop(1, '#161b22');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 16); ctx.fill();

  const hg = ctx.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0, C.accent); hg.addColorStop(1, C.gold);
  ctx.fillStyle = hg;
  ctx.font = `bold 34px "${FONT}"`;
  ctx.fillText('\uD83C\uDFC6  LEADERBOARD', 28, 52);

  ctx.fillStyle = C.subtext;
  ctx.font = `15px "${FONT}"`;
  ctx.fillText(`${guild.name}  \u2022  Page ${page} / ${totalPages}`, 30, 78);

  ctx.strokeStyle = 'rgba(88,166,255,0.18)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, HEADER_H - 8); ctx.lineTo(W - 16, HEADER_H - 8); ctx.stroke();

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
  const medalColors = [C.gold, C.silver, C.bronze];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const rank = (page - 1) * 10 + i + 1;
    const ry = HEADER_H + i * ROW_H;

    if (rank <= 3) {
      ctx.fillStyle = `rgba(${rank===1?'255,215,0':rank===2?'192,192,192':'205,127,50'},0.07)`;
      roundRect(ctx, 8, ry + 4, W - 16, ROW_H - 6, 8); ctx.fill();
    }

    if (rank <= 3) {
      ctx.font = `20px "${FONT}"`;
      ctx.fillStyle = medalColors[rank - 1];
      ctx.fillText(medals[rank - 1], 18, ry + ROW_H / 2 + 7);
    } else {
      ctx.font = `bold 16px "${FONT}"`;
      ctx.fillStyle = C.subtext;
      ctx.fillText(`#${rank}`, 18, ry + ROW_H / 2 + 6);
    }

    let member = null;
    try { member = await guild.members.fetch(entry.user_id); } catch {}

    if (member) {
      const url = member.displayAvatarURL({ extension: 'png', size: 64, forceStatic: true });
      await drawAvatar(ctx, url, 90, ry + ROW_H / 2, 22);
      ctx.fillStyle = C.text;
      ctx.font = `bold 16px "${FONT}"`;
      ctx.fillText(member.displayName.substring(0, 18), 122, ry + ROW_H / 2 + 6);
    } else {
      ctx.fillStyle = C.subtext;
      ctx.font = `bold 16px "${FONT}"`;
      ctx.fillText('Unknown User', 122, ry + ROW_H / 2 + 6);
    }

    ctx.fillStyle = C.accent;
    ctx.font = `bold 15px "${FONT}"`;
    ctx.fillText(`Lv. ${entry.level ?? 0}`, 460, ry + ROW_H / 2 + 6);

    ctx.fillStyle = C.subtext;
    ctx.font = `14px "${FONT}"`;
    ctx.fillText(`${(entry.xp ?? 0).toLocaleString()} XP`, 560, ry + ROW_H / 2 + 6);
  }

  ctx.strokeStyle = 'rgba(88,166,255,0.08)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(16, H - FOOTER_H); ctx.lineTo(W - 16, H - FOOTER_H); ctx.stroke();

  ctx.fillStyle = C.subtext;
  ctx.font = `12px "${FONT}"`;
  ctx.fillText('LevelGuard Bot  \u2022  Activity-based ranking', 28, H - 16);

  return canvas.toBuffer('image/png');
}

// ══ WEEKLY WINNER CARD ══
async function generateWeeklyWinnerCard(member, userData, guild) {
  const W = 750, H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const bg = ctx.createRadialGradient(W/2, H/2, 40, W/2, H/2, 400);
  bg.addColorStop(0, '#1a1400'); bg.addColorStop(1, '#0d1117');
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, W, H, 20); ctx.fill();

  ctx.fillStyle = 'rgba(255,215,0,0.15)';
  for (let i = 0; i < 35; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const border = ctx.createLinearGradient(0, 0, W, H);
  border.addColorStop(0, C.gold); border.addColorStop(0.5, '#FFA500'); border.addColorStop(1, C.gold);
  ctx.strokeStyle = border; ctx.lineWidth = 3;
  roundRect(ctx, 2, 2, W - 4, H - 4, 18); ctx.stroke();

  const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
  await drawAvatar(ctx, avatarURL, 110, H / 2, 80);

  ctx.shadowColor = C.gold; ctx.shadowBlur = 20;
  ctx.strokeStyle = C.gold; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(110, H / 2, 84, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;

  const tg = ctx.createLinearGradient(215, 0, 600, 0);
  tg.addColorStop(0, C.gold); tg.addColorStop(1, '#FFA500');
  ctx.fillStyle = tg;
  ctx.font = `bold 34px "${FONT}"`;
  ctx.fillText('\uD83C\uDFC6  WEEKLY WINNER', 215, 75);

  ctx.fillStyle = C.text;
  ctx.font = `bold 26px "${FONT}"`;
  ctx.fillText(member.displayName.substring(0, 18), 217, 118);

  ctx.fillStyle = C.gold;
  ctx.font = `17px "${FONT}"`;
  ctx.fillText(`+${(userData.weekly_xp ?? 0).toLocaleString()} XP this week`, 217, 150);

  ctx.fillStyle = C.subtext;
  ctx.font = `15px "${FONT}"`;
  ctx.fillText(`Level ${userData.level ?? 0}  \u2022  ${(userData.xp ?? 0).toLocaleString()} total XP`, 217, 182);
  ctx.fillText(`${userData.messages ?? 0} messages  \u2022  ${userData.voice_minutes ?? 0} min in voice`, 217, 208);

  return canvas.toBuffer('image/png');
}

module.exports = { generateLevelUpCard, generateProfileCard, generateLeaderboardCard, generateWeeklyWinnerCard };