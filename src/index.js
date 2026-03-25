require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ─── Font Download ─────────────────────────────────────────
const ASSETS_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

// Multiple URL sources per font — tries each until one works
const FONTS = [
  {
    file: path.join(ASSETS_DIR, 'NotoSans-Bold.ttf'),
    urls: [
      'https://fonts.gstatic.com/s/notosans/v36/o-0bIpQlx3QUlC5A4PNjXhFVZNyBx2pqPIif.ttf',
      'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/unhinted/ttf/NotoSans-Bold.ttf',
      'https://raw.githubusercontent.com/notofonts/latin-greek-cyrillic/main/fonts/NotoSans/unhinted/ttf/NotoSans-Bold.ttf',
    ],
  },
  {
    file: path.join(ASSETS_DIR, 'NotoSans-Regular.ttf'),
    urls: [
      'https://fonts.gstatic.com/s/notosans/v36/o-0IIpQlx3QUlC5A4PNb91N.ttf',
      'https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/NotoSans/unhinted/ttf/NotoSans-Regular.ttf',
      'https://raw.githubusercontent.com/notofonts/latin-greek-cyrillic/main/fonts/NotoSans/unhinted/ttf/NotoSans-Regular.ttf',
    ],
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);

    const get = (u, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      const p = u.startsWith('https') ? https : http;
      p.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.destroy();
          return get(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          file.destroy();
          fs.unlink(tmp, () => {});
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            // Verify file is a valid TTF (starts with version tag 0x00010000 or 'true' or 'OTTO')
            try {
              const buf = Buffer.alloc(4);
              const fd = fs.openSync(tmp, 'r');
              fs.readSync(fd, buf, 0, 4, 0);
              fs.closeSync(fd);
              const magic = buf.readUInt32BE(0);
              // 0x00010000 = TTF, 0x74727565 = 'true', 0x4F54544F = 'OTTO' (OTF)
              if (magic === 0x00010000 || magic === 0x74727565 || magic === 0x4F54544F) {
                fs.renameSync(tmp, dest);
                resolve();
              } else {
                fs.unlink(tmp, () => {});
                reject(new Error('Not a valid TTF/OTF file'));
              }
            } catch (e) {
              fs.unlink(tmp, () => {});
              reject(e);
            }
          });
        });
        file.on('error', (e) => { fs.unlink(tmp, () => {}); reject(e); });
      }).on('error', (e) => { fs.unlink(tmp, () => {}); reject(e); });
    };
    get(url);
  });
}

async function ensureFonts() {
  for (const font of FONTS) {
    const name = path.basename(font.file);
    if (fs.existsSync(font.file)) {
      console.log(`✅ Font already cached: ${name}`);
      continue;
    }
    let downloaded = false;
    for (const url of font.urls) {
      try {
        console.log(`⬇️  Trying: ${url}`);
        await downloadFile(url, font.file);
        console.log(`✅ Font downloaded: ${name}`);
        downloaded = true;
        break;
      } catch (e) {
        console.warn(`   ❌ Failed (${e.message}), trying next...`);
      }
    }
    if (!downloaded) {
      console.error(`❌ Could not download ${name} from any source. Text may not render.`);
    }
  }
}

// ─── Boot ──────────────────────────────────────────────────
const { initDatabase } = require('./database');
const { scheduleWeeklyAnnouncement } = require('./utils/weekly');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
fs.readdirSync(commandsPath).filter(f => f.endsWith('.js')).forEach(file => {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) client.commands.set(command.data.name, command);
});

const eventsPath = path.join(__dirname, 'events');
fs.readdirSync(eventsPath).filter(f => f.endsWith('.js')).forEach(file => {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
      const reply = { content: '❌ An error occurred.', ephemeral: true };
      interaction.replied || interaction.deferred
        ? await interaction.followUp(reply)
        : await interaction.reply(reply);
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('lb_')) {
    const cmd = client.commands.get('leaderboard');
    if (cmd?.handleButton) await cmd.handleButton(interaction, client);
  }
});

(async () => {
  // Step 1: Download fonts FIRST
  await ensureFonts();

  // Step 2: DB + bot (canvas.js will register fonts lazily when first draw happens)
  await initDatabase();
  scheduleWeeklyAnnouncement(client);
  await client.login(process.env.BOT_TOKEN);
})();
