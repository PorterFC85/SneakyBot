const fs = require("node:fs");
const path = require("node:path");

const DATA_FILE = path.join(__dirname, "..", "data", "posts.json");

function ensureDataFile() {
  const dataDir = path.dirname(DATA_FILE);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ commands: {} }, null, 2), "utf8");
  }
}

function readStore() {
  ensureDataFile();
  const raw = fs.readFileSync(DATA_FILE, "utf8");

  try {
    const parsed = JSON.parse(raw);
    if (!parsed.commands || typeof parsed.commands !== "object") {
      return { commands: {} };
    }
    return parsed;
  } catch {
    return { commands: {} };
  }
}

function writeStore(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function normalizeCommandName(name) {
  return name.trim().toLowerCase();
}

function isValidCommandName(name) {
  return /^[a-z0-9_-]{2,32}$/.test(name);
}

function upsertCommand(name, content, authorId) {
  const store = readStore();
  const key = normalizeCommandName(name);

  store.commands[key] = {
    content,
    authorId,
    updatedAt: new Date().toISOString()
  };

  writeStore(store);
  return key;
}

function getCommand(name) {
  const store = readStore();
  const key = normalizeCommandName(name);
  return store.commands[key] || null;
}

function deleteCommand(name) {
  const store = readStore();
  const key = normalizeCommandName(name);

  if (!store.commands[key]) {
    return false;
  }

  delete store.commands[key];
  writeStore(store);
  return true;
}

function listCommands() {
  const store = readStore();
  return Object.keys(store.commands).sort();
}

module.exports = {
  isValidCommandName,
  upsertCommand,
  getCommand,
  deleteCommand,
  listCommands
};
