# SneakyBot Discord Info Bot

This bot lets your group save information under command names and pull it later with slash commands.

## Features

- Save or update a post: `/setpost`
- Get a saved post: `/<your-command>`
- Legacy lookup still available: `/post`
- List all saved command names: `/list post`
- Show command help: `/sneakybot help`
- Delete a saved post: `/deletepost`
- Prefix set command: `!set BlameMibs This has to be all Mibs fault`
- Prefix get command: `!BlameMibs`

By default, anyone in your server can use commands.
Only users with **Manage Server** permission can use `/setpost` and `/deletepost`.

## 1) Create the Discord application and bot

1. Go to Discord Developer Portal.
2. Create a New Application.
3. Open the **Bot** section and create a bot user.
4. Copy the bot token.
5. In **Bot > Privileged Gateway Intents**, enable **Message Content Intent** (required for `!` commands).
6. In **OAuth2 > URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`
7. Open the generated URL and invite the bot to your server.

## 2) Configure environment

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID` (Application ID)
  - `DISCORD_GUILD_ID` (single server ID)
  - or `DISCORD_GUILD_IDS` (comma-separated server IDs for multi-server use)
  - optional `ALLOWED_USER_IDS` (comma-separated user IDs)
  - optional `ALLOWED_ROLE_IDS` (comma-separated role IDs)
  - optional `CUT_POLL_CHANNEL_ID` (channel ID where `/cut` and `/cuts` are allowed)

If `ALLOWED_USER_IDS` and/or `ALLOWED_ROLE_IDS` are set, only those users/roles (plus Manage Server admins) can use the bot.

To get your server ID, enable Developer Mode in Discord and right-click your server.

## 3) Install and register slash commands

```bash
npm install
npm run deploy
```

## 4) Start the bot

```bash
npm start
```

## Usage examples

- Save a post:
  - `/setpost command:rules`
  - A modal opens with a large multiline "Information" box
- Retrieve it:
  - `/rules`
  - or `/post command:rules`
- List available command names:
  - `/list post`
- Show all bot command usage:
  - `/sneakybot help`
- Prefix set/get examples:
  - `!set BlameMibs This has to be all Mibs fault`
  - `!BlameMibs`

## Data storage

Posts are stored in `data/posts.json`.

## Legal

- Terms of Service: `TERMS_OF_SERVICE.md`
- Privacy Policy: `PRIVACY_POLICY.md`
