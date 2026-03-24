const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const { xpForLevel, xpToNextLevel } = require('../database');

// Color palette
const COLORS = {
  bg: '#0d1117',
  card: '#161b22',
  accent: '#58a6ff',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  text: '#e6edf3',
  subtext: '#8b949e',
  bar_bg: '#21262d',
  bar_fill: '#238636',
  bar_fill2: '#58a6ff',
  success: '#3fb950',
};

async function generateLevelUpCard(member, oldLevel, newLevel, xp, guild) {
  const width = 800;
  const height = 250;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0d1117');
  bgGrad.addColorStop(1, '#161b22');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, width, height, 18);
  ctx.fill();

  // Glowing accent bar on left
  const accentGrad = ctx.createLinearGradient(0, 0, 0, height);
  accentGrad.addColorStop(0, '#58a6ff');
  accentGrad.addColorStop(1, '#3fb950');
  ctx.fillStyle = accentGrad;
  roundRect(ctx, 0, 0, 6, height, [18, 0, 0, 18]);
  ctx.fill();

  // Stars particle effect (decorative)
  ctx.fillStyle = 'rgba(88,166,255,0.12)';
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = Math.random() * 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Avatar
  try {
    const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const avatar = await loadImage(avatarURL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(100, height / 2, 70, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 30, height / 2 - 70, 140, 140);
    ctx.restore();

    // Avatar border
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(100, height / 2, 72, 0, Math.PI * 2);
    ctx.stroke();
  } catch (e) {
    console.error('Avatar load error:', e.message);
  }

  // Level Up text
  ctx.font = 'bold 48px sans-serif';
  const grad = ctx.createLinearGradient(200, 50, 500, 50);
  grad.addColorStop(0, COLORS.accent);
  grad.addColorStop(1, COLORS.success);
  ctx.fillStyle = grad;
  ctx.fillText('LEVEL UP!', 200, 90);

  // Username
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = COLORS.text;
  const displayName = member.displayName.substring(0, 20);
  ctx.fillText(displayName, 200, 130);

  // Level transition
  ctx.font = '22px sans-serif';
  ctx.fillStyle = COLORS.subtext;
  ctx.fillText(`Level ${oldLevel}`, 200, 165);
  ctx.fillStyle = COLORS.accent;
  ctx.fillText(` → `, 280, 165);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`${newLevel}`, 320, 165);

  // XP bar
  const barX = 200, barY = 185, barW = 520, barH = 18;
  const nextLevelXP = xpForLevel(newLevel + 1);
  const currentLevelXP = xpForLevel(newLevel);
  const progress = Math.min((xp - currentLevelXP) / (nextLevelXP - currentLevelXP), 1);

  ctx.fillStyle = COLORS.bar_bg;
  roundRect(ctx, barX, barY, barW, barH, 9);
  ctx.fill();

  const barFillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barFillGrad.addColorStop(0, '#238636');
  barFillGrad.addColorStop(1, '#58a6ff');
  ctx.fillStyle = barFillGrad;
  roundRect(ctx, barX, barY, Math.max(barW * progress, 9), barH, 9);
  ctx.fill();

  // XP label
  ctx.font = '14px sans-serif';
  ctx.fillStyle = COLORS.subtext;
  ctx.fillText(`${xp - currentLevelXP} / ${nextLevelXP - currentLevelXP} XP to next level`, barX, barY + barH + 18);

  return canvas.toBuffer('image/png');
}

