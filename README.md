# SneakyBot Discord Info Bot

This bot lets your group save information under command names and pull it later with slash commands.

## Features

- Save or update a post: `/setpost`
- Get a saved post: `/post`
- List all saved command names: `/listposts`
- Delete a saved post: `/deletepost`

Anyone in your server can use `/post` and `/listposts`.
Only users with **Manage Server** permission can use `/setpost` and `/deletepost`.

## 1) Create the Discord application and bot

1. Go to Discord Developer Portal.
2. Create a New Application.
3. Open the **Bot** section and create a bot user.
4. Copy the bot token.
5. In **OAuth2 > URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `Send Messages`, `Use Slash Commands`
6. Open the generated URL and invite the bot to your server.

## 2) Configure environment

1. Copy `.env.example` to `.env`.
2. Fill in:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID` (Application ID)
   - `DISCORD_GUILD_ID` (your server ID)

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
  - `/setpost command:rules information:Be respectful. No spoilers without warning.`
- Retrieve it:
  - `/post command:rules`
- List available command names:
  - `/listposts`

## Data storage

Posts are stored in `data/posts.json`.

## Legal

- Terms of Service: `TERMS_OF_SERVICE.md`
- Privacy Policy: `PRIVACY_POLICY.md`
