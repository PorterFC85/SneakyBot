const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "..", "data", "posts.json");

function ensureDataFile() {
  const dataDir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ cutPolls: {} }, null, 2), "utf8");
  }
}

function readStore() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { cutPolls: {} };
    }

    if (!parsed.cutPolls || typeof parsed.cutPolls !== "object") {
      parsed.cutPolls = {};
    }

    return {
      cutPolls: parsed.cutPolls
    };
  } catch {
    return { cutPolls: {} };
  }
}

function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function normalizePersonName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function ensureGuildCutState(store, guildId) {
  if (!store.cutPolls[guildId] || typeof store.cutPolls[guildId] !== "object") {
    store.cutPolls[guildId] = {
      queuedNominations: [],
      activePoll: null,
      lastResult: null
    };
    return;
  }

  if (!Array.isArray(store.cutPolls[guildId].queuedNominations)) {
    store.cutPolls[guildId].queuedNominations = [];
  }

  if (typeof store.cutPolls[guildId].nominationQueueStartedAt === "undefined") {
    store.cutPolls[guildId].nominationQueueStartedAt = null;
  }

  if (typeof store.cutPolls[guildId].activePoll === "undefined") {
    store.cutPolls[guildId].activePoll = null;
  }

  if (typeof store.cutPolls[guildId].lastResult === "undefined") {
    store.cutPolls[guildId].lastResult = null;
  }
}

function upsertCutNomination(guildId, personName, reason, nominatedBy) {
  const store = readStore();
  ensureGuildCutState(store, guildId);

  const normalizedName = normalizePersonName(personName);
  const queue = store.cutPolls[guildId].queuedNominations;
  const existingIndex = queue.findIndex((entry) => entry.normalizedName === normalizedName);
  const nomination = {
    name: personName.trim(),
    normalizedName,
    reason: reason.trim(),
    nominatedBy,
    createdAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    return false;
  }

  const wasEmpty = queue.length === 0;
  queue.push(nomination);

  if (wasEmpty) {
    store.cutPolls[guildId].nominationQueueStartedAt = new Date().toISOString();
  }
  writeStore(store);
  return true;
}

function getQueuedCutNominations(guildId) {
  const store = readStore();
  ensureGuildCutState(store, guildId);
  return [...store.cutPolls[guildId].queuedNominations];
}

function clearQueuedCutNominations(guildId) {
  const store = readStore();
  ensureGuildCutState(store, guildId);
  store.cutPolls[guildId].queuedNominations = [];
  store.cutPolls[guildId].nominationQueueStartedAt = null;
  writeStore(store);
}

function findCutReason(guildId, personName) {
  const store = readStore();
  ensureGuildCutState(store, guildId);

  const normalizedName = normalizePersonName(personName);
  const guildState = store.cutPolls[guildId];

  const queuedEntry = guildState.queuedNominations.find(
    (entry) => entry.normalizedName === normalizedName
  );
  if (queuedEntry) {
    return queuedEntry;
  }

  const activeEntries =
    guildState.activePoll && Array.isArray(guildState.activePoll.entries)
      ? guildState.activePoll.entries
      : [];

  return activeEntries.find((entry) => entry.normalizedName === normalizedName) || null;
}

function startCutPoll(guildId, activePoll) {
  const store = readStore();
  ensureGuildCutState(store, guildId);

  store.cutPolls[guildId].activePoll = activePoll;
  store.cutPolls[guildId].queuedNominations = [];
  store.cutPolls[guildId].nominationQueueStartedAt = null;
  writeStore(store);
}

function getActiveCutPoll(guildId) {
  const store = readStore();
  ensureGuildCutState(store, guildId);
  return store.cutPolls[guildId].activePoll || null;
}

function setActiveCutPoll(guildId, activePoll) {
  const store = readStore();
  ensureGuildCutState(store, guildId);
  store.cutPolls[guildId].activePoll = activePoll;
  writeStore(store);
}

function clearActiveCutPoll(guildId) {
  const store = readStore();
  ensureGuildCutState(store, guildId);
  store.cutPolls[guildId].activePoll = null;
  writeStore(store);
}

function recordCutVote(guildId, userId, normalizedName) {
  const store = readStore();
  ensureGuildCutState(store, guildId);

  const activePoll = store.cutPolls[guildId].activePoll;
  if (!activePoll || !Array.isArray(activePoll.entries)) {
    return { ok: false, reason: "no-active-poll" };
  }

  const isValidEntry = activePoll.entries.some((entry) => entry.normalizedName === normalizedName);
  if (!isValidEntry) {
    return { ok: false, reason: "invalid-choice" };
  }

  if (!activePoll.votes || typeof activePoll.votes !== "object") {
    activePoll.votes = {};
  }

  const existingVotes = Array.isArray(activePoll.votes[userId])
    ? activePoll.votes[userId]
    : [];

  if (existingVotes.includes(normalizedName)) {
    return { ok: false, reason: "duplicate-vote" };
  }

  activePoll.votes[userId] = [...existingVotes, normalizedName];
  store.cutPolls[guildId].activePoll = activePoll;
  writeStore(store);

  return { ok: true };
}

function listActiveCutPolls() {
  const store = readStore();
  const guildIds = Object.keys(store.cutPolls || {});

  return guildIds
    .map((guildId) => ({ guildId, activePoll: store.cutPolls[guildId].activePoll || null }))
    .filter((item) => item.activePoll);
}

function setLastCutPollResult(guildId, lastResult) {
  const store = readStore();
  ensureGuildCutState(store, guildId);
  store.cutPolls[guildId].lastResult = lastResult;
  writeStore(store);
}

function getLastCutPollResult(guildId) {
  const store = readStore();
  ensureGuildCutState(store, guildId);
  return store.cutPolls[guildId].lastResult || null;
}

function getQueueStartedAt(guildId) {
  const store = readStore();
  ensureGuildCutState(store, guildId);
  return store.cutPolls[guildId].nominationQueueStartedAt || null;
}

module.exports = {
  upsertCutNomination,
  getQueuedCutNominations,
  clearQueuedCutNominations,
  getQueueStartedAt,
  findCutReason,
  startCutPoll,
  getActiveCutPoll,
  setActiveCutPoll,
  clearActiveCutPoll,
  recordCutVote,
  listActiveCutPolls,
  setLastCutPollResult,
  getLastCutPollResult,
  normalizePersonName
};