async function generateProfileCard(member, userData, rank, guild) {
  const width = 800;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0d1117');
  bgGrad.addColorStop(0.6, '#161b22');
  bgGrad.addColorStop(1, '#0d1117');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, width, height, 20);
  ctx.fill();

  // Decorative grid lines
  ctx.strokeStyle = 'rgba(88,166,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // Side accent
  const sideGrad = ctx.createLinearGradient(0, 0, 0, height);
  sideGrad.addColorStop(0, '#58a6ff');
  sideGrad.addColorStop(0.5, '#3fb950');
  sideGrad.addColorStop(1, '#FFD700');
  ctx.fillStyle = sideGrad;
  roundRect(ctx, 0, 0, 6, height, [20, 0, 0, 20]);
  ctx.fill();

  // Avatar
  try {
    const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const avatar = await loadImage(avatarURL);

    // Shadow
    ctx.shadowColor = COLORS.accent;
    ctx.shadowBlur = 20;
    ctx.save();
    ctx.beginPath();
    ctx.arc(115, height / 2, 80, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 35, height / 2 - 80, 160, 160);
    ctx.restore();
    ctx.shadowBlur = 0;

    // Ring
    const ringGrad = ctx.createLinearGradient(35, 30, 195, 270);
    ringGrad.addColorStop(0, COLORS.accent);
    ringGrad.addColorStop(1, COLORS.gold);
    ctx.strokeStyle = ringGrad;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(115, height / 2, 83, 0, Math.PI * 2);
    ctx.stroke();
  } catch (e) {}

  // Username
  ctx.font = 'bold 34px sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(member.displayName.substring(0, 18), 220, 75);
  ctx.shadowBlur = 0;

  // Tag
  ctx.font = '18px sans-serif';
  ctx.fillStyle = COLORS.subtext;
  ctx.fillText(`@${member.user.username}`, 222, 105);

  // Rank badge
  const rankColor = rank === 1 ? COLORS.gold : rank === 2 ? COLORS.silver : rank === 3 ? COLORS.bronze : COLORS.accent;
  ctx.fillStyle = rankColor;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`# ${rank}`, 580, 75);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = COLORS.subtext;
  ctx.fillText('Server Rank', 575, 95);

  // Stats row
  const stats = [
    { label: 'LEVEL', value: userData.level },
    { label: 'TOTAL XP', value: userData.xp.toLocaleString() },
    { label: 'MESSAGES', value: userData.messages.toLocaleString() },
    { label: 'VOICE (min)', value: userData.voice_minutes.toLocaleString() },
  ];

  stats.forEach((stat, i) => {
    const x = 220 + i * 140;
    const y = 140;

    ctx.fillStyle = 'rgba(88,166,255,0.08)';
    roundRect(ctx, x - 5, y - 22, 125, 55, 8);
    ctx.fill();

    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(stat.value, x, y);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = COLORS.subtext;
    ctx.fillText(stat.label, x, y + 20);
  });

  // XP progress bar
  const barX = 220, barY = 220, barW = 530, barH = 22;
  const currentLevelXP = xpForLevel(userData.level);
  const nextLevelXP = xpForLevel(userData.level + 1);
  const progress = Math.min((userData.xp - currentLevelXP) / (nextLevelXP - currentLevelXP), 1);

  // Bar background
  ctx.fillStyle = COLORS.bar_bg;
  roundRect(ctx, barX, barY, barW, barH, 11);
  ctx.fill();

  // Bar fill
  if (progress > 0) {
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fillGrad.addColorStop(0, '#238636');
    fillGrad.addColorStop(0.5, '#58a6ff');
    fillGrad.addColorStop(1, '#FFD700');
    ctx.fillStyle = fillGrad;
    roundRect(ctx, barX, barY, Math.max(barW * progress, 11), barH, 11);
    ctx.fill();
  }

  // Bar label
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = COLORS.text;
  const xpInLevel = userData.xp - currentLevelXP;
  const xpNeeded = nextLevelXP - currentLevelXP;
  ctx.fillText(`${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP  •  ${Math.floor(progress * 100)}% to Level ${userData.level + 1}`, barX, barY + barH + 20);

  return canvas.toBuffer('image/png');
}

