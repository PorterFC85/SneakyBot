const BASE_COMMANDS = [
  {
    name: "setpost",
    description: "Create or update a stored post tied to a command name",
    options: [
      {
        name: "command",
        description: "Command name, like raid-rules",
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
    name: "cut",
    description: "Manage cut nominations and voting polls",
    options: [
      {
        name: "nominate",
        description: "Nominate a person with a reason",
        type: 1,
        options: [
          {
            name: "person",
            description: "Person name to nominate",
            type: 3,
            required: true
          },
          {
            name: "reason",
            description: "Reason for the nomination",
            type: 3,
            required: true
          }
        ]
      },
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
