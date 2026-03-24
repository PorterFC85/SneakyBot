require("dotenv").config({ quiet: true });
const { Client, GatewayIntentBits } = require("discord.js");
const { BASE_COMMANDS } = require("./command-definitions");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildIdsRaw = process.env.DISCORD_GUILD_IDS || process.env.DISCORD_GUILD_ID || "";
const guildIds = guildIdsRaw
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

if (!token || !clientId || guildIds.length === 0) {
  console.error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID(S) in .env");
  process.exit(1);
}

const commands = BASE_COMMANDS;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  let failedGuilds = 0;

  try {
    console.log(`Refreshing ${commands.length} commands for ${guildIds.length} server(s)...`);
    for (const guildId of guildIds) {
      try {
        const guild = await client.guilds.fetch(guildId);
        await guild.commands.set(commands);
        console.log(`Registered commands in guild ${guildId}`);
      } catch (guildError) {
        failedGuilds += 1;
        console.error(`Failed to register commands in guild ${guildId}:`, guildError.message);
      }
    }
    if (failedGuilds > 0) {
      console.log(`Completed with ${failedGuilds} guild failure(s).`);
      process.exitCode = 1;
    } else {
      console.log("Guild slash commands registered.");
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.destroy();
  }
});

client.login(token).catch((error) => {
  console.error(error);
  process.exit(1);
});
