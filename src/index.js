require("dotenv").config({ quiet: true });
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const {
  isValidCommandName,
  upsertCommand,
  getCommand,
  deleteCommand,
  listCommands,
  upsertCutNomination,
  getQueuedCutNominations,
  clearQueuedCutNominations,
  getQueueStartedAt,
  findCutReason,
  startCutPoll,
  getActiveCutPoll,
  clearActiveCutPoll,
  recordCutVote,
  listActiveCutPolls,
  setLastCutPollResult,
  getLastCutPollResult,
  normalizePersonName
} = require("./store");
const { RESERVED_COMMANDS, buildGuildCommands } = require("./command-definitions");

const CUT_POLL_DURATION_MS = 5 * 60 * 1000;
const CUT_VOTE_CUSTOM_ID_PREFIX = "cutvote:";
const NOMINATION_EXPIRY_MS = 2 * 60 * 60 * 1000;
const nominationPurgeTimers = new Map();

const cutPollChannelIds = (process.env.CUT_POLL_CHANNEL_ID || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

function hasManageGuildPermission(interaction) {
  if (!interaction.memberPermissions) {
    return false;
  }
  return interaction.memberPermissions.has(PermissionsBitField.Flags.ManageGuild);
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

function scheduleNominationPurge(guildId, delayMs) {
  const existing = nominationPurgeTimers.get(guildId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    nominationPurgeTimers.delete(guildId);
    clearQueuedCutNominations(guildId);
    console.log(`[NominationPurge] Cleared stale nominations for guild ${guildId} after 2 hours.`);
  }, delayMs);

  nominationPurgeTimers.set(guildId, timer);
}

function cancelNominationPurge(guildId) {
  const existing = nominationPurgeTimers.get(guildId);
  if (existing) {
    clearTimeout(existing);
    nominationPurgeTimers.delete(guildId);
  }
}

function isCutPollChannel(channelId) {
  if (cutPollChannelIds.length === 0) {
    return true;
  }

  return cutPollChannelIds.includes(channelId);
}

function getCutPollChannelWarning() {
  if (cutPollChannelIds.length === 0) {
    return "Cut poll channel is not configured. Ask an admin to set CUT_POLL_CHANNEL_ID in .env.";
  }

  const mentions = cutPollChannelIds.map((id) => `<#${id}>`).join(" or ");
  return `Cut poll commands can only be used in ${mentions}.`;
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

const cutPollTimeouts = new Map();

function clearCutPollTimeout(guildId) {
  const timer = cutPollTimeouts.get(guildId);
  if (timer) {
    clearTimeout(timer);
    cutPollTimeouts.delete(guildId);
  }
}

function buildCutVoteCustomId(normalizedName) {
  return `${CUT_VOTE_CUSTOM_ID_PREFIX}${encodeURIComponent(normalizedName)}`;
}

function parseCutVoteCustomId(customId) {
  if (!customId.startsWith(CUT_VOTE_CUSTOM_ID_PREFIX)) {
    return null;
  }

  const encoded = customId.slice(CUT_VOTE_CUSTOM_ID_PREFIX.length);
  if (!encoded) {
    return null;
  }

  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function buildCutVoteRows(entries) {
  const rows = [];
  let currentRow = new ActionRowBuilder();

  entries.forEach((entry, index) => {
    if (index > 0 && index % 5 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }

    const label = entry.name.length > 80 ? `${entry.name.slice(0, 77)}...` : entry.name;

    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(buildCutVoteCustomId(entry.normalizedName))
        .setLabel(label)
        .setStyle(ButtonStyle.Primary)
    );
  });

  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

function tallyCutPollVotes(activePoll) {
  const voteTotals = {};
  const entries = Array.isArray(activePoll.entries) ? activePoll.entries : [];

  entries.forEach((entry) => {
    voteTotals[entry.normalizedName] = 0;
  });

  const votes = activePoll.votes || {};
  Object.values(votes).forEach((choices) => {
    const selectedChoices = Array.isArray(choices) ? choices : [choices];
    selectedChoices.forEach((choice) => {
      if (Object.prototype.hasOwnProperty.call(voteTotals, choice)) {
        voteTotals[choice] += 1;
      }
    });
  });

  const ranked = entries
    .map((entry) => ({
      entry,
      count: voteTotals[entry.normalizedName] || 0
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return a.entry.name.localeCompare(b.entry.name);
    });

  const totalVotes = ranked.reduce((sum, item) => sum + item.count, 0);

  return {
    ranked,
    totalVoters: Object.keys(votes).length,
    totalVotes
  };
}

async function disableCutPollButtons(activePoll) {
  if (!activePoll || !activePoll.channelId || !activePoll.messageId) {
    return;
  }

  try {
    const channel = await client.channels.fetch(activePoll.channelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const pollMessage = await channel.messages.fetch(activePoll.messageId);
    if (!pollMessage || !pollMessage.components || pollMessage.components.length === 0) {
      return;
    }

    const disabledRows = pollMessage.components.map((row) => {
      const nextRow = new ActionRowBuilder();
      row.components.forEach((component) => {
        nextRow.addComponents(ButtonBuilder.from(component).setDisabled(true));
      });
      return nextRow;
    });

    await pollMessage.edit({ components: disabledRows });
  } catch {
    // Ignore cleanup failures if the message/channel is gone.
  }
}

async function postCutPollResults(guildId, activePoll, tally, endReason, endedByUserId) {
  let channel = null;

  try {
    channel = await client.channels.fetch(activePoll.channelId);
  } catch {
    channel = null;
  }

  if (!channel || !channel.isTextBased()) {
    return;
  }

  const header = endReason === "timeout"
    ? "Cut poll ended automatically after 5 minutes."
    : "Cut poll ended manually.";

  const voteLines = tally.ranked.map((item) => `- ${item.entry.name}: ${item.count} vote(s)`);
  const resultContent = [
    header,
    `Total voters: ${tally.totalVoters}`,
    `Total votes cast: ${tally.totalVotes}`,
    "Results:",
    ...voteLines
  ].join("\n");

  try {
    await channel.send({
      content: resultContent
    });
    return { ok: true, content: resultContent };
  } catch (error) {
    // Missing access can happen if channel permissions changed before poll close.
    const message = error && error.message ? error.message : "Unknown error";
    console.warn(`Failed to post cut poll results in guild ${guildId}: ${message}`);
    return { ok: false, reason: "post-failed", content: resultContent };
  }
}

async function finalizeCutPoll(guildId, endReason, endedByUserId = null) {
  const activePoll = getActiveCutPoll(guildId);
  if (!activePoll) {
    return { ok: false, reason: "no-active-poll" };
  }

  clearCutPollTimeout(guildId);
  const tally = tallyCutPollVotes(activePoll);

  clearActiveCutPoll(guildId);

  try {
    await disableCutPollButtons(activePoll);
    const postResult = await postCutPollResults(guildId, activePoll, tally, endReason, endedByUserId);
    setLastCutPollResult(guildId, {
      endedAt: new Date().toISOString(),
      content: postResult.content,
      totalVoters: tally.totalVoters,
      totalVotes: tally.totalVotes,
      entries: tally.ranked.map((item) => ({
        name: item.entry.name,
        votes: item.count
      }))
    });
    return { ok: true, tally, postResult };
  } catch (error) {
    const message = error && error.message ? error.message : "Unknown error";
    console.warn(`Cut poll finalized with partial failures in guild ${guildId}: ${message}`);
    return { ok: true, tally, postResult: { ok: false, reason: "finalize-failed" } };
  }
}

function scheduleCutPollTimeout(guildId, expiresAt) {
  clearCutPollTimeout(guildId);
  const expiryMs = new Date(expiresAt).getTime();

  if (!Number.isFinite(expiryMs)) {
    return;
  }

  const delay = expiryMs - Date.now();
  if (delay <= 0) {
    void finalizeCutPoll(guildId, "timeout");
    return;
  }

  const timer = setTimeout(() => {
    void finalizeCutPoll(guildId, "timeout");
  }, delay);

  cutPollTimeouts.set(guildId, timer);
}

function buildCutPollMessage(entries) {
  return [
    "Cut poll started. Vote by pressing one button below.",
    "The poll ends in 5 minutes or when /cut end is used.",
    "Nominees:",
    ...entries.map((entry, index) => `${index + 1}. ${entry.name}`)
  ].join("\n");
}

function restoreActiveCutPollTimeouts() {
  const activePolls = listActiveCutPolls();
  activePolls.forEach((pollInfo) => {
    scheduleCutPollTimeout(pollInfo.guildId, pollInfo.activePoll.expiresAt);
  });

  return activePolls.length;
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

    const restoredPolls = restoreActiveCutPollTimeouts();
    if (restoredPolls > 0) {
      console.log(`Recovered ${restoredPolls} active cut poll timeout(s).`);
    }

    let restoredPurges = 0;
    for (const guildId of configuredGuildIds) {
      const startedAt = getQueueStartedAt(guildId);
      if (!startedAt) continue;
      const activePoll = getActiveCutPoll(guildId);
      if (activePoll) continue;
      const elapsed = Date.now() - new Date(startedAt).getTime();
      const remaining = NOMINATION_EXPIRY_MS - elapsed;
      if (remaining <= 0) {
        clearQueuedCutNominations(guildId);
        console.log(`[NominationPurge] Cleared expired nominations for guild ${guildId} on startup.`);
      } else {
        scheduleNominationPurge(guildId, remaining);
        restoredPurges++;
      }
    }
    if (restoredPurges > 0) {
      console.log(`Recovered ${restoredPurges} nomination purge timer(s).`);
    }

  } catch (error) {
    console.error("Failed to synchronize slash commands:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith(CUT_VOTE_CUSTOM_ID_PREFIX)) {
    if (!canUseBot(interaction)) {
      await interaction.reply({
        content: "You are not allowed to use this bot.",
        ephemeral: true
      });
      return;
    }

    const guildId = interaction.guildId;
    if (!isCutPollChannel(interaction.channelId)) {
      await interaction.reply({
        content: getCutPollChannelWarning(),
        ephemeral: true
      });
      return;
    }

    const activePoll = getActiveCutPoll(guildId);
    if (!activePoll) {
      await interaction.reply({
        content: "There is no active cut poll right now.",
        ephemeral: true
      });
      return;
    }

    if (activePoll.messageId !== interaction.message.id) {
      await interaction.reply({
        content: "This vote button is no longer active.",
        ephemeral: true
      });
      return;
    }

    if (Date.now() >= new Date(activePoll.expiresAt).getTime()) {
      await finalizeCutPoll(guildId, "timeout");
      await interaction.reply({
        content: "This poll already timed out.",
        ephemeral: true
      });
      return;
    }

    const selectedName = parseCutVoteCustomId(interaction.customId);
    if (!selectedName) {
      await interaction.reply({
        content: "Invalid vote option.",
        ephemeral: true
      });
      return;
    }

    const voteResult = recordCutVote(guildId, interaction.user.id, selectedName);
    if (!voteResult.ok) {
      await interaction.reply({
        content: voteResult.reason === "duplicate-vote"
          ? "You already voted for that person. Pick another name if you want to cast more votes."
          : "Unable to record your vote for that option.",
        ephemeral: true
      });
      return;
    }

    const selectedEntry = activePoll.entries.find((entry) => entry.normalizedName === selectedName);
    await interaction.reply({
      content: `Vote recorded for ${selectedEntry ? selectedEntry.name : "that option"}. You can vote for more than one person.`,
      ephemeral: true
    });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === "nominate") {
    if (!canUseBot(interaction)) {
      await interaction.reply({ content: "You are not allowed to use this bot.", ephemeral: true });
      return;
    }

    const guildId = interaction.guildId;

    if (!isCutPollChannel(interaction.channelId)) {
      await interaction.reply({ content: getCutPollChannelWarning(), ephemeral: true });
      return;
    }

    const activePoll = getActiveCutPoll(guildId);
    if (activePoll) {
      await interaction.reply({
        content: "A cut poll is already active. Wait for it to end before adding nominations.",
        ephemeral: true
      });
      return;
    }

    const rawInput = interaction.fields.getTextInputValue("nominees");
    const names = rawInput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (names.length === 0) {
      await interaction.reply({ content: "No names were entered.", ephemeral: true });
      return;
    }

    const tooLong = names.find((n) => n.length > 80);
    if (tooLong) {
      await interaction.reply({
        content: `Name too long (max 80 chars): ${tooLong}`,
        ephemeral: true
      });
      return;
    }

    const added = [];
    for (const name of names) {
      const isNew = upsertCutNomination(guildId, name, "", interaction.user.id);
      if (isNew) added.push(name);
    }

    await interaction.reply({ content: "Nominations submitted.", ephemeral: true });

    for (const name of added) {
      await interaction.channel.send(`Nomination added - ${name}`);
    }

    if (added.length > 0) {
      const startedAt = getQueueStartedAt(guildId);
      const elapsed = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;
      const remaining = Math.max(NOMINATION_EXPIRY_MS - elapsed, 0);
      scheduleNominationPurge(guildId, remaining);
    }
    return;
  }

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

  if (!interaction.isChatInputCommand()) {
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

    const modal = new ModalBuilder()
      .setCustomId(`setpost:${keyInput}`)
      .setTitle(`Set post: ${keyInput}`);

    const informationInput = new TextInputBuilder()
      .setCustomId("information")
      .setLabel("Information")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Paste your full post here. Line breaks are supported.")
      .setRequired(true)
      .setMaxLength(1900);

    const firstRow = new ActionRowBuilder().addComponents(informationInput);
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

  if (commandName === "nominate") {
    if (!isCutPollChannel(interaction.channelId)) {
      await interaction.reply({ content: getCutPollChannelWarning(), ephemeral: true });
      return;
    }

    const activePoll = getActiveCutPoll(interaction.guildId);
    if (activePoll) {
      await interaction.reply({
        content: "A cut poll is already active. Wait for it to end before adding nominations.",
        ephemeral: true
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId("nominate")
      .setTitle("Nominate for Cut Poll");

    const nomineeInput = new TextInputBuilder()
      .setCustomId("nominees")
      .setLabel("Names to nominate (one per line)")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Player One\nPlayer Two\nPlayer Three")
      .setRequired(true)
      .setMaxLength(1000);

    modal.addComponents(new ActionRowBuilder().addComponents(nomineeInput));
    await interaction.showModal(modal);
    return;
  }

  if (commandName === "cut") {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!isCutPollChannel(interaction.channelId)) {
      await interaction.reply({
        content: getCutPollChannelWarning(),
        ephemeral: true
      });
      return;
    }

    if (subcommand === "why") {
      const person = interaction.options.getString("person", true);
      const nomination = findCutReason(guildId, person);

      if (!nomination) {
        await interaction.reply({
          content: "No nomination found for that person.",
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        content: `Reason for ${nomination.name}: ${nomination.reason}`,
        ephemeral: true
      });
      return;
    }

    if (subcommand === "vote") {
      const existingPoll = getActiveCutPoll(guildId);
      if (existingPoll) {
        await interaction.reply({
          content: "A cut poll is already active in this server.",
          ephemeral: true
        });
        return;
      }

      const queuedNominations = getQueuedCutNominations(guildId);
      if (queuedNominations.length === 0) {
        await interaction.reply({
          content: "No nominations queued. Use /nominate first.",
          ephemeral: true
        });
        return;
      }

      if (queuedNominations.length > 25) {
        await interaction.reply({
          content: "Too many nominations. Keep it to 25 or fewer.",
          ephemeral: true
        });
        return;
      }

      const entries = queuedNominations.map((entry) => ({
        name: entry.name,
        normalizedName: normalizePersonName(entry.name),
        reason: entry.reason,
        nominatedBy: entry.nominatedBy,
        createdAt: entry.createdAt
      }));

      const expiresAt = new Date(Date.now() + CUT_POLL_DURATION_MS).toISOString();
      const voteRows = buildCutVoteRows(entries);

      await interaction.reply({
        content: buildCutPollMessage(entries),
        components: voteRows
      });

      const pollMessage = await interaction.fetchReply();
      startCutPoll(guildId, {
        messageId: pollMessage.id,
        channelId: pollMessage.channelId,
        startedBy: interaction.user.id,
        startedAt: new Date().toISOString(),
        expiresAt,
        entries,
        votes: {}
      });
      scheduleCutPollTimeout(guildId, expiresAt);
        cancelNominationPurge(guildId);
      return;
    }

    if (subcommand === "end") {
      const result = await finalizeCutPoll(guildId, "manual", interaction.user.id);
      await interaction.reply({
        content: result.ok
          ? "Cut poll ended. Results have been posted."
          : "There is no active cut poll to end.",
        ephemeral: true
      });
      return;
    }

    await interaction.reply({
      content: "Use /nominate, /cut why, /cut vote, or /cut end.",
      ephemeral: true
    });
    return;
  }

  if (commandName === "cuts") {
    if (!isCutPollChannel(interaction.channelId)) {
      await interaction.reply({
        content: getCutPollChannelWarning(),
        ephemeral: true
      });
      return;
    }

    const lastResult = getLastCutPollResult(interaction.guildId);

    if (!lastResult || !lastResult.content) {
      await interaction.reply({
        content: "There are no completed cut poll results to repost yet.",
        ephemeral: true
      });
      return;
    }

    const endedAtMs = lastResult.endedAt ? new Date(lastResult.endedAt).getTime() : NaN;
    const endedAtPrefix = Number.isFinite(endedAtMs)
      ? `Last cut poll result from <t:${Math.floor(endedAtMs / 1000)}:R>.\n`
      : "Last cut poll result.\n";

    await interaction.reply({
      content: `${endedAtPrefix}${lastResult.content}`,
      ephemeral: false
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
        "- /nominate -> open modal to nominate one or more people (one name per line)",
        "- /cut why person:<name> -> show that person's stored reason (ephemeral)",
        "- /cut vote -> start a 5 minute button poll using queued nominations",
        "- /cut end -> end the active cut poll and post results",
        "- /cuts -> repost the last completed cut poll results",
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
