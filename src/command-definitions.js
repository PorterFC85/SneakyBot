const BASE_COMMANDS = [
  {
    name: "set",
    description: "Create or edit a saved post",
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
    name: "posts",
    description: "List saved post commands"
  },
  {
    name: "deletepost",
    description: "Delete a saved post",
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

module.exports = {
  BASE_COMMANDS,
  RESERVED_COMMANDS
};
