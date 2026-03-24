const BASE_COMMANDS = [
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

module.exports = {
  BASE_COMMANDS
};
