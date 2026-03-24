# 🤖 LevelGuard Discord Bot

A professional Discord bot with XP-based level tracking, role logging, voice logging, leaderboards, and weekly winner announcements.

## Features

### 📊 Level System
- XP gained from **messages** (15–25 XP, 1-minute cooldown)
- XP gained from **voice channel time** (5 XP/minute)
- Automatic level-up announcements with profile card image
- Role rewards on level-up

### 📋 Logging
- **Role Logs**: Who added/removed a role, and who did it
- **Voice Logs**: Join, leave, move, and drag events
- Audit log integration to detect who moved a user

### 🏆 Leaderboard
- Full paginated leaderboard with profile pictures
- `/leaderboard` with ◀ Prev / Next ▶ buttons

### 🎁 Rewards
- Assign roles to specific levels with `/reward set`
- Auto-assigned when user reaches the level

### 🗓️ Weekly Winner
- Every Sunday at 11:55 PM UTC
- Announces the most active member based on weekly XP

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure `.env`
```env
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_server_id_here
```

### 3. Deploy slash commands
```bash
npm run deploy
```

### 4. Start the bot
```bash
npm start
# or for development:
npm run dev
```

---

## Commands

| Command | Description | Permission |
|---|---|---|
| `/level [user]` | View level profile card | Everyone |
| `/leaderboard [page]` | Paginated XP leaderboard | Everyone |
| `/setlevelchannel` | Set level-up announcement channel | Admin |
| `/setlogchannel` | Set logging channel | Admin |
| `/setuserlevel` | Manually set a user's level | Admin |
| `/reward set` | Assign a role reward to a level | Admin |
| `/reward list` | List all level rewards | Admin |

---

## Required Bot Permissions
- View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- View Audit Log
- Manage Roles
- Connect (Voice)

## Required Privileged Intents
- Server Members Intent ✅
- Message Content Intent ✅
- Presence Intent ✅