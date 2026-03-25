require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── Font Download (must happen before canvas is used) ─────
const ASSETS_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

const FONTS = [
  {
    file: path.join(ASSETS_DIR, 'NotoSans-Bold.ttf'),
    url: 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Bold.ttf',
  },
  {
    file: path.join(ASSETS_DIR, 'NotoSans-Regular.ttf'),
    url: 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) return resolve();
    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

async function ensureFonts() {
  for (const font of FONTS) {
    try {
      await downloadFile(font.url, font.file);
      console.log(`✅ Font ready: ${path.basename(font.file)}`);
    } catch (e) {
      console.warn(`⚠️ Font download failed: ${path.basename(font.file)} — ${e.message}`);
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
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error(err);
      const reply = { content: '❌ An error occurred executing this command.', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId.startsWith('lb_')) {
      const lbCommand = client.commands.get('leaderboard');
      if (lbCommand && lbCommand.handleButton) {
        await lbCommand.handleButton(interaction, client);
      }
    }
  }
});

// ─── Start everything ──────────────────────────────────────
(async () => {
  // 1. Download fonts first — canvas.js needs them registered on require
  await ensureFonts();

  // 2. Now safe to require canvas (fonts are on disk before registerFromPath runs)
  require('./utils/canvas');

  // 3. Connect DB and start bot
  await initDatabase();
  scheduleWeeklyAnnouncement(client);
  await client.login(process.env.BOT_TOKEN);
})();