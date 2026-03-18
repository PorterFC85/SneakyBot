require("dotenv").config();
const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const {
  isValidCommandName,
  upsertCommand,
  getCommand,
  deleteCommand,
  listCommands
} = require("./store");

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function hasManageGuildPermission(interaction) {
  if (!interaction.memberPermissions) {
    return false;
  }
  return interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild);
}

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const commandName = interaction.commandName;

  if (commandName === "setpost") {
    const keyInput = interaction.options.getString("command", true);
    const info = interaction.options.getString("information", true);

    if (!hasManageGuildPermission(interaction)) {
      await interaction.reply({
        content: "You need the Manage Server permission to create or update posts.",
        ephemeral: true
      });
      return;
    }

    if (!isValidCommandName(keyInput)) {
      await interaction.reply({
        content:
          "Invalid command name. Use 2-32 chars: lowercase letters, numbers, underscore, or hyphen.",
        ephemeral: true
      });
      return;
    }

    const savedKey = upsertCommand(keyInput, info, interaction.user.id);
    await interaction.reply({
      content: `Saved post for /post command:${savedKey}`,
      ephemeral: true
    });
    return;
  }

  if (commandName === "post") {
    const keyInput = interaction.options.getString("command", true);
    const post = getCommand(keyInput);

    if (!post) {
      await interaction.reply({
        content: "No post found for that command name.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply(post.content);
    return;
  }

  if (commandName === "deletepost") {
    const keyInput = interaction.options.getString("command", true);

    if (!hasManageGuildPermission(interaction)) {
      await interaction.reply({
        content: "You need the Manage Server permission to delete posts.",
        ephemeral: true
      });
      return;
    }

    const deleted = deleteCommand(keyInput);
    await interaction.reply({
      content: deleted
        ? "Post deleted."
        : "No post found for that command name.",
      ephemeral: true
    });
    return;
  }

  if (commandName === "listposts") {
    const commands = listCommands();

    if (commands.length === 0) {
      await interaction.reply({
        content: "No posts saved yet.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: `Available command names: ${commands.map((name) => `/${name}`).join(", ")}`,
      ephemeral: true
    });
  }
});

client.login(token);