async function generateLeaderboardCard(entries, page, totalPages, guild) {
  const width = 780;
  const rowH = 65;
  const headerH = 100;
  const footerH = 50;
  const height = headerH + entries.length * rowH + footerH;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#0d1117');
  bgGrad.addColorStop(1, '#161b22');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, width, height, 16);
  ctx.fill();

  // Header
  ctx.font = 'bold 36px sans-serif';
  const hGrad = ctx.createLinearGradient(0, 0, width, 0);
  hGrad.addColorStop(0, COLORS.accent);
  hGrad.addColorStop(1, COLORS.gold);
  ctx.fillStyle = hGrad;
  ctx.fillText('🏆  LEADERBOARD', 30, 55);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = COLORS.subtext;
  ctx.fillText(`${guild.name}  •  Page ${page} / ${totalPages}`, 32, 82);

  // Divider
  ctx.strokeStyle = 'rgba(88,166,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, headerH - 8);
  ctx.lineTo(width - 20, headerH - 8);
  ctx.stroke();

  // Rows
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const y = headerH + i * rowH;
    const rank = (page - 1) * 10 + i + 1;

    // Row highlight for top 3
    if (rank <= 3) {
      const rowAlpha = rank === 1 ? 0.12 : rank === 2 ? 0.08 : 0.05;
      const rowColor = rank === 1 ? `rgba(255,215,0,${rowAlpha})` : rank === 2 ? `rgba(192,192,192,${rowAlpha})` : `rgba(205,127,50,${rowAlpha})`;
      ctx.fillStyle = rowColor;
      roundRect(ctx, 10, y + 5, width - 20, rowH - 8, 8);
      ctx.fill();
    }

    // Rank medal or number
    const medalColors = [COLORS.gold, COLORS.silver, COLORS.bronze];
    ctx.font = rank <= 3 ? 'bold 22px sans-serif' : 'bold 18px sans-serif';
    ctx.fillStyle = rank <= 3 ? medalColors[rank - 1] : COLORS.subtext;
    ctx.fillText(rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`, 25, y + rowH / 2 + 8);

    // Avatar
    try {
      const member = await guild.members.fetch(entry.user_id).catch(() => null);
      if (member) {
        const avatarURL = member.displayAvatarURL({ extension: 'png', size: 64, forceStatic: true });
        const avatar = await loadImage(avatarURL);
        ctx.save();
        ctx.beginPath();
        ctx.arc(95, y + rowH / 2, 22, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 73, y + rowH / 2 - 22, 44, 44);
        ctx.restore();

        // Username
        ctx.font = 'bold 17px sans-serif';
        ctx.fillStyle = COLORS.text;
        ctx.fillText(member.displayName.substring(0, 18), 130, y + rowH / 2 + 2);
      } else {
        ctx.font = 'bold 17px sans-serif';
        ctx.fillStyle = COLORS.subtext;
        ctx.fillText('Unknown User', 130, y + rowH / 2 + 2);
      }
    } catch {}

    // Level
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`Lv. ${entry.level}`, 460, y + rowH / 2 + 2);

    // XP
    ctx.font = '14px sans-serif';
    ctx.fillStyle = COLORS.subtext;
    ctx.fillText(`${entry.xp.toLocaleString()} XP`, 570, y + rowH / 2 + 2);
  }

  // Footer divider
  ctx.strokeStyle = 'rgba(88,166,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(20, height - footerH);
  ctx.lineTo(width - 20, height - footerH);
  ctx.stroke();

  ctx.font = '13px sans-serif';
  ctx.fillStyle = COLORS.subtext;
  ctx.fillText('LevelGuard Bot  •  Activity-based ranking', 30, height - 18);

  return canvas.toBuffer('image/png');
}

async function generateWeeklyWinnerCard(member, userData, guild) {
  const width = 750;
  const height = 280;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 400);
  bgGrad.addColorStop(0, '#1a1400');
  bgGrad.addColorStop(1, '#0d1117');
  ctx.fillStyle = bgGrad;
  roundRect(ctx, 0, 0, width, height, 20);
  ctx.fill();

  // Gold particles
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,215,0,${Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gold border
  const borderGrad = ctx.createLinearGradient(0, 0, width, height);
  borderGrad.addColorStop(0, '#FFD700');
  borderGrad.addColorStop(0.5, '#FFA500');
  borderGrad.addColorStop(1, '#FFD700');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  roundRect(ctx, 2, 2, width - 4, height - 4, 18);
  ctx.stroke();

  // Avatar
  try {
    const avatarURL = member.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
    const avatar = await loadImage(avatarURL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(110, height / 2, 80, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 30, height / 2 - 80, 160, 160);
    ctx.restore();

    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 25;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(110, height / 2, 83, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } catch {}

  ctx.font = 'bold 36px sans-serif';
  const titleGrad = ctx.createLinearGradient(220, 0, 600, 0);
  titleGrad.addColorStop(0, '#FFD700');
  titleGrad.addColorStop(1, '#FFA500');
  ctx.fillStyle = titleGrad;
  ctx.fillText('🏆  WEEKLY WINNER', 220, 80);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText(member.displayName.substring(0, 18), 222, 125);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.fillText(`+${userData.weekly_xp.toLocaleString()} XP this week`, 222, 158);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = COLORS.subtext;
  ctx.fillText(`Level ${userData.level}  •  ${userData.xp.toLocaleString()} total XP`, 222, 190);
  ctx.fillText(`${userData.messages} messages  •  ${userData.voice_minutes} min in voice`, 222, 215);

  return canvas.toBuffer('image/png');
}

// Helper: rounded rect
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

module.exports = {
  generateLevelUpCard,
  generateProfileCard,
  generateLeaderboardCard,
  generateWeeklyWinnerCard,
};