# SneakyBot Discord Cut Poll Bot

This bot manages cut nominations and voting polls with Discord slash commands.

## Features

- Open the nomination modal with `/nominate`
- Start a poll from queued nominations with `/cut vote`
- End an active poll with `/cut end`
- Repost the most recent results with `/cuts`
- Show command help with `/sneakybot help`

By default, anyone in your server can use commands unless access restrictions are configured.

## 1) Create the Discord application and bot

1. Go to Discord Developer Portal.
2. Create a New Application.
3. Open the **Bot** section and create a bot user.
4. Copy the bot token.
5. In **Bot > Privileged Gateway Intents**, no extra intents are required for the current slash-command-only bot.
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

- Add nominees:
  - `/nominate`
  - Enter one name per line in the modal
- Start the poll:
  - `/cut vote`
- End the poll early:
  - `/cut end`
- Repost the last result:
  - `/cuts`
- Show all bot command usage:
  - `/sneakybot help`

## Data storage

Cut poll state is stored in `data/posts.json`.

## Legal

- Terms of Service: `TERMS_OF_SERVICE.md`
- Privacy Policy: `PRIVACY_POLICY.md`
