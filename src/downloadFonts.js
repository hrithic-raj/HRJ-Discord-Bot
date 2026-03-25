#!/usr/bin/env node
// Run once: node src/downloadFonts.js
// Downloads fonts needed for canvas rendering on Linux (Railway/Render)

const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, 'assets');
if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });

const fonts = [
  {
    name: 'NotoSans-Bold.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Bold.ttf',
  },
  {
    name: 'NotoSans-Regular.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/notosans/NotoSans-Regular.ttf',
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`✅ Already exists: ${path.basename(dest)}`);
      return resolve();
    }
    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return get(res.headers.location);
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    get(url);
    console.log(`⬇️  Downloading: ${path.basename(dest)}`);
  });
}

(async () => {
  for (const font of fonts) {
    await download(font.url, path.join(FONTS_DIR, font.name));
  }
  console.log('✅ All fonts ready');
})();
