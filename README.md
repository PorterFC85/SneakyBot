# SneakyBot Discord Bot

This bot manages saved posts and cut polls for a Discord server.

## Features

- Create or edit a saved post with `/set`
- Review the saved post preview in DM before confirming it
- Retrieve saved content with `!command`
- List saved post commands with `/posts`
- Delete saved posts with `/deletepost`
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
5. In **Bot > Privileged Gateway Intents**, enable **Message Content Intent** so `!command` retrieval works.
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

- Create a new post:
  - `/set command:macros`
  - Send the content in DM (emojis and line breaks are supported)
  - Confirm or deny the preview in DM within 3 minutes
- Edit an existing post:
  - `/set command:macros`
  - Review the current saved post in DM
  - Choose whether to edit it, then confirm the replacement preview in DM
- Retrieve a saved post:
  - `!macros`
- List saved posts:
  - `/posts`
- Delete a saved post:
  - `/deletepost command:macros`
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

Saved posts and cut poll state are stored in `data/posts.json`.

## Legal

- Terms of Service: `TERMS_OF_SERVICE.md`
- Privacy Policy: `PRIVACY_POLICY.md`
