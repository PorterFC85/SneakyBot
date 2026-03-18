require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID in .env");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("setpost")
    .setDescription("Create or update a stored post tied to a command name")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("Command name, like raid-rules")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("information")
        .setDescription("The text to store")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("post")
    .setDescription("Get information saved under a command name")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("Command name to look up")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("deletepost")
    .setDescription("Delete a stored post")
    .addStringOption((option) =>
      option
        .setName("command")
        .setDescription("Command name to delete")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("listposts")
    .setDescription("Show all available command names")
].map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log(`Refreshing ${commands.length} guild slash commands...`);
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands
    });
    console.log("Guild slash commands registered.");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
