require("dotenv").config({ quiet: true });
const {
  Client,
  Intents,
  Permissions,
  MessageActionRow,
  Modal,
  TextInputComponent
} = require("discord.js");
const {
  isValidCommandName,
  upsertCommand,
  getCommand,
  deleteCommand,
  listCommands
} = require("./store");
const { RESERVED_COMMANDS, buildGuildCommands } = require("./command-definitions");

const token = process.env.DISCORD_TOKEN;
const guildIdsRaw = process.env.DISCORD_GUILD_IDS || process.env.DISCORD_GUILD_ID || "";
const configuredGuildIds = guildIdsRaw
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const allowedUserIds = (process.env.ALLOWED_USER_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const allowedRoleIds = (process.env.ALLOWED_ROLE_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const accessControlEnabled = allowedUserIds.length > 0 || allowedRoleIds.length > 0;
if (!token) {
  console.error("Missing DISCORD_TOKEN in .env");
  process.exit(1);
}
if (configuredGuildIds.length === 0) {
  console.error("Missing DISCORD_GUILD_ID or DISCORD_GUILD_IDS in .env");
  process.exit(1);
}

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.MESSAGE_CONTENT]
});

function hasManageGuildPermission(interaction) {
  if (!interaction.memberPermissions) {
    return false;
  }
  return interaction.memberPermissions.has(Permissions.FLAGS.MANAGE_GUILD);
}

function hasAllowedRole(interaction) {
  const roleCache = interaction.member && interaction.member.roles && interaction.member.roles.cache;
  if (!roleCache || allowedRoleIds.length === 0) {
    return false;
  }

  return allowedRoleIds.some((roleId) => roleCache.has(roleId));
}

function canUseBot(interaction) {
  if (!interaction.inGuild()) {
    return false;
  }

  if (!accessControlEnabled) {
    return true;
  }

  if (hasManageGuildPermission(interaction)) {
    return true;
  }

  if (allowedUserIds.includes(interaction.user.id)) {
    return true;
  }

  return hasAllowedRole(interaction);
}

async function syncGuildCommands(guild) {
  const commands = buildGuildCommands(listCommands());
  await guild.commands.set(commands);
}

