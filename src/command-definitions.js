const BASE_COMMANDS = [
  {
    name: "setpost",
    description: "Create or update a post using a modal draft",
    options: [
      {
        name: "command",
        description: "Command name to create or edit",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "post",
    description: "Get information saved under a command name",
    options: [
      {
        name: "command",
        description: "Command name to look up",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "deletepost",
    description: "Delete a stored post",
    options: [
      {
        name: "command",
        description: "Command name to delete",
        type: 3,
        required: true
      }
    ]
  },
  {
    name: "list",
    description: "List bot-managed resources",
    options: [
      {
        name: "post",
        description: "Show all saved post command names",
        type: 1,
        required: false
      }
    ]
  },
  {
    name: "sneakybot",
    description: "SneakyBot utilities and help",
    options: [
      {
        name: "help",
        description: "Show available commands",
        type: 1,
        required: false
      }
    ]
  },
  {
    name: "nominate",
    description: "Nominate one or more people for the cut poll"
  },
  {
    name: "cut",
    description: "Manage cut nominations and voting polls",
    options: [
      {
        name: "why",
        description: "Show the reason for a nominated person",
        type: 1,
        options: [
          {
            name: "person",
            description: "Person name to look up",
            type: 3,
            required: true
          }
        ]
      },
      {
        name: "vote",
        description: "Start the poll using queued nominations",
        type: 1,
        required: false
      },
      {
        name: "end",
        description: "End the active poll",
        type: 1,
        required: false
      }
    ]
  },
  {
    name: "cuts",
    description: "Repost the last completed cut poll results"
  }
];

const RESERVED_COMMANDS = new Set(BASE_COMMANDS.map((command) => command.name));

function buildDynamicCommand(name) {
  return {
    name,
    description: `Show saved post: ${name}`
  };
}

function buildGuildCommands(dynamicNames) {
  const safeNames = dynamicNames
    .filter((name) => !RESERVED_COMMANDS.has(name))
    .sort();

  const dynamicCommands = safeNames.map(buildDynamicCommand);
  return [...BASE_COMMANDS, ...dynamicCommands];
}

module.exports = {
  BASE_COMMANDS,
  RESERVED_COMMANDS,
  buildGuildCommands
};
