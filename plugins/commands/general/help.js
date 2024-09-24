import axios from 'axios';

class HelpCommand {
  name = "help";
  version = "1.0.3";
  role = 0;
  hasPrefix = true;
  aliases = ["menu cmds", "menu"];
  description = "Show all commands or command details";
  usage = "[command] (optional)";
  credits = "Arjhil";
  cooldown = 3;

  langData = {
    "en_US": {
      "help.list": `
Available Commands:
╭─╼━━━━━━━━╾─╮
{list}
╰─━━━━━━━━━╾─╯
❐ Prefix: » {prefix} «
❐ Type » {prefix}help <command> « to get more information about a specific command.
❐ Total commands:【 {total} 】`,
      "help.commandNotExists": "Command {command} does not exist.",
      "help.commandDetails": `
Command Details:
╭───────────────────────────╮
│ **Name**: {name}
│ **Aliases**: {aliases}
│ **Version**: {version}
│ **Description**: {description}
│ **Usage**: {prefix}{commandName} {usage}
│ **Permissions**: {permissions}
│ **Cooldown**: {cooldown} seconds
│ **Credits**: {credits}
╰───────────────────────────╯`,
      "0": "Member",
      "1": "Group Admin",
      "2": "Bot Admin"
    }
  };

  getCommandName(commandName) {
    if (global.plugins.commandsAliases.has(commandName)) return commandName;

    for (let [key, value] of global.plugins.commandsAliases) {
      if (value.includes(commandName)) return key;
    }

    return null;
  }

  async execute({ api, event, args }) {
    const commandName = args[0]?.toLowerCase();
    const commandsConfig = global.plugins.commandsConfig;

    if (!commandName) {
      let commands = {};
      const language = event.language || global.config.LANGUAGE || 'en_US';

      for (const [key, value] of commandsConfig.entries()) {
        if (value.isHidden) continue;
        if (value.isAbsolute && !global.config.ABSOLUTES.some(e => e == event.senderID)) continue;
        if (!value.hasOwnProperty("permissions")) value.permissions = [0, 1, 2];
        if (!value.permissions.some(p => event.userPermissions.includes(p))) continue;

        if (!commands.hasOwnProperty(value.category)) commands[value.category] = [];
        commands[value.category].push(value.name);
      }

      let list = Object.keys(commands)
        .flatMap(category => commands[category].map(cmd => `│ ✦ ${cmd}`))
        .join("\n");

      return api.messageReply(this.langData[language]["help.list"].replace("{list}", list).replace("{prefix}", event.prefix).replace("{total}", Object.values(commands).map(e => e.length).reduce((a, b) => a + b, 0)), event.threadID, event.messageID);
    } else {
      const command = commandsConfig.get(this.getCommandName(commandName));
      if (!command) return api.messageReply(this.langData.en_US["help.commandNotExists"].replace("{command}", commandName), event.threadID, event.messageID);

      const permissions = command.permissions.map(p => this.langData.en_US[String(p)]).join(", ");
      return api.messageReply(this.langData.en_US["help.commandDetails"].replace("{name}", command.name)
        .replace("{aliases}", command.aliases.join(", "))
        .replace("{version}", command.version || "1.0.0")
        .replace("{description}", command.description || '')
        .replace("{prefix}", event.prefix)
        .replace("{commandName}", command.name)
        .replace("{usage}", command.usage || '')
        .replace("{permissions}", permissions)
        .replace("{cooldown}", command.cooldown || 3)
        .replace("{credits}", command.credits || ""), event.threadID, event.messageID);
    }
  }
}

export default new HelpCommand();