async function syncConfiguredGuilds() {
  let failedGuilds = 0;

  for (const guildId of configuredGuildIds) {
    try {
      const guild = await client.guilds.fetch(guildId);
      await syncGuildCommands(guild);
    } catch (error) {
      failedGuilds += 1;
      console.error(`Failed to sync guild ${guildId}:`, error.message);
    }
  }

  return { failedGuilds };
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const { failedGuilds } = await syncConfiguredGuilds();
    if (failedGuilds > 0) {
      console.log(
        `Slash commands synchronized with ${failedGuilds} failure(s) across ${configuredGuildIds.length} configured server(s).`
      );
    } else {
      console.log(`Slash commands synchronized for ${configuredGuildIds.length} server(s).`);
    }
  } catch (error) {
    console.error("Failed to synchronize slash commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isModalSubmit() && interaction.customId.startsWith("setpost:")) {
    if (!canUseBot(interaction)) {
      await interaction.reply({
        content: "You are not allowed to use this bot.",
        ephemeral: true
      });
      return;
    }

    const keyInput = interaction.customId.replace("setpost:", "");
    const info = interaction.fields.getTextInputValue("information");

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
          "Invalid command name. Use 2-32 chars: letters, numbers, underscore, or hyphen.",
        ephemeral: true
      });
      return;
    }

    if (RESERVED_COMMANDS.has(keyInput.toLowerCase())) {
      await interaction.reply({
        content: "That command name is reserved. Please choose a different name.",
        ephemeral: true
      });
      return;
    }

    const savedKey = upsertCommand(keyInput, info, interaction.user.id);

    await interaction.reply({
      content: `Text saved for /${savedKey}. To add images/files, post them in this channel within the next 60 seconds and I'll attach them.`,
      ephemeral: false
    });

    const channel = interaction.channel;
    const userId = interaction.user.id;

    const messageFilter = (msg) => {
      return msg.author.id === userId && msg.attachments.size > 0;
    };

    try {
      const collected = await channel.awaitMessages({
        filter: messageFilter,
        max: 1,
        time: 60000,
        errors: ["time"]
      });

      if (collected.size > 0) {
        const msg = collected.first();
        const attachmentUrls = msg.attachments.map((att) => att.url);

        upsertCommand(keyInput, info, interaction.user.id, attachmentUrls);
        await syncConfiguredGuilds();

        await interaction.followUp({
          content: `✓ Attached ${attachmentUrls.length} file(s) to /${savedKey}`,
          ephemeral: true
        });

        try {
          await msg.delete();
        } catch {
          // silently fail if can't delete
        }
      }
    } catch (error) {
      await interaction.followUp({
        content: "Timed out waiting for attachments. Post saved without images.",
        ephemeral: true
      });
    }

    await syncConfiguredGuilds();
    return;
  }

  if (!interaction.isCommand()) {
    return;
  }

  if (!canUseBot(interaction)) {
    await interaction.reply({
      content: "You are not allowed to use this bot.",
      ephemeral: true
    });
    return;
  }

  const commandName = interaction.commandName;

  if (commandName === "setpost") {
    const keyInput = interaction.options.getString("command", true);

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
          "Invalid command name. Use 2-32 chars: letters, numbers, underscore, or hyphen.",
        ephemeral: true
      });
      return;
    }

    if (RESERVED_COMMANDS.has(keyInput.toLowerCase())) {
      await interaction.reply({
        content: "That command name is reserved. Please choose a different name.",
        ephemeral: true
      });
      return;
    }

    const modal = new Modal()
      .setCustomId(`setpost:${keyInput}`)
      .setTitle(`Set post: ${keyInput}`);

    const informationInput = new TextInputComponent()
      .setCustomId("information")
      .setLabel("Information")
      .setStyle("PARAGRAPH")
      .setPlaceholder("Paste your full post here. Line breaks are supported.")
      .setRequired(true)
      .setMaxLength(1900);

    const firstRow = new MessageActionRow().addComponents(informationInput);
    modal.addComponents(firstRow);

    await interaction.showModal(modal);
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

    const replyObject = {
      content: post.content || "(No text content)"
    };

    if (post.attachments && post.attachments.length > 0) {
      replyObject.files = post.attachments;
    }

    await interaction.reply(replyObject);
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
    if (deleted) {
      await syncConfiguredGuilds();
    }
    await interaction.reply({
      content: deleted
        ? "Post deleted."
        : "No post found for that command name.",
      ephemeral: true
    });
    return;
  }

  if (commandName === "list") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== "post") {
      await interaction.reply({
        content: "Use /list post to view saved post command names.",
        ephemeral: true
      });
      return;
    }

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
    return;
  }

  if (commandName === "sneakybot") {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand !== "help") {
      await interaction.reply({
        content: "Use /sneakybot help to see available commands.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: [
        "SneakyBot Commands:",
        "- /setpost command:<name> -> open modal to save or update a post",
        "- /<name> -> show the saved post for that command",
        "- /post command:<name> -> fallback lookup by command name",
        "- /list post -> list all saved post command names",
        "- /deletepost command:<name> -> delete a saved post",
        "- !set <name> <info> -> save/update from message command",
        "- !<name> -> show the saved post from message command"
      ].join("\n"),
      ephemeral: true
    });
    return;
  }

  const dynamicPost = getCommand(commandName);
  if (dynamicPost) {
    const replyObject = {
      content: dynamicPost.content || "(No text content)"
    };

    if (dynamicPost.attachments && dynamicPost.attachments.length > 0) {
      replyObject.files = dynamicPost.attachments;
    }

    await interaction.reply(replyObject);
  }
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) {
    return;
  }

  const raw = message.content.trim();
  if (!raw.startsWith("!")) {
    return;
  }

  const setMatch = raw.match(/^!set\s+(\S+)\s+([\s\S]+)$/i);

  if (setMatch) {
    const keyInput = setMatch[1].trim();
    const info = setMatch[2].trim();

    if (!isValidCommandName(keyInput)) {
      await message.reply("Invalid command name. Use 2-32 chars: letters, numbers, underscore, or hyphen.");
      return;
    }

    if (RESERVED_COMMANDS.has(keyInput.toLowerCase())) {
      await message.reply("That command name is reserved. Please choose a different name.");
      return;
    }

    const attachmentUrls = message.attachments.map((att) => att.url);
    const savedKey = upsertCommand(keyInput, info, message.author.id, attachmentUrls);
    await syncConfiguredGuilds();

    const attachmentText = attachmentUrls.length > 0
      ? ` with ${attachmentUrls.length} attachment(s)`
      : "";
    await message.reply(`Saved !${savedKey}${attachmentText}. You can also use /${savedKey}.`);
    return;
  }

  if (/^!set\b/i.test(raw)) {
    await message.reply("Usage: !set <command> <info>. Example: !set BlameMibs This has to be all Mibs fault");
    return;
  }

  const keyInput = raw.slice(1).trim();
  if (!keyInput || keyInput.includes(" ")) {
    return;
  }

  const post = getCommand(keyInput);
  if (!post) {
    return;
  }

  const replyObject = {
    content: post.content || "(No text content)"
  };

  if (post.attachments && post.attachments.length > 0) {
    replyObject.files = post.attachments;
  }

  await message.channel.send(replyObject);
});

client.login(token);
